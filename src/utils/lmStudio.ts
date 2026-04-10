import { getGlobalConfig } from './config.js'

export const DEFAULT_LM_STUDIO_PORT = 1234
export const DEFAULT_LM_STUDIO_API_KEY = 'lmstudio'
export const LM_STUDIO_RESTART_RECOVERY_RETRIES = 3
export const LM_STUDIO_RESTART_RECOVERY_DELAY_MS = 1500
const PRECONFIG_ACCESS_ERROR = 'Config accessed before allowed.'

function isPreConfigAccessError(error: unknown): boolean {
  if (error instanceof Error) {
    return error.message === PRECONFIG_ACCESS_ERROR
  }
  if (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof error.message === 'string'
  ) {
    return error.message === PRECONFIG_ACCESS_ERROR
  }
  return false
}

export function isValidLmStudioPort(value: number): boolean {
  return Number.isInteger(value) && value >= 1 && value <= 65535
}

export function getLmStudioPort(): number {
  let configuredPort: number | undefined
  try {
    configuredPort = getGlobalConfig().lmStudioPort
  } catch (error) {
    if (isPreConfigAccessError(error)) {
      return DEFAULT_LM_STUDIO_PORT
    }
    throw error
  }
  if (
    typeof configuredPort === 'number' &&
    isValidLmStudioPort(configuredPort)
  ) {
    return configuredPort
  }
  return DEFAULT_LM_STUDIO_PORT
}

export function getLmStudioBaseUrl(): string {
  return `http://localhost:${getLmStudioPort()}/v1`
}

export function getLmStudioApiKey(): string {
  return DEFAULT_LM_STUDIO_API_KEY
}

export function isLmStudioRestartRecoveryErrorMessage(message: string): boolean {
  const normalized = message.toLowerCase()

  return (
    (normalized.includes('failed to load llm engine from path') &&
      normalized.includes('cannot find module') &&
      normalized.includes('llm_engine_')) ||
    normalized.includes('fetch failed') ||
    normalized.includes('ecconnrefused') ||
    normalized.includes('connection refused') ||
    normalized.includes('other side closed') ||
    normalized.includes('socket hang up')
  )
}
