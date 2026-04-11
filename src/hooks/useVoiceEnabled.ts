import { useAppState } from '../state/AppState.js'
import { isVoiceGrowthBookEnabled } from '../voice/voiceModeEnabled.js'

/**
 * Combines user intent (settings.voiceEnabled) with build-time feature
 * availability. Provider-specific validation happens when enabling voice
 * and when making transcription requests.
 */
export function useVoiceEnabled(): boolean {
  const userIntent = useAppState(s => s.settings.voiceEnabled === true)
  return userIntent && isVoiceGrowthBookEnabled()
}
