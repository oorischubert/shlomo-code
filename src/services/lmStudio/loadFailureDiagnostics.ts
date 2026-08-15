import { execFileSync } from 'node:child_process'

const MIB = 1024 * 1024
const GIB = 1024 * 1024 * 1024

const NVIDIA_SMI_TIMEOUT_MS = 2_000

export type VramSnapshot = {
  totalBytes: number
  usedBytes: number
  freeBytes: number
}

/**
 * LM Studio's OpenAI-compat endpoint reports a failed JIT auto-load as:
 *   Failed to load model "qwen/qwen3.8-27b". Error: Failed to load model.
 *
 * The underlying cause (e.g. "unable to allocate CUDA0 buffer") is only
 * available over the CLI/SDK channel, never in the HTTP payload — so we
 * reconstruct the likely cause locally instead of parsing it out.
 *
 * The optional backslash handles the case where the SDK stringified the whole
 * response body into the message, leaving the quotes JSON-escaped.
 */
const LOAD_FAILURE_PATTERN = /Failed to load model \\?"([^"\\]+)/

export function parseLoadFailureModelKey(message: string): string | null {
  return LOAD_FAILURE_PATTERN.exec(message)?.[1] ?? null
}

/** Parses `nvidia-smi --format=csv,noheader,nounits` output (values in MiB). */
export function parseNvidiaSmiVram(stdout: string): VramSnapshot | null {
  const firstLine = stdout.split('\n')[0]?.trim()
  if (!firstLine) {
    return null
  }

  const values = firstLine.split(',').map(part => Number(part.trim()))
  if (values.length < 3 || values.some(value => !Number.isFinite(value))) {
    return null
  }

  const [total, used, free] = values as [number, number, number]
  return {
    totalBytes: total * MIB,
    usedBytes: used * MIB,
    freeBytes: free * MIB,
  }
}

function formatGiB(bytes: number): string {
  return `${(bytes / GIB).toFixed(1)} GiB`
}

export function buildLoadFailureDiagnostic({
  original,
  sizeBytes,
  vram,
}: {
  original: string
  modelKey: string
  sizeBytes: number | null
  vram: VramSnapshot | null
}): string {
  // Cold model cache: we cannot compare against the requirement, but free VRAM
  // is still the fact most likely to explain the failure.
  if (sizeBytes === null || sizeBytes <= 0) {
    if (!vram) {
      return original
    }
    return [
      original,
      `  Only ${formatGiB(vram.freeBytes)} VRAM free ` +
        `(${formatGiB(vram.usedBytes)} in use by other processes).`,
    ].join('\n')
  }

  if (vram && vram.freeBytes < sizeBytes) {
    return [
      original,
      `  Model requires ${formatGiB(sizeBytes)}; only ${formatGiB(vram.freeBytes)} VRAM free ` +
        `(${formatGiB(vram.usedBytes)} in use by other processes).`,
      '  Free VRAM or reduce GPU offload.',
    ].join('\n')
  }

  return [
    original,
    `  Model requires ${formatGiB(sizeBytes)} of VRAM to load.`,
  ].join('\n')
}

/** Best-effort VRAM probe. Returns null on non-NVIDIA hosts or any failure. */
export function probeVramSync(): VramSnapshot | null {
  try {
    const stdout = execFileSync(
      'nvidia-smi',
      [
        '--query-gpu=memory.total,memory.used,memory.free',
        '--format=csv,noheader,nounits',
      ],
      { timeout: NVIDIA_SMI_TIMEOUT_MS, encoding: 'utf8', stdio: 'pipe' },
    )
    return parseNvidiaSmiVram(stdout)
  } catch {
    return null
  }
}

/**
 * Enriches an LM Studio model-load failure with a locally-computed resource
 * diagnostic. Unrelated errors pass through untouched, and the VRAM probe is
 * only run once we know this is a load failure worth explaining.
 */
export function augmentLmStudioLoadFailure(
  message: string,
  deps: {
    lookupSizeBytes: (modelKey: string) => number | null
    probeVram: () => VramSnapshot | null
  },
): string {
  const modelKey = parseLoadFailureModelKey(message)
  if (!modelKey) {
    return message
  }

  let sizeBytes: number | null = null
  try {
    sizeBytes = deps.lookupSizeBytes(modelKey)
  } catch {
    sizeBytes = null
  }

  let vram: VramSnapshot | null = null
  try {
    vram = deps.probeVram()
  } catch {
    vram = null
  }

  return buildLoadFailureDiagnostic({
    original: message,
    modelKey,
    sizeBytes,
    vram,
  })
}
