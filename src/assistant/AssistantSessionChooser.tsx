import React, { useEffect } from 'react'
import { Box, Text } from '../ink.js'

type Session = {
  id: string
}

type Props = {
  sessions: Session[]
  onSelect: (id: string) => void
  onCancel: () => void
}

export function AssistantSessionChooser({
  sessions,
  onCancel,
}: Props): React.ReactNode {
  useEffect(() => {
    onCancel()
  }, [onCancel])

  return (
    <Box flexDirection="column" paddingX={1}>
      <Text>Assistant session selection is unavailable in this build.</Text>
      <Text dimColor>{sessions.length} session(s) detected.</Text>
    </Box>
  )
}
