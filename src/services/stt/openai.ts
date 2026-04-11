import { pcm16leToWav } from './wav.js'

const OPENAI_API_BASE_URL = 'https://api.openai.com/v1'
const OPENAI_TRANSCRIPTION_MODEL = 'whisper-1'
const OPENAI_VOICE_CONFIG_ERROR =
  'Please configure OPENAI_API_KEY for voice transcription.'
const OPENAI_VOICE_REQUEST_ERROR =
  'Voice transcription failed. Check OPENAI_API_KEY and network access.'

export type TranscribeAudioInput = {
  audioPcm: Buffer
  sampleRate: number
  language?: string
  prompt?: string
  signal?: AbortSignal
}

export type SpeechToTextProvider = {
  id: string
  getConfigurationError: () => string | null
  validate: () => Promise<string | null>
  transcribe: (input: TranscribeAudioInput) => Promise<string>
}

function getOpenAIApiKey(): string | undefined {
  const apiKey = process.env.OPENAI_API_KEY?.trim()
  return apiKey ? apiKey : undefined
}

function getAuthHeaders(apiKey: string): HeadersInit {
  return {
    Authorization: `Bearer ${apiKey}`,
  }
}

function getErrorMessage(payload: unknown): string | null {
  if (
    payload &&
    typeof payload === 'object' &&
    'error' in payload &&
    payload.error &&
    typeof payload.error === 'object' &&
    'message' in payload.error &&
    typeof payload.error.message === 'string'
  ) {
    return payload.error.message
  }

  if (
    payload &&
    typeof payload === 'object' &&
    'message' in payload &&
    typeof payload.message === 'string'
  ) {
    return payload.message
  }

  return null
}

async function parseJsonSafely(response: Response): Promise<unknown> {
  try {
    return await response.json()
  } catch {
    return null
  }
}

function getResponseErrorMessage(
  response: Response,
  payload: unknown,
  fallback: string,
): string {
  if (response.status === 401 || response.status === 403) {
    return OPENAI_VOICE_CONFIG_ERROR
  }

  return getErrorMessage(payload) ?? fallback
}

export const openAISpeechToTextProvider: SpeechToTextProvider = {
  id: 'openai',

  getConfigurationError(): string | null {
    return getOpenAIApiKey() ? null : OPENAI_VOICE_CONFIG_ERROR
  },

  async validate(): Promise<string | null> {
    const apiKey = getOpenAIApiKey()
    if (!apiKey) {
      return OPENAI_VOICE_CONFIG_ERROR
    }

    try {
      const response = await fetch(`${OPENAI_API_BASE_URL}/models`, {
        method: 'GET',
        headers: getAuthHeaders(apiKey),
      })

      if (response.ok) {
        return null
      }

      const payload = await parseJsonSafely(response)
      return getResponseErrorMessage(
        response,
        payload,
        OPENAI_VOICE_REQUEST_ERROR,
      )
    } catch {
      return OPENAI_VOICE_REQUEST_ERROR
    }
  },

  async transcribe(input: TranscribeAudioInput): Promise<string> {
    const apiKey = getOpenAIApiKey()
    if (!apiKey) {
      throw new Error(OPENAI_VOICE_CONFIG_ERROR)
    }

    const wavData = pcm16leToWav({
      audioPcm: input.audioPcm,
      sampleRate: input.sampleRate,
    })

    const form = new FormData()
    form.append(
      'file',
      new File([wavData], 'voice-input.wav', {
        type: 'audio/wav',
      }),
    )
    form.append('model', OPENAI_TRANSCRIPTION_MODEL)
    if (input.language) {
      form.append('language', input.language)
    }
    if (input.prompt) {
      form.append('prompt', input.prompt)
    }

    let response: Response
    try {
      response = await fetch(`${OPENAI_API_BASE_URL}/audio/transcriptions`, {
        method: 'POST',
        headers: getAuthHeaders(apiKey),
        body: form,
        signal: input.signal,
      })
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw error
      }
      throw new Error(OPENAI_VOICE_REQUEST_ERROR)
    }

    const payload = await parseJsonSafely(response)
    if (!response.ok) {
      throw new Error(
        getResponseErrorMessage(response, payload, OPENAI_VOICE_REQUEST_ERROR),
      )
    }

    if (
      payload &&
      typeof payload === 'object' &&
      'text' in payload &&
      typeof payload.text === 'string'
    ) {
      return payload.text
    }

    throw new Error('Voice transcription returned an unexpected response.')
  },
}

export { OPENAI_VOICE_CONFIG_ERROR, OPENAI_VOICE_REQUEST_ERROR }
