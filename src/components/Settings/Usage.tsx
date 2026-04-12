import * as React from 'react'
import { useEffect, useState } from 'react'
import { extraUsage as extraUsageCommand } from 'src/commands/extra-usage/index.js'
import { formatCost } from 'src/cost-tracker.js'
import { useMainLoopModel } from 'src/hooks/useMainLoopModel.js'
import type { LocalJSXCommandContext } from 'src/types/command.js'
import { getSubscriptionType } from 'src/utils/auth.js'
import { getContextWindowForModel } from 'src/utils/context.js'
import { modelDisplayString } from 'src/utils/model/model.js'
import { useTerminalSize } from '../../hooks/useTerminalSize.js'
import { Box, Text } from '../../ink.js'
import { useKeybinding } from '../../keybindings/useKeybinding.js'
import {
  type ExtraUsage,
  fetchUtilization,
  type RateLimit,
  type Utilization,
} from '../../services/api/usage.js'
import {
  fetchLmStudioModels,
  getCachedLmStudioModel,
} from '../../services/lmStudio/modelManagement.js'
import { formatResetText } from '../../utils/format.js'
import { logError } from '../../utils/log.js'
import { jsonStringify } from '../../utils/slowOperations.js'
import { ConfigurableShortcutHint } from '../ConfigurableShortcutHint.js'
import { Byline } from '../design-system/Byline.js'
import { ProgressBar } from '../design-system/ProgressBar.js'
import {
  isEligibleForOverageCreditGrant,
  OverageCreditUpsell,
} from '../LogoV2/OverageCreditUpsell.js'

type LimitBarProps = {
  title: string
  limit: RateLimit
  maxWidth: number
  showTimeInReset?: boolean
  extraSubtext?: string
}

function LimitBar({
  title,
  limit,
  maxWidth,
  showTimeInReset = true,
  extraSubtext,
}: LimitBarProps): React.ReactNode {
  const { utilization, resets_at } = limit

  if (utilization === null) {
    return null
  }

  const usedText = `${Math.floor(utilization)}% used`
  let subtext = resets_at
    ? `Resets ${formatResetText(resets_at, true, showTimeInReset)}`
    : undefined

  if (extraSubtext) {
    subtext = subtext ? `${extraSubtext} · ${subtext}` : extraSubtext
  }

  const ratio = utilization / 100

  if (maxWidth >= 62) {
    return (
      <Box flexDirection="column">
        <Text bold>{title}</Text>
        <Box flexDirection="row" gap={1}>
          <ProgressBar
            ratio={ratio}
            width={50}
            fillColor="rate_limit_fill"
            emptyColor="rate_limit_empty"
          />
          <Text>{usedText}</Text>
        </Box>
        {subtext ? <Text dimColor>{subtext}</Text> : null}
      </Box>
    )
  }

  return (
    <Box flexDirection="column">
      <Text>
        <Text bold>{title}</Text>
        {subtext ? (
          <>
            <Text> </Text>
            <Text dimColor>· {subtext}</Text>
          </>
        ) : null}
      </Text>
      <ProgressBar
        ratio={ratio}
        width={maxWidth}
        fillColor="rate_limit_fill"
        emptyColor="rate_limit_empty"
      />
      <Text>{usedText}</Text>
    </Box>
  )
}

type ContextUsageSectionProps = {
  model: string
  contextLimit: number
  maxContextWindow?: number
  sourceLabel: string
}

function getPositiveInteger(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? Math.trunc(value)
    : undefined
}

function getContextWindowDetails(model: string): {
  contextLimit: number
  maxContextWindow?: number
  sourceLabel: string
} {
  const lmStudioModel = getCachedLmStudioModel(model)
  const loadedContextWindow = lmStudioModel?.loaded_instances
    ?.map(instance => getPositiveInteger(instance.config?.context_length))
    .find((value): value is number => typeof value === 'number')
  const modelContextWindow = getPositiveInteger(lmStudioModel?.context_length)
  const maxContextWindow = getPositiveInteger(lmStudioModel?.max_context_length)
  const resolvedContextWindow = getContextWindowForModel(model)

  if (loadedContextWindow) {
    return {
      contextLimit: loadedContextWindow,
      maxContextWindow,
      sourceLabel: 'loaded LM Studio limit',
    }
  }

  if (modelContextWindow) {
    return {
      contextLimit: modelContextWindow,
      maxContextWindow,
      sourceLabel: 'model limit',
    }
  }

  if (maxContextWindow) {
    return {
      contextLimit: maxContextWindow,
      maxContextWindow,
      sourceLabel: 'model max',
    }
  }

  return {
    contextLimit: resolvedContextWindow,
    maxContextWindow,
    sourceLabel: 'configured limit',
  }
}

function formatTokenCount(tokens: number): string {
  return `${tokens.toLocaleString()} tokens`
}

function ContextUsageSection({
  model,
  contextLimit,
  maxContextWindow,
  sourceLabel,
}: ContextUsageSectionProps): React.ReactNode {
  const modelMaxLabel =
    typeof maxContextWindow === 'number' && maxContextWindow > 0
      ? formatTokenCount(maxContextWindow)
      : null

  return (
    <Box flexDirection="column" gap={1}>
      <Text bold>Context window</Text>
      <Text>Model: {modelDisplayString(model)}</Text>
      <Text>{formatTokenCount(contextLimit)}</Text>
      <Text dimColor>Using {sourceLabel}</Text>
      {modelMaxLabel && maxContextWindow !== contextLimit ? (
        <Text dimColor>Model max: {modelMaxLabel}</Text>
      ) : null}
    </Box>
  )
}

type ExtraUsageSectionProps = {
  extraUsage: ExtraUsage
  maxWidth: number
}

const EXTRA_USAGE_SECTION_TITLE = 'Extra usage'

function ExtraUsageSection({
  extraUsage,
  maxWidth,
}: ExtraUsageSectionProps): React.ReactNode {
  const subscriptionType = getSubscriptionType()
  const isProOrMax = subscriptionType === 'pro' || subscriptionType === 'max'

  if (!isProOrMax) {
    return null
  }

  if (!extraUsage.is_enabled) {
    if (!extraUsageCommand.isEnabled()) {
      return null
    }

    return (
      <Box flexDirection="column">
        <Text bold>{EXTRA_USAGE_SECTION_TITLE}</Text>
        <Text dimColor>Extra usage not enabled · /extra-usage to enable</Text>
      </Box>
    )
  }

  if (extraUsage.monthly_limit === null) {
    return (
      <Box flexDirection="column">
        <Text bold>{EXTRA_USAGE_SECTION_TITLE}</Text>
        <Text dimColor>Unlimited</Text>
      </Box>
    )
  }

  if (
    typeof extraUsage.used_credits !== 'number' ||
    typeof extraUsage.utilization !== 'number'
  ) {
    return null
  }

  const formattedUsedCredits = formatCost(extraUsage.used_credits / 100, 2)
  const formattedMonthlyLimit = formatCost(extraUsage.monthly_limit / 100, 2)
  const now = new Date()
  const oneMonthReset = new Date(now.getFullYear(), now.getMonth() + 1, 1)

  return (
    <LimitBar
      title={EXTRA_USAGE_SECTION_TITLE}
      limit={{
        utilization: extraUsage.utilization,
        resets_at: oneMonthReset.toISOString(),
      }}
      maxWidth={maxWidth}
      showTimeInReset={false}
      extraSubtext={`${formattedUsedCredits} / ${formattedMonthlyLimit}`}
    />
  )
}

type Props = {
  context: LocalJSXCommandContext
}

export function Usage({ context: _context }: Props): React.ReactNode {
  const [utilization, setUtilization] = useState<Utilization | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const mainLoopModel = useMainLoopModel()
  const { columns } = useTerminalSize()
  const availableWidth = Math.max(20, columns - 2)
  const maxWidth = Math.min(availableWidth, 80)
  const [contextWindowDetails, setContextWindowDetails] = useState(() =>
    getContextWindowDetails(mainLoopModel),
  )

  const loadUtilization = React.useCallback(async () => {
    setIsLoading(true)
    setError(null)
    setUtilization(null)

    try {
      const data = await fetchUtilization()
      setUtilization(data)
    } catch (err) {
      logError(err as Error)
      const axiosError = err as { response?: { data?: unknown } }
      const responseBody = axiosError.response?.data
        ? jsonStringify(axiosError.response.data)
        : undefined
      setError(
        responseBody
          ? `Failed to load plan usage: ${responseBody}`
          : 'Failed to load plan usage',
      )
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadUtilization()
  }, [loadUtilization])

  useEffect(() => {
    let isCancelled = false
    setContextWindowDetails(getContextWindowDetails(mainLoopModel))

    void (async () => {
      try {
        await fetchLmStudioModels()
      } catch {
        // Keep the best cached metadata already available in the UI.
      }

      if (!isCancelled) {
        setContextWindowDetails(getContextWindowDetails(mainLoopModel))
      }
    })()

    return () => {
      isCancelled = true
    }
  }, [mainLoopModel])

  useKeybinding(
    'settings:retry',
    () => {
      void loadUtilization()
    },
    {
      context: 'Settings',
      isActive: !!error && !isLoading,
    },
  )

  const subscriptionType = getSubscriptionType()
  const showSonnetBar =
    subscriptionType === 'max' ||
    subscriptionType === 'team' ||
    subscriptionType === null

  const limits = utilization
    ? [
        {
          title: 'Current session',
          limit: utilization.five_hour,
        },
        {
          title: 'Current week (all models)',
          limit: utilization.seven_day,
        },
        ...(showSonnetBar
          ? [
              {
                title: 'Current week (Sonnet only)',
                limit: utilization.seven_day_sonnet,
              },
            ]
          : []),
      ]
    : []

  return (
    <Box flexDirection="column" gap={1} width="100%">
      <ContextUsageSection
        model={mainLoopModel}
        contextLimit={contextWindowDetails.contextLimit}
        maxContextWindow={contextWindowDetails.maxContextWindow}
        sourceLabel={contextWindowDetails.sourceLabel}
      />

      {isLoading ? <Text dimColor>Loading plan usage…</Text> : null}

      {!isLoading && error ? (
        <Box flexDirection="column" gap={1}>
          <Text color="warning">{error}</Text>
          <Text dimColor>
            <Byline>
              <ConfigurableShortcutHint
                action="settings:retry"
                context="Settings"
                fallback="r"
                description="retry"
              />
              <ConfigurableShortcutHint
                action="confirm:no"
                context="Settings"
                fallback="Esc"
                description="cancel"
              />
            </Byline>
          </Text>
        </Box>
      ) : null}

      {!isLoading
        ? limits.map(({ title, limit }) =>
            limit ? (
              <LimitBar
                key={title}
                title={title}
                limit={limit}
                maxWidth={maxWidth}
              />
            ) : null,
          )
        : null}

      {!isLoading && utilization?.extra_usage ? (
        <ExtraUsageSection
          extraUsage={utilization.extra_usage}
          maxWidth={maxWidth}
        />
      ) : null}

      {!isLoading && isEligibleForOverageCreditGrant() ? (
        <OverageCreditUpsell maxWidth={maxWidth} />
      ) : null}

      <Text dimColor>
        <ConfigurableShortcutHint
          action="confirm:no"
          context="Settings"
          fallback="Esc"
          description="cancel"
        />
      </Text>
    </Box>
  )
}
