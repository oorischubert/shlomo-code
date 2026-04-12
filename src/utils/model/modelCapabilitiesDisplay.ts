import {
  getCachedLmStudioModel,
  getCachedLmStudioReasoningSupport,
} from '../../services/lmStudio/modelManagement.js'
import { modelSupportsEffort } from '../effort.js'

export type DisplayModelCapabilities = {
  vision: boolean
  toolUse: boolean
  reasoning: boolean
}

export function formatDisplayModelCapabilities(
  model: string | null,
): string | null {
  const capabilities = getDisplayModelCapabilities(model)

  if (!capabilities) {
    return null
  }

  const badges = [
    capabilities.vision ? '[V]' : '',
    capabilities.toolUse ? '[T]' : '',
    capabilities.reasoning ? '[R]' : '',
  ].filter(Boolean)

  return badges.length > 0 ? badges.join('') : null
}

function inferNonLmStudioCapabilities(model: string): DisplayModelCapabilities | null {
  const normalized = model.toLowerCase()
  const isClaudeFamily =
    normalized.includes('claude') ||
    normalized.includes('sonnet') ||
    normalized.includes('opus') ||
    normalized.includes('haiku')

  if (!isClaudeFamily && !modelSupportsEffort(model)) {
    return null
  }

  return {
    vision: isClaudeFamily,
    toolUse: isClaudeFamily,
    reasoning: modelSupportsEffort(model),
  }
}

export function getDisplayModelCapabilities(
  model: string | null,
): DisplayModelCapabilities | null {
  if (!model) {
    return null
  }

  const lmStudioModel = getCachedLmStudioModel(model)
  const lmStudioReasoningSupport = getCachedLmStudioReasoningSupport(model)

  if (lmStudioModel || lmStudioReasoningSupport) {
    return {
      vision: lmStudioModel?.capabilities?.vision === true,
      toolUse: lmStudioModel?.capabilities?.trained_for_tool_use === true,
      reasoning: lmStudioReasoningSupport?.supportsEffort === true,
    }
  }

  return inferNonLmStudioCapabilities(model)
}
