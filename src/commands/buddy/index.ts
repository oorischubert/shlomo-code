import type { Command } from '../../commands.js'

const buddy = {
  type: 'local-jsx',
  name: 'buddy',
  description: 'Hatch or interact with your buddy',
  immediate: true,
  argumentHint: '[pet|hide]',
  load: () => import('./buddy.js'),
} satisfies Command

export default buddy
