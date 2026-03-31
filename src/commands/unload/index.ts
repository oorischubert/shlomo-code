import type { Command } from '../../commands.js'

export default {
  name: 'unload',
  description: 'Unload all currently loaded LM Studio models',
  supportsNonInteractive: false,
  type: 'local',
  immediate: true,
  load: () => import('./unload.js'),
} satisfies Command
