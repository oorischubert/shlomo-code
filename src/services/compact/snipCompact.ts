import type { Message } from '../../types/message.js'

export const SNIP_NUDGE_TEXT =
  'Context snipping is not enabled in this build.'

export function isSnipRuntimeEnabled(): boolean {
  return false
}

export function shouldNudgeForSnips(_messages: Message[]): boolean {
  return false
}

export function isSnipMarkerMessage(_message: Message): boolean {
  return false
}

export function snipCompactIfNeeded(
  messages: Message[],
  _options?: { force?: boolean },
): {
  messages: Message[]
  tokensFreed: number
  boundaryMessage?: Message
} {
  return {
    messages,
    tokensFreed: 0,
  }
}
