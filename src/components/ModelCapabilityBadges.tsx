import * as React from 'react'
import { Text } from '../ink.js'
import { getDisplayModelCapabilities } from '../utils/model/modelCapabilitiesDisplay.js'

type ModelCapabilityBadgesProps = {
  model: string | null
}

const VISION_BADGE_COLOR = 'rgb(251,188,4)'
const TOOL_BADGE_COLOR = 'rgb(59,130,246)'
const REASONING_BADGE_COLOR = 'rgb(34,197,94)'

export function ModelCapabilityBadges({
  model,
}: ModelCapabilityBadgesProps): React.ReactNode {
  const capabilities = getDisplayModelCapabilities(model)

  if (!capabilities) {
    return null
  }

  return (
    <>
      {capabilities.vision ? (
        <Text color={VISION_BADGE_COLOR}>[V]</Text>
      ) : null}
      {capabilities.toolUse ? (
        <Text color={TOOL_BADGE_COLOR}>[T]</Text>
      ) : null}
      {capabilities.reasoning ? (
        <Text color={REASONING_BADGE_COLOR}>[R]</Text>
      ) : null}
    </>
  )
}
