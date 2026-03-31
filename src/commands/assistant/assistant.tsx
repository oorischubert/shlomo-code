import { homedir } from 'os'
import { join } from 'path'
import React, { useEffect } from 'react'
import { Box, Text } from '../../ink.js'

type Props = {
  defaultDir: string
  onInstalled: (dir: string) => void
  onCancel: () => void
  onError: (message: string) => void
}

export async function computeDefaultInstallDir(): Promise<string> {
  return join(homedir(), '.shlomo-assistant')
}

export function NewInstallWizard({
  defaultDir,
  onCancel,
}: Props): React.ReactNode {
  useEffect(() => {
    onCancel()
  }, [onCancel])

  return (
    <Box flexDirection="column" paddingX={1}>
      <Text>Assistant install flow is unavailable in this build.</Text>
      <Text dimColor>{defaultDir}</Text>
    </Box>
  )
}
