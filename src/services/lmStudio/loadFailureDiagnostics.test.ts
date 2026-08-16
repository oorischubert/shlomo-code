import { describe, expect, test } from 'bun:test'
import {
  augmentLmStudioLoadFailure,
  buildLoadFailureDiagnostic,
  parseConfiguredContextLength,
  parseLoadFailureModelKey,
  parseNvidiaSmiVram,
} from './loadFailureDiagnostics.js'

// The exact message LM Studio's OpenAI-compat endpoint returns when a JIT
// auto-load fails. Captured verbatim from localhost:1234/v1/chat/completions.
const REAL_FAILURE_MESSAGE =
  'Failed to load model "qwen/qwen3.8-27b". Error: Failed to load model.'

describe('parseLoadFailureModelKey', () => {
  test('extracts the model key from a real LM Studio load failure', () => {
    expect(parseLoadFailureModelKey(REAL_FAILURE_MESSAGE)).toBe(
      'qwen/qwen3.8-27b',
    )
  })

  // The SDK stringifies the whole response body into .message when there is no
  // top-level message, so quotes arrive backslash-escaped. This is the exact
  // string the TUI displayed.
  test('extracts the key from a stringified JSON body with escaped quotes', () => {
    const stringified =
      '400 {"type":"error","error":{"type":"invalid_request_error","message":"Failed to load model \\"qwen/qwen3.8-27b\\". Error: Failed to load model."}}'

    expect(parseLoadFailureModelKey(stringified)).toBe('qwen/qwen3.8-27b')
  })

  test('returns null for an unrelated API error', () => {
    expect(
      parseLoadFailureModelKey('Rate limit exceeded. Please try again later.'),
    ).toBeNull()
  })

  test('returns null when the message mentions a model but did not fail to load', () => {
    expect(
      parseLoadFailureModelKey('Model "qwen/qwen3.8-27b" is already loaded.'),
    ).toBeNull()
  })
})

describe('parseConfiguredContextLength', () => {
  // Real content of LM Studio's per-model default config, which is the only
  // place the configured context length is recorded.
  const REAL_CONFIG = JSON.stringify({
    preset: '',
    operation: { fields: [] },
    load: { fields: [{ key: 'llm.load.contextLength', value: 200000 }] },
  })

  test('reads the configured context length', () => {
    expect(parseConfiguredContextLength(REAL_CONFIG)).toBe(200000)
  })

  test('returns null when no context length field is present', () => {
    expect(
      parseConfiguredContextLength(
        JSON.stringify({ load: { fields: [{ key: 'llm.load.gpu', value: 1 }] } }),
      ),
    ).toBeNull()
  })

  test('returns null for malformed json', () => {
    expect(parseConfiguredContextLength('not json')).toBeNull()
  })
})

describe('parseNvidiaSmiVram', () => {
  test('parses real nvidia-smi csv,noheader,nounits output', () => {
    expect(parseNvidiaSmiVram('32607, 20933, 11168')).toEqual({
      totalBytes: 32607 * 1024 * 1024,
      usedBytes: 20933 * 1024 * 1024,
      freeBytes: 11168 * 1024 * 1024,
    })
  })

  test('uses the first GPU when several are present', () => {
    expect(parseNvidiaSmiVram('32607, 20933, 11168\n24564, 100, 24464')).toEqual(
      {
        totalBytes: 32607 * 1024 * 1024,
        usedBytes: 20933 * 1024 * 1024,
        freeBytes: 11168 * 1024 * 1024,
      },
    )
  })

  test('returns null for unparseable output', () => {
    expect(parseNvidiaSmiVram('command not found')).toBeNull()
  })

  test('returns null for empty output', () => {
    expect(parseNvidiaSmiVram('')).toBeNull()
  })
})

describe('buildLoadFailureDiagnostic', () => {
  test('reports required size and free VRAM when the model does not fit', () => {
    const result = buildLoadFailureDiagnostic({
      original: REAL_FAILURE_MESSAGE,
      modelKey: 'qwen/qwen3.8-27b',
      sizeBytes: 23362324550,
      vram: {
        totalBytes: 32607 * 1024 * 1024,
        usedBytes: 20933 * 1024 * 1024,
        freeBytes: 11168 * 1024 * 1024,
      },
    })

    expect(result).toContain(REAL_FAILURE_MESSAGE)
    expect(result).toContain('21.8 GiB')
    expect(result).toContain('10.9 GiB')
    expect(result).toContain('20.4 GiB')
    expect(result).toContain('other processes')
  })

  test('omits the VRAM line when the probe was unavailable', () => {
    const result = buildLoadFailureDiagnostic({
      original: REAL_FAILURE_MESSAGE,
      modelKey: 'qwen/qwen3.8-27b',
      sizeBytes: 23362324550,
      vram: null,
    })

    expect(result).toContain('21.8 GiB')
    expect(result).not.toContain('free')
  })

  // When the weights fit but the load still failed, the weights are not the
  // problem — the KV cache is. This is the "failed to allocate buffer for kv
  // cache" case, which the HTTP payload never names.
  const ROOMY_VRAM = {
    totalBytes: 32607 * 1024 * 1024,
    usedBytes: 100 * 1024 * 1024,
    freeBytes: 32507 * 1024 * 1024,
  }

  test('blames the KV cache when the weights fit but the load still failed', () => {
    const result = buildLoadFailureDiagnostic({
      original: REAL_FAILURE_MESSAGE,
      modelKey: 'qwen/qwen3.8-27b',
      sizeBytes: 23362324550,
      vram: ROOMY_VRAM,
    })

    expect(result).toContain(REAL_FAILURE_MESSAGE)
    expect(result).toContain('KV cache')
    expect(result).toContain('10.0 GiB')
    expect(result).toContain('context length')
    expect(result).not.toContain('Free VRAM')
  })

  test('names the configured context length when it is known', () => {
    const result = buildLoadFailureDiagnostic({
      original: REAL_FAILURE_MESSAGE,
      modelKey: 'qwen/qwen3.8-27b',
      sizeBytes: 23362324550,
      vram: ROOMY_VRAM,
      configuredContextLength: 200000,
    })

    expect(result).toContain('200,000 tokens')
    expect(result).toContain('KV cache')
  })

  test('returns the original message unchanged when model size is unknown', () => {
    const result = buildLoadFailureDiagnostic({
      original: REAL_FAILURE_MESSAGE,
      modelKey: 'qwen/qwen3.8-27b',
      sizeBytes: null,
      vram: null,
    })

    expect(result).toBe(REAL_FAILURE_MESSAGE)
  })
})

describe('augmentLmStudioLoadFailure', () => {
  const VRAM = {
    totalBytes: 32607 * 1024 * 1024,
    usedBytes: 20933 * 1024 * 1024,
    freeBytes: 11168 * 1024 * 1024,
  }

  test('augments a real load failure with the VRAM shortfall', () => {
    const result = augmentLmStudioLoadFailure(REAL_FAILURE_MESSAGE, {
      lookupSizeBytes: key =>
        key === 'qwen/qwen3.8-27b' ? 23362324550 : null,
      probeVram: () => VRAM,
    })

    expect(result).toContain('only 10.9 GiB VRAM free')
  })

  test('names the configured context length end to end', () => {
    const result = augmentLmStudioLoadFailure(REAL_FAILURE_MESSAGE, {
      lookupSizeBytes: () => 23362324550,
      probeVram: () => ({
        totalBytes: 32607 * 1024 * 1024,
        usedBytes: 100 * 1024 * 1024,
        freeBytes: 32507 * 1024 * 1024,
      }),
      readConfiguredContextLength: key =>
        key === 'qwen/qwen3.8-27b' ? 200000 : null,
    })

    expect(result).toContain('KV cache')
    expect(result).toContain('200,000 tokens')
  })

  test('survives a throwing context-length reader', () => {
    const result = augmentLmStudioLoadFailure(REAL_FAILURE_MESSAGE, {
      lookupSizeBytes: () => 23362324550,
      probeVram: () => VRAM,
      readConfiguredContextLength: () => {
        throw new Error('unreadable')
      },
    })

    expect(result).toContain('21.8 GiB')
  })

  test('leaves unrelated errors untouched', () => {
    const result = augmentLmStudioLoadFailure('Rate limit exceeded.', {
      lookupSizeBytes: () => 23362324550,
      probeVram: () => VRAM,
    })

    expect(result).toBe('Rate limit exceeded.')
  })

  test('does not probe VRAM for unrelated errors', () => {
    let probed = false
    augmentLmStudioLoadFailure('Rate limit exceeded.', {
      lookupSizeBytes: () => null,
      probeVram: () => {
        probed = true
        return VRAM
      },
    })

    expect(probed).toBe(false)
  })

  // A fresh session can fail before anything populates the model cache, so the
  // size lookup returns null. Free VRAM is still the fact worth reporting.
  test('reports free VRAM even when the model size is unknown', () => {
    const result = augmentLmStudioLoadFailure(REAL_FAILURE_MESSAGE, {
      lookupSizeBytes: () => null,
      probeVram: () => VRAM,
    })

    expect(result).toContain('10.9 GiB VRAM free')
    expect(result).toContain('20.4 GiB')
  })

  test('falls back to the original message when nothing is known', () => {
    const result = augmentLmStudioLoadFailure(REAL_FAILURE_MESSAGE, {
      lookupSizeBytes: () => null,
      probeVram: () => null,
    })

    expect(result).toBe(REAL_FAILURE_MESSAGE)
  })

  test('survives a throwing VRAM probe and still reports model size', () => {
    const result = augmentLmStudioLoadFailure(REAL_FAILURE_MESSAGE, {
      lookupSizeBytes: () => 23362324550,
      probeVram: () => {
        throw new Error('nvidia-smi exploded')
      },
    })

    expect(result).toContain('21.8 GiB')
  })
})
