export const DEFAULT_GRANT_FLAGS = {
  clipboardRead: false,
  clipboardWrite: false,
  systemKeyCombos: false,
}

export const API_RESIZE_PARAMS = {
  maxWidth: 4096,
  maxHeight: 4096,
}

export function targetImageSize(width, height) {
  return [width, height]
}

export function buildComputerUseTools() {
  return [
    {
      name: 'request_access',
      description: 'Computer use is not available in this external build.',
      inputSchema: { type: 'object', properties: {} },
    },
  ]
}

export function bindSessionContext() {
  return async () => ({
    content: [
      {
        type: 'text',
        text: 'Computer use is not available in this build.',
      },
    ],
    telemetry: { error_kind: 'unsupported' },
  })
}

export function createComputerUseMcpServer() {
  return {
    async connect() {},
    async close() {},
    setRequestHandler() {},
  }
}
