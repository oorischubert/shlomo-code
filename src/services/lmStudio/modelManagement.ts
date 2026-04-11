import {
  getLmStudioApiKey,
  getLmStudioBaseUrl,
  isLmStudioRestartRecoveryErrorMessage,
  LM_STUDIO_RESTART_RECOVERY_DELAY_MS,
  LM_STUDIO_RESTART_RECOVERY_RETRIES,
} from '../../utils/lmStudio.js'
import { sleep } from '../../utils/sleep.js'

export type LmStudioModelType = 'llm' | 'embedding'

export type LmStudioModelInstance = {
  id: string
  config?: {
    context_length?: number
    eval_batch_size?: number
    flash_attention?: boolean
    num_experts?: number
    offload_kv_cache_to_gpu?: boolean
  }
}

export type LmStudioModel = {
  type: LmStudioModelType
  publisher: string
  key: string
  display_name: string
  loaded_instances: LmStudioModelInstance[]
  context_length?: number
  max_context_length?: number
  capabilities?: {
    vision?: boolean
    trained_for_tool_use?: boolean
  }
  reasoning?:
    | boolean
    | {
        effort?:
          | boolean
          | string[]
          | {
              supported?: boolean
              values?: string[]
              options?: string[]
              enum?: string[]
            }
        reasoning_effort?:
          | boolean
          | string[]
          | {
              supported?: boolean
              values?: string[]
              options?: string[]
              enum?: string[]
            }
        supported?: boolean
        values?: string[]
        options?: string[]
        enum?: string[]
      }
}

type LmStudioModelsResponse = {
  models?: LmStudioModel[]
}

type LmStudioLoadResponse = {
  type: LmStudioModelType
  instance_id: string
  load_time_seconds: number
  status: 'loaded'
}

type LmStudioUnloadResponse = {
  instance_id: string
}

export type LoadedLmStudioInstance = {
  type: LmStudioModelType
  modelKey: string
  displayName: string
  instanceId: string
}

export type SwitchLmStudioModelResult = {
  modelKey: string
  displayName: string
  unloadedInstanceIds: string[]
  loadedInstanceId: string | null
  alreadyLoaded: boolean
}

const LM_STUDIO_UNLOAD_POLL_INTERVAL_MS = 250
const LM_STUDIO_UNLOAD_TIMEOUT_MS = 15_000
const DEFAULT_LM_STUDIO_EFFORT_LEVELS = ['low', 'medium', 'high', 'max'] as const

type LmStudioReasoningSupport = {
  supportsEffort: boolean
  supportsMaxEffort: boolean
  effortLevels: string[]
}

const lmStudioReasoningSupportCache = new Map<string, LmStudioReasoningSupport>()
const lmStudioModelCache = new Map<string, LmStudioModel>()

export function getLmStudioRestBaseUrl(): string {
  return `${getLmStudioBaseUrl().replace(/\/v1\/?$/, '')}/api/v1`
}

function normalizeModelCacheKey(value: string): string {
  return value.trim().toLowerCase()
}

function cacheLmStudioModels(models: LmStudioModel[]): void {
  lmStudioModelCache.clear()

  for (const model of models) {
    lmStudioModelCache.set(normalizeModelCacheKey(model.key), model)

    if (model.display_name) {
      lmStudioModelCache.set(
        normalizeModelCacheKey(model.display_name),
        model,
      )
    }
  }
}

function getPositiveInteger(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? Math.trunc(value)
    : undefined
}

function normalizeReasoningLevels(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .filter((item): item is string => typeof item === 'string')
      .map(item => item.toLowerCase())
  }
  return []
}

function pickReasoningLevels(...candidates: unknown[]): string[] {
  for (const candidate of candidates) {
    const levels = normalizeReasoningLevels(candidate)
    if (levels.length > 0) {
      return levels
    }
  }
  return []
}

function parseReasoningEffort(
  value: unknown,
): Pick<LmStudioReasoningSupport, 'supportsEffort' | 'effortLevels'> {
  if (typeof value === 'boolean') {
    return {
      supportsEffort: value,
      effortLevels: value ? [...DEFAULT_LM_STUDIO_EFFORT_LEVELS] : [],
    }
  }

  if (Array.isArray(value)) {
    const effortLevels = normalizeReasoningLevels(value)
    return {
      supportsEffort: effortLevels.length > 0,
      effortLevels,
    }
  }

  if (value && typeof value === 'object') {
    const record = value as {
      supported?: unknown
      values?: unknown
      options?: unknown
      enum?: unknown
    }
    const effortLevels = pickReasoningLevels(
      record.values,
      record.options,
      record.enum,
    )
    const levels =
      effortLevels.length > 0
        ? effortLevels
        : record.supported === true
          ? [...DEFAULT_LM_STUDIO_EFFORT_LEVELS]
          : []
    return {
      supportsEffort: record.supported === true || levels.length > 0,
      effortLevels: levels,
    }
  }

  return {
    supportsEffort: false,
    effortLevels: [],
  }
}

function getReasoningSupportForModel(model: LmStudioModel): LmStudioReasoningSupport {
  const reasoning = model.reasoning

  if (typeof reasoning === 'boolean') {
    return {
      supportsEffort: reasoning,
      supportsMaxEffort: reasoning,
      effortLevels: reasoning ? [...DEFAULT_LM_STUDIO_EFFORT_LEVELS] : [],
    }
  }

  if (reasoning && typeof reasoning === 'object') {
    const record = reasoning as Record<string, unknown>
    const effortSupport = parseReasoningEffort(
      record.effort ?? record.reasoning_effort ?? reasoning,
    )
    const topLevelLevels = pickReasoningLevels(
      record.values,
      record.options,
      record.enum,
    )
    const effortLevels =
      effortSupport.effortLevels.length > 0
        ? effortSupport.effortLevels
        : topLevelLevels.length > 0
          ? topLevelLevels
          : effortSupport.supportsEffort
            ? [...DEFAULT_LM_STUDIO_EFFORT_LEVELS]
            : []

    return {
      supportsEffort:
        effortSupport.supportsEffort || record.supported === true,
      supportsMaxEffort:
        effortLevels.includes('max') ||
        (record.supported === true && effortLevels.length === 0),
      effortLevels,
    }
  }

  return {
    supportsEffort: false,
    supportsMaxEffort: false,
    effortLevels: [],
  }
}

function updateLmStudioReasoningSupportCache(models: LmStudioModel[]): void {
  lmStudioReasoningSupportCache.clear()
  for (const model of models) {
    const support = getReasoningSupportForModel(model)
    lmStudioReasoningSupportCache.set(model.key.toLowerCase(), support)
    lmStudioReasoningSupportCache.set(model.display_name.toLowerCase(), support)
  }
}

export function getCachedLmStudioReasoningSupport(
  model: string,
): LmStudioReasoningSupport | undefined {
  return lmStudioReasoningSupportCache.get(model.toLowerCase())
}

export function getCachedLmStudioModel(
  model: string,
): LmStudioModel | undefined {
  return lmStudioModelCache.get(normalizeModelCacheKey(model))
}

export function getCachedLmStudioContextWindow(
  model: string,
): number | undefined {
  const metadata = getCachedLmStudioModel(model)
  if (!metadata) {
    return undefined
  }

  for (const instance of metadata.loaded_instances ?? []) {
    const loadedContext = getPositiveInteger(instance.config?.context_length)
    if (loadedContext) {
      return loadedContext
    }
  }

  return (
    getPositiveInteger(metadata.context_length) ??
    getPositiveInteger(metadata.max_context_length)
  )
}

function getLmStudioRequestHeaders(): HeadersInit {
  return {
    Authorization: `Bearer ${getLmStudioApiKey()}`,
    'Content-Type': 'application/json',
  }
}

async function getErrorMessage(response: Response): Promise<string> {
  try {
    const payload = (await response.json()) as {
      error?: { message?: string; type?: string }
      message?: string
    }
    return (
      payload.error?.message ||
      payload.message ||
      `${response.status} ${response.statusText}`.trim()
    )
  } catch {
    const text = await response.text()
    return text || `${response.status} ${response.statusText}`.trim()
  }
}

async function requestLmStudioJson<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  let lastError: Error | null = null

  for (
    let attempt = 0;
    attempt < LM_STUDIO_RESTART_RECOVERY_RETRIES;
    attempt++
  ) {
    try {
      const response = await fetch(`${getLmStudioRestBaseUrl()}${path}`, {
        ...init,
        headers: {
          ...getLmStudioRequestHeaders(),
          ...(init?.headers ?? {}),
        },
      })

      if (!response.ok) {
        const message = await getErrorMessage(response)
        if (
          attempt < LM_STUDIO_RESTART_RECOVERY_RETRIES - 1 &&
          isLmStudioRestartRecoveryErrorMessage(message)
        ) {
          await sleep(LM_STUDIO_RESTART_RECOVERY_DELAY_MS)
          continue
        }
        throw new Error(message)
      }

      return (await response.json()) as T
    } catch (error) {
      const wrappedError =
        error instanceof Error ? error : new Error(String(error))
      lastError = wrappedError
      if (
        attempt < LM_STUDIO_RESTART_RECOVERY_RETRIES - 1 &&
        isLmStudioRestartRecoveryErrorMessage(wrappedError.message)
      ) {
        await sleep(LM_STUDIO_RESTART_RECOVERY_DELAY_MS)
        continue
      }
      throw wrappedError
    }
  }

  throw lastError ?? new Error('Unknown LM Studio request failure')
}

export async function fetchLmStudioModels(): Promise<LmStudioModel[]> {
  const data = await requestLmStudioJson<LmStudioModelsResponse>('/models')
  const models = Array.isArray(data.models) ? data.models : []
  cacheLmStudioModels(models)
  updateLmStudioReasoningSupportCache(models)
  return models
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => {
    setTimeout(resolve, ms)
  })
}

export function getLoadedLmStudioInstances(
  models: LmStudioModel[],
  type: LmStudioModelType | 'all' = 'all',
): LoadedLmStudioInstance[] {
  return models.flatMap(model => {
    if (type !== 'all' && model.type !== type) {
      return []
    }

    return (model.loaded_instances ?? []).map(instance => ({
      type: model.type,
      modelKey: model.key,
      displayName: model.display_name,
      instanceId: instance.id,
    }))
  })
}

export async function unloadLmStudioInstance(
  instanceId: string,
): Promise<string> {
  const result = await requestLmStudioJson<LmStudioUnloadResponse>(
    '/models/unload',
    {
      method: 'POST',
      body: JSON.stringify({ instance_id: instanceId }),
    },
  )
  return result.instance_id
}

export async function loadLmStudioModel(modelKey: string): Promise<string> {
  const result = await requestLmStudioJson<LmStudioLoadResponse>(
    '/models/load',
    {
      method: 'POST',
      body: JSON.stringify({ model: modelKey }),
    },
  )
  return result.instance_id
}

export async function unloadAllLmStudioModels(): Promise<string[]> {
  const models = await fetchLmStudioModels()
  const loadedInstances = getLoadedLmStudioInstances(models, 'all')

  const unloadedInstanceIds: string[] = []
  for (const instance of loadedInstances) {
    unloadedInstanceIds.push(
      await unloadLmStudioInstance(instance.instanceId),
    )
  }

  return unloadedInstanceIds
}

async function refreshLmStudioModelsBestEffort(): Promise<void> {
  try {
    await fetchLmStudioModels()
  } catch {
    // Keep the successful user action even if the metadata refresh misses once.
  }
}

async function waitForInstancesToUnload(instanceIds: string[]): Promise<void> {
  if (instanceIds.length === 0) {
    return
  }

  const deadline = Date.now() + LM_STUDIO_UNLOAD_TIMEOUT_MS

  while (Date.now() < deadline) {
    const models = await fetchLmStudioModels()
    const loadedInstanceIds = new Set(
      getLoadedLmStudioInstances(models, 'all').map(instance => instance.instanceId),
    )

    const stillLoaded = instanceIds.some(instanceId =>
      loadedInstanceIds.has(instanceId),
    )

    if (!stillLoaded) {
      return
    }

    await sleep(LM_STUDIO_UNLOAD_POLL_INTERVAL_MS)
  }

  throw new Error(
    'Timed out waiting for LM Studio to unload the previous model',
  )
}

export async function switchLmStudioModel(
  requestedModel: string,
): Promise<SwitchLmStudioModelResult> {
  const models = await fetchLmStudioModels()
  const targetModel =
    models.find(model => model.key === requestedModel) ??
    models.find(model => model.display_name === requestedModel)

  const modelKey = targetModel?.key ?? requestedModel
  const displayName = targetModel?.display_name ?? requestedModel

  const loadedInstances = getLoadedLmStudioInstances(models, 'all')
  const selectedInstances = loadedInstances.filter(
    instance => instance.modelKey === modelKey,
  )
  const instancesToUnload = loadedInstances.filter(
    instance => instance.modelKey !== modelKey,
  )

  const unloadedInstanceIds: string[] = []
  for (const instance of instancesToUnload) {
    unloadedInstanceIds.push(
      await unloadLmStudioInstance(instance.instanceId),
    )
  }

  await waitForInstancesToUnload(unloadedInstanceIds)

  if (selectedInstances.length > 0) {
    await refreshLmStudioModelsBestEffort()
    return {
      modelKey,
      displayName,
      unloadedInstanceIds,
      loadedInstanceId: selectedInstances[0]!.instanceId,
      alreadyLoaded: true,
    }
  }

  const loadedInstanceId = await loadLmStudioModel(modelKey)
  await refreshLmStudioModelsBestEffort()

  return {
    modelKey,
    displayName,
    unloadedInstanceIds,
    loadedInstanceId,
    alreadyLoaded: false,
  }
}
