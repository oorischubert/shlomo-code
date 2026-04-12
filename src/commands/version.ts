import type { Command, LocalCommandCall } from '../types/command.js'
import { SHLOMO_TUI_VERSION } from '../utils/displayVersion.js'

const call: LocalCommandCall = async () => {
  return {
    type: 'text',
    value: MACRO.BUILD_TIME
      ? `${SHLOMO_TUI_VERSION} (built ${MACRO.BUILD_TIME})`
      : SHLOMO_TUI_VERSION,
  }
}

const version = {
  type: 'local',
  name: 'version',
  description:
    'Print the version this session is running (not what autoupdate downloaded)',
  isEnabled: () => process.env.USER_TYPE === 'ant',
  supportsNonInteractive: true,
  load: () => Promise.resolve({ call }),
} satisfies Command

export default version
