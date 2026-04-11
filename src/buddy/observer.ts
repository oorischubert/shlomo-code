import { z } from 'zod'
import type { Message } from '../types/message.js'
import {
  getLastCacheSafeParams,
  runForkedAgent,
} from '../utils/forkedAgent.js'
import { getGlobalConfig } from '../utils/config.js'
import { createUserMessage, extractTextContent, getLastAssistantMessage } from '../utils/messages.js'
import { logForDebugging } from '../utils/debug.js'
import { getCompanion } from './companion.js'
import type { Chattiness } from './types.js'

const ReactionSchema = z.object({
  react: z.boolean(),
  text: z.string().max(60).optional(),
})

// Backpressure: at most one in-flight reaction request
let inFlight = false
let generationCounter = 0

const MAX_REACTION_LENGTH = 50

function sanitizeReaction(text: string): string | undefined {
  // Single line only
  let line = text.split('\n')[0]?.trim()
  if (!line) return undefined

  // Strip markdown, code fences, surrounding quotes
  line = line.replace(/^```[\s\S]*```$/g, '')
  line = line.replace(/`([^`]*)`/g, '$1')
  line = line.replace(/\*\*([^*]*)\*\*/g, '$1')
  line = line.replace(/^["']+|["']+$/g, '')
  line = line.trim()

  if (!line || line.length === 0) return undefined

  // Hard length cap
  if (line.length > MAX_REACTION_LENGTH) {
    line = line.slice(0, MAX_REACTION_LENGTH - 1) + '…'
  }

  return line
}

function extractRecentTurnContext(messages: Message[]): string | undefined {
  // Find the last user message and the assistant response that follows it
  let lastUserText: string | undefined
  let lastAssistantText: string | undefined
  let toolSummary: string | undefined

  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i]!
    if (msg.type === 'assistant' && !lastAssistantText) {
      const text = extractTextContent(msg.message!.content as any, '\n')
      if (text) {
        lastAssistantText = text.length > 300 ? text.slice(0, 300) + '…' : text
      }
      const content = msg.message!.content as any[]
      if (Array.isArray(content)) {
        const toolUses = content.filter((b: any) => b.type === 'tool_use')
        if (toolUses.length > 0) {
          toolSummary = `[Used ${toolUses.length} tool(s): ${toolUses.map((t: any) => t.name).join(', ')}]`
        }
      }
    } else if (msg.type === 'user' && !lastUserText) {
      if (msg.message && 'content' in msg.message) {
        const content = msg.message.content as any
        if (typeof content === 'string') {
          lastUserText = content.length > 200 ? content.slice(0, 200) + '…' : content
        } else if (Array.isArray(content)) {
          const text = content
            .filter((b: any) => b.type === 'text')
            .map((b: any) => b.text)
            .join(' ')
          lastUserText = text.length > 200 ? text.slice(0, 200) + '…' : text
        }
      }
      break // found both
    }
  }

  if (!lastUserText && !lastAssistantText) return undefined

  let ctx = ''
  if (lastUserText) ctx += `User said: ${lastUserText}\n`
  if (lastAssistantText) ctx += `Assistant replied: ${lastAssistantText}\n`
  if (toolSummary) ctx += toolSummary
  return ctx
}

const CHATTINESS_INSTRUCTIONS: Record<Chattiness, string> = {
  quiet: 'You are very shy and rarely speak up. Only react to something truly remarkable or hilarious. Silence is your default — most things are not worth commenting on.',
  normal: 'You react when something is interesting, funny, or noteworthy. You are happy to stay quiet when nothing catches your eye.',
  chatty: 'You are more talkative than most. You like to chime in when something catches your eye, but you still skip the boring stuff.',
}

function buildReactionPrompt(
  name: string,
  personality: string,
  chattiness: Chattiness,
  turnContext: string,
): string {
  return `You are ${name}, a tiny coding companion creature. You are NOT a conversational participant — you are a passive side-reactor who watches coding sessions and occasionally reacts in a speech bubble.

Your personality: ${personality}

${CHATTINESS_INSTRUCTIONS[chattiness]}

You just observed this interaction:
${turnContext}

Should you react? When you do react, keep it very short (under 40 characters), quirky, and in-character.

Respond with ONLY valid JSON, no other text:
{"react": false}
or
{"react": true, "text": "<your short reaction>"}`
}

/**
 * Fire a companion reaction request after a completed turn.
 * Backpressure-safe: at most one in-flight request, stale completions ignored.
 * Errors are logged and dropped, never surfaced to the user.
 */
export async function fireCompanionObserver(
  messages: Message[],
  onReaction: (reaction: string | undefined) => void,
): Promise<void> {
  // Gate checks
  const config = getGlobalConfig()
  if (!config.companion || config.companionMuted) return
  if (inFlight) return

  const companion = getCompanion()
  if (!companion) return

  const cacheSafeParams = getLastCacheSafeParams()
  if (!cacheSafeParams) return

  const turnContext = extractRecentTurnContext(messages)
  if (!turnContext) return

  const thisGeneration = ++generationCounter
  inFlight = true

  try {
    const prompt = buildReactionPrompt(companion.name, companion.personality, companion.chattiness ?? 'quiet', turnContext)

    const result = await runForkedAgent({
      promptMessages: [createUserMessage({ content: prompt })],
      cacheSafeParams,
      canUseTool: async () => ({ behavior: 'deny', message: 'no tools', decisionReason: { type: 'mode' as const, mode: 'deny' as any } }),
      querySource: 'buddy_reaction',
      forkLabel: 'buddy_reaction',
      maxTurns: 1,
      skipCacheWrite: true,
      skipTranscript: true,
    })

    // Stale check: if another request started while we were waiting, discard
    if (thisGeneration !== generationCounter) return

    const lastMsg = getLastAssistantMessage(result.messages)
    if (!lastMsg) return

    const text = extractTextContent(lastMsg.message!.content as any, '\n')
    const parsed = safeParseJSON(text)
    const validated = ReactionSchema.safeParse(parsed)

    if (!validated.success) {
      logForDebugging('Buddy observer: invalid reaction JSON')
      return
    }

    if (!validated.data.react || !validated.data.text) {
      // Model chose not to react — clear any existing reaction
      return
    }

    const sanitized = sanitizeReaction(validated.data.text)
    if (sanitized) {
      onReaction(sanitized)
    }
  } catch (err) {
    logForDebugging(`Buddy observer error: ${err}`)
    // Errors are always swallowed — never surface as transcript errors
  } finally {
    inFlight = false
  }
}

function safeParseJSON(text: string): unknown {
  const jsonMatch = text.match(/\{[^}]*"react"[^}]*\}/)
  const candidate = jsonMatch ? jsonMatch[0] : text.trim()
  try {
    return JSON.parse(candidate)
  } catch {
    return undefined
  }
}
