import {
  getLmStudioApiKey,
  getLmStudioBaseUrl,
} from '../../utils/lmStudio.js'

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
  capabilities?: {
    vision?: boolean
    trained_for_tool_use?: boolean
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

export function getLmStudioRestBaseUrl(): string {
  return `${getLmStudioBaseUrl().replace(/\/v1\/?$/, '')}/api/v1`
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
  const response = await fetch(`${getLmStudioRestBaseUrl()}${path}`, {
    ...init,
    headers: {
      ...getLmStudioRequestHeaders(),
      ...(init?.headers ?? {}),
    },
  })

  if (!response.ok) {
    throw new Error(await getErrorMessage(response))
  }

  return (await response.json()) as T
}

export async function fetchLmStudioModels(): Promise<LmStudioModel[]> {
  const data = await requestLmStudioJson<LmStudioModelsResponse>('/models')
  return Array.isArray(data.models) ? data.models : []
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
    return {
      modelKey,
      displayName,
      unloadedInstanceIds,
      loadedInstanceId: selectedInstances[0]!.instanceId,
      alreadyLoaded: true,
    }
  }

  return {
    modelKey,
    displayName,
    unloadedInstanceIds,
    loadedInstanceId: await loadLmStudioModel(modelKey),
    alreadyLoaded: false,
  }
}
