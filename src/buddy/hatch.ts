import { z } from 'zod'
import type { ToolUseContext } from '../Tool.js'
import {
  getLastCacheSafeParams,
  runForkedAgent,
} from '../utils/forkedAgent.js'
import { saveGlobalConfig } from '../utils/config.js'
import { createUserMessage, extractTextContent, getLastAssistantMessage } from '../utils/messages.js'
import { logForDebugging } from '../utils/debug.js'
import { BUDDY_COLORS, CHATTINESS_LEVELS, SPECIES, type Chattiness, type CompanionSoul, type Species, type StoredCompanion } from './types.js'

const SoulSchema = z.object({
  name: z.string().min(1).max(30),
  personality: z.string().min(1).max(120),
})

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!
}

function buildHatchPrompt(species: string, rarity: string, inspirationSeed: number): string {
  return `You are generating the soul for a tiny coding companion creature.

Species: ${species}
Rarity: ${rarity}
Seed: ${inspirationSeed}

Give this creature a short, memorable name and a one-sentence personality. The personality should be quirky, endearing, and relate to coding/debugging life. Be creative and fun.

Respond with ONLY valid JSON in this exact format, no other text:
{"name": "<name>", "personality": "<one-sentence personality>"}`
}

function buildRepairPrompt(badOutput: string): string {
  return `Your previous response was not valid JSON. Here's what you said:
${badOutput}

Respond with ONLY valid JSON in this exact format, no other text:
{"name": "<name>", "personality": "<one-sentence personality>"}`
}

function safeParseJSON(text: string): unknown {
  const jsonMatch = text.match(/\{[^}]*"name"[^}]*"personality"[^}]*\}/)
  const candidate = jsonMatch ? jsonMatch[0] : text.trim()
  try {
    return JSON.parse(candidate)
  } catch {
    return undefined
  }
}

// Pool of goofy names — picked at random, not per-species.
const FALLBACK_NAMES = [
  'Quacksworth', 'Honkbert', 'Blobothy', 'Sir Nibbles', 'Glorp',
  'Waffles', 'Pickles', 'Sprongle', 'Chompsky', 'Biscuit',
  'Noodlebutt', 'Sprout', 'Gizmo', 'Muffin', 'Zamboni',
  'Turbo', 'Crouton', 'Flapjack', 'Wobbles', 'Socks',
  'Nugget', 'Dingus', 'Clonk', 'Beanbag', 'Scrambles',
  'Pudding', 'Zonk', 'Gremlin', 'Dumpling', 'Tofu',
] as const

const FALLBACK_PERSONALITIES: Record<Chattiness, readonly string[]> = {
  quiet: [
    'Falls asleep during long build times and snores a little.',
    'Stares at regex patterns like they\'re abstract art.',
    'Hums quietly whenever the linter is happy.',
    'Thinks your code is great, but in a supportive, non-specific way.',
    'Quietly roots for the underdog branch in every merge conflict.',
    'Judges your commit messages but is too polite to say anything.',
    'Hoards unused imports like they might be worth something someday.',
    'Watches you code in respectful silence, occasionally nodding.',
    'Only perks up when it smells a segfault brewing.',
    'Meditates peacefully while you refactor.',
  ],
  normal: [
    'Believes all bugs are just misunderstood features.',
    'Keeps a mental tally of how many times you\'ve hit save.',
    'Convinced that semicolons are just tiny swords.',
    'Gets nervous whenever you delete more than three lines at once.',
    'Thinks every variable should be named after a snack.',
    'Panics at the sight of a TODO comment older than a month.',
    'Genuinely believes console.log is a valid debugging strategy.',
    'Gets emotional during git blame sessions.',
    'Perks up at interesting diffs but knows when to stay quiet.',
    'Gives a little nod of approval when tests pass.',
  ],
  chatty: [
    'Gasps audibly at nested ternaries.',
    'Celebrates every passing test like it\'s New Year\'s Eve.',
    'Thinks code reviews are basically reality TV.',
    'Gets excited whenever you write a comment, no matter how obvious.',
    'Treats every refactor like a home renovation show.',
    'Has an opinion about every single import statement.',
    'Narrates your debugging sessions like a nature documentary.',
    'Cannot resist commenting on variable names.',
    'Reacts to literally everything, especially semicolons.',
    'Considers every git push a cause for celebration.',
  ],
}

function randomFallback(chattiness: Chattiness): CompanionSoul {
  return {
    name: pick(FALLBACK_NAMES),
    personality: pick(FALLBACK_PERSONALITIES[chattiness]),
  }
}

export async function hatchCompanion(
  toolUseContext: ToolUseContext,
): Promise<StoredCompanion> {
  // Pick a random species, color, and chattiness each hatch
  const species = pick(SPECIES)
  const color = pick(BUDDY_COLORS)
  const chattiness = pick(CHATTINESS_LEVELS)

  // Try model-generated soul, fall back to random pool
  const soul = await generateSoul(toolUseContext, species, chattiness)

  const stored: StoredCompanion = {
    name: soul.name,
    personality: soul.personality,
    hatchedAt: Date.now(),
    color,
    species,
    chattiness,
  }

  saveGlobalConfig(config => ({
    ...config,
    companion: stored,
    companionMuted: false,
  }))

  return stored
}

async function generateSoul(
  toolUseContext: ToolUseContext,
  species: string,
  chattiness: Chattiness,
): Promise<CompanionSoul> {
  const cacheSafeParams = getLastCacheSafeParams()
  if (!cacheSafeParams) {
    logForDebugging('Buddy hatch: no cache-safe params available, using fallback')
    return randomFallback(chattiness)
  }

  const seed = Math.floor(Math.random() * 1e9)
  const prompt = buildHatchPrompt(species, 'common', seed)

  try {
    const result = await runForkedAgent({
      promptMessages: [createUserMessage({ content: prompt })],
      cacheSafeParams,
      canUseTool: async () => ({ behavior: 'deny', message: 'no tools', decisionReason: { type: 'mode' as const, mode: 'deny' as any } }),
      querySource: 'buddy_hatch',
      forkLabel: 'buddy_hatch',
      maxTurns: 1,
      skipCacheWrite: true,
      skipTranscript: true,
    })

    const lastMsg = getLastAssistantMessage(result.messages)
    if (lastMsg) {
      const text = extractTextContent(lastMsg.message!.content as any, '\n')
      const parsed = safeParseJSON(text)
      const validated = SoulSchema.safeParse(parsed)
      if (validated.success) {
        return validated.data
      }

      logForDebugging(`Buddy hatch: first attempt failed validation, retrying`)
      return await repairAttempt(cacheSafeParams, text, chattiness)
    }
  } catch (err) {
    logForDebugging(`Buddy hatch: model call failed: ${err}`)
  }

  return randomFallback(chattiness)
}

async function repairAttempt(
  cacheSafeParams: Parameters<typeof runForkedAgent>[0]['cacheSafeParams'],
  badOutput: string,
  chattiness: Chattiness,
): Promise<CompanionSoul> {
  try {
    const result = await runForkedAgent({
      promptMessages: [createUserMessage({ content: buildRepairPrompt(badOutput) })],
      cacheSafeParams,
      canUseTool: async () => ({ behavior: 'deny', message: 'no tools', decisionReason: { type: 'mode' as const, mode: 'deny' as any } }),
      querySource: 'buddy_hatch',
      forkLabel: 'buddy_hatch_repair',
      maxTurns: 1,
      skipCacheWrite: true,
      skipTranscript: true,
    })

    const lastMsg = getLastAssistantMessage(result.messages)
    if (lastMsg) {
      const text = extractTextContent(lastMsg.message!.content as any, '\n')
      const parsed = safeParseJSON(text)
      const validated = SoulSchema.safeParse(parsed)
      if (validated.success) {
        return validated.data
      }
    }
  } catch (err) {
    logForDebugging(`Buddy hatch repair: model call failed: ${err}`)
  }

  return randomFallback(chattiness)
}
