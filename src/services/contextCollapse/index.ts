import type { Message } from '../../types/message.js'

type CollapseStats = {
  collapsedSpans: number
  collapsedMessages: number
  stagedSpans: number
  health: {
    totalErrors: number
    totalEmptySpawns: number
    emptySpawnWarningEmitted: boolean
    totalSpawns: number
    lastError?: string
  }
}

const defaultStats = (): CollapseStats => ({
  collapsedSpans: 0,
  collapsedMessages: 0,
  stagedSpans: 0,
  health: {
    totalErrors: 0,
    totalEmptySpawns: 0,
    emptySpawnWarningEmitted: false,
    totalSpawns: 0,
  },
})

let stats = defaultStats()
const listeners = new Set<() => void>()

function emit(): void {
  for (const listener of listeners) {
    listener()
  }
}

export function initContextCollapse(): void {
  resetContextCollapse()
}

export function resetContextCollapse(): void {
  stats = defaultStats()
  emit()
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function getStats(): CollapseStats {
  return stats
}

export function isContextCollapseEnabled(): boolean {
  return false
}

export async function applyCollapsesIfNeeded(
  messages: Message[],
  _toolUseContext?: unknown,
  _querySource?: string,
): Promise<{ messages: Message[] }> {
  return { messages }
}

export function isWithheldPromptTooLong(
  _message: Message,
  _isPromptTooLongMessage?: boolean,
  _querySource?: string,
): boolean {
  return false
}

export function recoverFromOverflow(
  messages: Message[],
  _querySource?: string,
): { messages: Message[]; committed: number } {
  return {
    messages,
    committed: 0,
  }
}
