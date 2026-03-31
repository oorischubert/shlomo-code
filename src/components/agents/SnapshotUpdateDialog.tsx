import React, { useEffect } from 'react'
import { Box, Text } from '../../ink.js'
import type { AgentMemoryScope } from '../../tools/AgentTool/agentMemory.js'

type Props = {
  agentType: string
  scope: AgentMemoryScope
  snapshotTimestamp: string
  onComplete: (choice: 'merge' | 'keep' | 'replace') => void
  onCancel: () => void
}

export function buildMergePrompt(
  agentType: string,
  _scope: AgentMemoryScope,
): string {
  return [
    `The ${agentType} agent has a pending memory snapshot update.`,
    'Review and merge the changes manually if needed.',
  ].join(' ')
}

export function SnapshotUpdateDialog({
  agentType,
  snapshotTimestamp,
  onCancel,
}: Props): React.ReactNode {
  useEffect(() => {
    onCancel()
  }, [onCancel])

  return (
    <Box flexDirection="column" paddingX={1}>
      <Text>
        Snapshot updates for {agentType} are not available in this build.
      </Text>
      <Text dimColor>{snapshotTimestamp}</Text>
    </Box>
  )
}
