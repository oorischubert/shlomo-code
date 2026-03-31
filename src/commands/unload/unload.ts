import type { LocalCommandCall } from '../../types/command.js'
import { unloadAllLmStudioModels } from '../../services/lmStudio/modelManagement.js'

function usageText(): string {
  return 'Usage: /unload\n\nUnloads all currently loaded LM Studio models from memory.'
}

export const call: LocalCommandCall = async args => {
  const trimmed = args.trim()

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

  if (trimmed.length > 0 && trimmed !== 'all') {
    return {
      type: 'text',
      value: usageText(),
    }
  }

  try {
    const unloadedInstanceIds = await unloadAllLmStudioModels()

    if (unloadedInstanceIds.length === 0) {
      return {
        type: 'text',
        value: 'No LM Studio models are currently loaded.',
      }
    }

    return {
      type: 'text',
      value: `Unloaded ${unloadedInstanceIds.length} LM Studio ${unloadedInstanceIds.length === 1 ? 'model' : 'models'}.`,
    }
  } catch (error) {
    return {
      type: 'text',
      value: `Failed to unload LM Studio models: ${(error as Error).message}`,
    }
  }
}
