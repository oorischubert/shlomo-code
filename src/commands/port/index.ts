import type { Command } from '../../commands.js'

export default {
  name: 'port',
  description: 'Set the LM Studio localhost port',
  argumentHint: '[number|reset|status]',
  supportsNonInteractive: false,
  type: 'local',
  immediate: true,
  load: () => import('./port.js'),
} satisfies Command
