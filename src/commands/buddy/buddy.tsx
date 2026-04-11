import type { ToolUseContext } from '../../Tool.js'
import { getCompanion } from '../../buddy/companion.js'
import { hatchCompanion } from '../../buddy/hatch.js'
import type {
  LocalJSXCommandContext,
  LocalJSXCommandOnDone,
} from '../../types/command.js'
import { getGlobalConfig, saveGlobalConfig } from '../../utils/config.js'

const USAGE = `Usage: /buddy [pet|hide]
  /buddy      — hatch, wake up, or greet your buddy
  /buddy pet  — pet your buddy (wakes them up if hidden)
  /buddy hide — hide and mute your buddy`

export async function call(
  onDone: LocalJSXCommandOnDone,
  context: ToolUseContext & LocalJSXCommandContext,
  args: string,
): Promise<null> {
  const trimmed = args.trim().toLowerCase()

  switch (trimmed) {
    case '':
      return handleDefault(onDone, context)
    case 'pet':
      return handlePet(onDone, context)
    case 'hide':
      return handleOff(onDone, context)
    case 'kill':
      return handleKill(onDone, context)
    default:
      onDone(USAGE, { display: 'system' })
      return null
  }
}

async function handleDefault(
  onDone: LocalJSXCommandOnDone,
  context: ToolUseContext & LocalJSXCommandContext,
): Promise<null> {
  const config = getGlobalConfig()

  if (!config.companion) {
    // First time — hatch
    return handleHatch(onDone, context)
  }

  // Companion exists but is muted — turn back on
  if (config.companionMuted) {
    saveGlobalConfig(cfg => ({
      ...cfg,
      companionMuted: false,
    }))
    const companion = getCompanion()
    onDone(`${companion?.name ?? 'Companion'} is back!`, { display: 'system' })
    return null
  }

  // Already on — greet
  const companion = getCompanion()
  onDone(`${companion?.name ?? 'Companion'} is already here!`, {
    display: 'system',
  })
  return null
}

async function handleHatch(
  onDone: LocalJSXCommandOnDone,
  context: ToolUseContext & LocalJSXCommandContext,
): Promise<null> {
  const stored = await hatchCompanion(context)

  onDone(
    `A ${stored.species ?? 'creature'} hatched! Meet ${stored.name}: "${stored.personality}"`,
    { display: 'system' },
  )
  return null
}

async function handlePet(
  onDone: LocalJSXCommandOnDone,
  context: ToolUseContext & LocalJSXCommandContext,
): Promise<null> {
  const config = getGlobalConfig()

  if (!config.companion) {
    onDone('No buddy to pet! Run /buddy to hatch one.', {
      display: 'system',
    })
    return null
  }

  const wasHidden = config.companionMuted

  // Wake up if muted
  if (wasHidden) {
    saveGlobalConfig(cfg => ({
      ...cfg,
      companionMuted: false,
    }))
  }

  // Set pet timestamp to trigger heart animation in CompanionSprite
  context.setAppState(prev => ({
    ...prev,
    companionPetAt: Date.now(),
  }))

  if (wasHidden) {
    const companion = getCompanion()
    onDone(`${companion?.name ?? 'Buddy'} is back!`, { display: 'system' })
  } else {
    // Pet is UI-only, no transcript noise
    onDone(undefined, { display: 'skip' })
  }
  return null
}

function handleKill(
  onDone: LocalJSXCommandOnDone,
  context: ToolUseContext & LocalJSXCommandContext,
): null {
  const companion = getCompanion()
  const name = companion?.name ?? 'Companion'

  saveGlobalConfig(config => {
    const { companion: _removed, ...rest } = config
    return { ...rest, companionMuted: false }
  })

  context.setAppState(prev => ({
    ...prev,
    companionReaction: undefined,
    companionPetAt: undefined,
  }))

  onDone(`${name} has withered away...`, { display: 'system' })
  return null
}

function handleOff(
  onDone: LocalJSXCommandOnDone,
  context: ToolUseContext & LocalJSXCommandContext,
): null {
  const config = getGlobalConfig()

  if (!config.companion) {
    onDone('No buddy to hide! Run /buddy to hatch one.', {
      display: 'system',
    })
    return null
  }

  const companion = getCompanion()
  const name = companion?.name ?? 'Companion'

  if (config.companionMuted) {
    onDone(`${name} hiding. Use /buddy to bring them back.`, {
      display: 'system',
    })
    return null
  }

  saveGlobalConfig(cfg => ({
    ...cfg,
    companionMuted: true,
  }))

  context.setAppState(prev => ({
    ...prev,
    companionReaction: undefined,
  }))

  onDone(`${name} hidden. Use /buddy to bring them back.`, {
    display: 'system',
  })
  return null
}
