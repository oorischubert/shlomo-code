import { feature } from 'bun:bundle'
import * as React from 'react'
import { useSyncExternalStore } from 'react'
import { Box, Text } from '../ink.js'
import { getFeatureValue_CACHED_MAY_BE_STALE } from '../services/analytics/growthbook.js'
import {
  calculateTokenWarningState,
  getAutoCompactThreshold,
  getEffectiveContextWindowSize,
  isAutoCompactEnabled,
} from '../services/compact/autoCompact.js'
import { useCompactWarningSuppression } from '../services/compact/compactWarningHook.js'
import { getUpgradeMessage } from '../utils/model/contextWindowUpgradeCheck.js'

type Props = {
  tokenUsage: number
  model: string
}

function CollapseLabel({
  upgradeMessage,
}: {
  upgradeMessage: string | null
}): React.ReactNode {
  const { getStats, subscribe } =
    require('../services/contextCollapse/index.js') as typeof import('../services/contextCollapse/index.js')

  const snapshot = useSyncExternalStore(subscribe, () => {
    const stats = getStats()
    const idleWarn = stats.health.emptySpawnWarningEmitted ? 1 : 0
    return [
      stats.collapsedSpans,
      stats.stagedSpans,
      stats.health.totalErrors,
      stats.health.totalEmptySpawns,
      idleWarn,
    ].join('|')
  })

  const [collapsed, staged, errors, emptySpawns, idleWarn] = snapshot
    .split('|')
    .map(Number) as [number, number, number, number, number]

  const total = collapsed + staged

  if (errors > 0 || idleWarn > 0) {
    const problem =
      errors > 0
        ? `collapse errors: ${errors}`
        : `collapse idle (${emptySpawns} empty runs)`
    const label = total > 0 ? `${collapsed} / ${total} summarized · ${problem}` : problem
    return (
      <Text color="warning" wrap="truncate">
        {label}
      </Text>
    )
  }

  if (total === 0) {
    return null
  }

  const label = `${collapsed} / ${total} summarized`

  return (
    <Text dimColor wrap="truncate">
      {upgradeMessage ? `${label} · ${upgradeMessage}` : label}
    </Text>
  )
}

export function TokenWarning({ tokenUsage, model }: Props): React.ReactNode {
  const {
    percentLeft,
    isAboveWarningThreshold,
    isAboveErrorThreshold,
    isAboveAutoCompactThreshold,
  } = calculateTokenWarningState(tokenUsage, model)
  const suppressWarning = useCompactWarningSuppression()

  if (!isAboveWarningThreshold || suppressWarning) {
    return null
  }

  const showAutoCompactWarning = isAutoCompactEnabled()
  const upgradeMessage = getUpgradeMessage('warning')

  let reactiveOnlyMode = false
  let collapseMode = false

  if (feature('REACTIVE_COMPACT')) {
    if (getFeatureValue_CACHED_MAY_BE_STALE('tengu_cobalt_raccoon', false)) {
      reactiveOnlyMode = true
    }
  }

  if (feature('CONTEXT_COLLAPSE')) {
    const { isContextCollapseEnabled } =
      require('../services/contextCollapse/index.js') as typeof import('../services/contextCollapse/index.js')

    if (isContextCollapseEnabled()) {
      collapseMode = true
    }
  }

  if (collapseMode && feature('CONTEXT_COLLAPSE')) {
    return (
      <Box flexDirection="row">
        <CollapseLabel upgradeMessage={upgradeMessage} />
      </Box>
    )
  }

  let compactLabel: string

  if (reactiveOnlyMode) {
    const effectiveWindow = getEffectiveContextWindowSize(model)
    const usedPercent = Math.max(
      0,
      Math.min(100, Math.round((tokenUsage / effectiveWindow) * 100)),
    )
    compactLabel = `${usedPercent}% context used`
  } else if (isAboveAutoCompactThreshold) {
    compactLabel = 'Auto-compact pending on next turn'
  } else {
    const tokensUntilAutoCompact = Math.max(
      0,
      getAutoCompactThreshold(model) - tokenUsage,
    )
    compactLabel = `Auto-compact in ~${tokensUntilAutoCompact.toLocaleString()} tokens`
  }

  return (
    <Box flexDirection="row">
      {showAutoCompactWarning ? (
        <Text dimColor wrap="truncate">
          {upgradeMessage ? `${compactLabel} · ${upgradeMessage}` : compactLabel}
        </Text>
      ) : (
        <Text color={isAboveErrorThreshold ? 'error' : 'warning'} wrap="truncate">
          {upgradeMessage
            ? `Context low (${percentLeft}% remaining) · ${upgradeMessage}`
            : `Context low (${percentLeft}% remaining) · Run /compact to compact & continue`}
        </Text>
      )}
    </Box>
  )
}
