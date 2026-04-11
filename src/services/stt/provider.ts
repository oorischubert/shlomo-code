import {
  openAISpeechToTextProvider,
  type SpeechToTextProvider,
  type TranscribeAudioInput,
} from './openai.js'

export type { SpeechToTextProvider, TranscribeAudioInput }

export function getSpeechToTextProvider(): SpeechToTextProvider {
  return openAISpeechToTextProvider
}

export function getSpeechToTextConfigurationError(): string | null {
  return getSpeechToTextProvider().getConfigurationError()
}

export async function validateSpeechToTextProvider(): Promise<string | null> {
  const provider = getSpeechToTextProvider()
  const configurationError = provider.getConfigurationError()
  if (configurationError) {
    return configurationError
  }
  return provider.validate()
}

export async function transcribeWithSpeechToTextProvider(
  input: TranscribeAudioInput,
): Promise<string> {
  return getSpeechToTextProvider().transcribe(input)
}
