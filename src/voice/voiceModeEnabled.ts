import { feature } from 'bun:bundle'

/**
 * Voice mode is available whenever the build includes the feature.
 * Runtime backend/provider validation happens at enable/transcribe time.
 */
export function isVoiceGrowthBookEnabled(): boolean {
  return feature('VOICE_MODE') ? true : false
}

/**
 * Backward-compatible helper retained for callers that previously
 * interpreted "voice auth" as "voice backend is available at all".
 */
export function hasVoiceAuth(): boolean {
  return isVoiceGrowthBookEnabled()
}

/**
 * Voice mode is visible and command-available whenever the feature is built.
 * Provider-specific checks live in the STT provider layer.
 */
export function isVoiceModeEnabled(): boolean {
  return isVoiceGrowthBookEnabled()
}
