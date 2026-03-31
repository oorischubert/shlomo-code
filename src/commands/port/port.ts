import type { LocalCommandCall } from '../../types/command.js'
import { saveGlobalConfig } from '../../utils/config.js'
import {
  DEFAULT_LM_STUDIO_PORT,
  getLmStudioPort,
  isValidLmStudioPort,
} from '../../utils/lmStudio.js'
import { clearLmStudioModelsCache } from '../../utils/model/modelOptions.js'

function usageText(): string {
  return 'Usage: /port [number|reset|status]\n\nSets the localhost port used for the built-in LM Studio backend.'
}

export const call: LocalCommandCall = async args => {
  const trimmed = args.trim()

  if (!trimmed || trimmed === 'status' || trimmed === 'current') {
    return {
      type: 'text',
      value: `Current LM Studio port: ${getLmStudioPort()}`,
    }
  }

  if (
    trimmed === 'help' ||
    trimmed === '-h' ||
    trimmed === '--help' ||
    trimmed === '?'
  ) {
    return {
      type: 'text',
      value: usageText(),
    }
  }

  const nextPort =
    trimmed === 'reset' ? DEFAULT_LM_STUDIO_PORT : Number.parseInt(trimmed, 10)

  if (!isValidLmStudioPort(nextPort)) {
    return {
      type: 'text',
      value: `Invalid port: ${trimmed}. Enter a number between 1 and 65535, or use /port reset.`,
    }
  }

  saveGlobalConfig(current => ({
    ...current,
    lmStudioPort: nextPort,
  }))
  clearLmStudioModelsCache()

  return {
    type: 'text',
    value:
      nextPort === DEFAULT_LM_STUDIO_PORT
        ? `LM Studio port reset to ${DEFAULT_LM_STUDIO_PORT}. Shlomo now uses http://localhost:${DEFAULT_LM_STUDIO_PORT}/v1`
        : `LM Studio port set to ${nextPort}. Shlomo now uses http://localhost:${nextPort}/v1`,
  }
}
