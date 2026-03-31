import { z } from 'zod/v4'
import { buildTool } from '../../Tool.js'
import { lazySchema } from '../../utils/lazySchema.js'

const inputSchema = lazySchema(() => z.strictObject({}).passthrough())
const outputSchema = lazySchema(() =>
  z.object({
    message: z.string(),
  }),
)

export const TungstenTool = buildTool({
  name: 'TungstenTool',
  searchHint: 'unavailable in this build',
  maxResultSizeChars: 10_000,
  get inputSchema() {
    return inputSchema()
  },
  get outputSchema() {
    return outputSchema()
  },
  isEnabled() {
    return false
  },
  isConcurrencySafe() {
    return true
  },
  async description() {
    return 'Unavailable in this build'
  },
  async prompt() {
    return 'Unavailable in this build'
  },
  renderToolUseMessage() {
    return null
  },
  renderToolResultMessage() {
    return null
  },
  mapToolResultToToolResultBlockParam(output, toolUseID) {
    return {
      tool_use_id: toolUseID,
      type: 'tool_result',
      content: output.message,
    }
  },
  async call() {
    return {
      data: {
        message: 'Tungsten is unavailable in this build.',
      },
    }
  },
})
