let proactiveActive = false
let contextBlocked = false
const listeners = new Set<() => void>()

function notify(): void {
  for (const listener of listeners) {
    listener()
  }
}

export function isProactiveActive(): boolean {
  return proactiveActive
}

export function isProactivePaused(): boolean {
  return false
}

export function activateProactive(_source?: string): void {
  proactiveActive = true
  notify()
}

export function deactivateProactive(): void {
  proactiveActive = false
  notify()
}

export function pauseProactive(): void {
  notify()
}

export function resumeProactive(): void {
  notify()
}

export function setContextBlocked(value: boolean): void {
  contextBlocked = value
  if (!value) {
    proactiveActive = proactiveActive
  }
  notify()
}

export function getContextBlocked(): boolean {
  return contextBlocked
}

export function subscribeToProactiveChanges(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function getNextTickAt(): number | undefined {
  return undefined
}
