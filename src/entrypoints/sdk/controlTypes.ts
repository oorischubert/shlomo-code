export type SDKControlRequestInner = {
  type: string
  [key: string]: unknown
}

export type SDKControlRequest = SDKControlRequestInner
export type SDKControlResponse = {
  type: string
  [key: string]: unknown
}

export type SDKControlInitializeRequest = SDKControlRequest
export type SDKControlInitializeResponse = SDKControlResponse
export type SDKControlCancelRequest = SDKControlRequest
export type SDKControlPermissionRequest = SDKControlRequest
export type SDKControlMcpSetServersResponse = SDKControlResponse
export type SDKControlReloadPluginsResponse = SDKControlResponse
export type SDKPartialAssistantMessage = {
  type?: string
  message?: string
  [key: string]: unknown
}
export type StdinMessage = {
  type: string
  [key: string]: unknown
}
export type StdoutMessage = {
  type: string
  [key: string]: unknown
}

