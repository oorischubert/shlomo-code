export type MessageKind =
  | 'assistant'
  | 'user'
  | 'system'
  | 'attachment'
  | 'progress'
  | string

export type MessageOrigin = string
export type SystemMessageLevel = 'info' | 'warning' | 'error' | string
export type PartialCompactDirection = 'left' | 'right' | 'both' | string

export type CompactMetadata = Record<string, unknown>
export type RequestStartEvent = Record<string, unknown>
export type StreamEvent = Record<string, unknown>
export type StopHookInfo = Record<string, unknown>

export type BaseMessage = {
  type: MessageKind
  uuid?: string
  subtype?: string
  message?: { id?: string; [key: string]: unknown }
  content?: unknown
  text?: string
  requestId?: string
  timestamp?: number
  [key: string]: unknown
}

export type Message = BaseMessage
export type RenderableMessage = BaseMessage
export type NormalizedMessage = BaseMessage
export type AssistantMessage = BaseMessage & { type: 'assistant' | string }
export type NormalizedAssistantMessage = AssistantMessage
export type UserMessage = BaseMessage & { type: 'user' | string }
export type NormalizedUserMessage = UserMessage
export type AttachmentMessage = BaseMessage & {
  type: 'attachment' | 'user' | string
}
export type ProgressMessage = BaseMessage & { type: 'progress' | string }
export type SystemMessage = BaseMessage & { type: 'system' | string }
export type SystemAPIErrorMessage = SystemMessage
export type SystemAgentsKilledMessage = SystemMessage
export type SystemApiMetricsMessage = SystemMessage
export type SystemAwaySummaryMessage = SystemMessage
export type SystemBridgeStatusMessage = SystemMessage
export type SystemCompactBoundaryMessage = SystemMessage
export type SystemFileSnapshotMessage = SystemMessage
export type SystemInformationalMessage = SystemMessage
export type SystemLocalCommandMessage = SystemMessage
export type SystemMemorySavedMessage = SystemMessage
export type SystemMicrocompactBoundaryMessage = SystemMessage
export type SystemPermissionRetryMessage = SystemMessage
export type SystemScheduledTaskFireMessage = SystemMessage
export type SystemStopHookSummaryMessage = SystemMessage
export type SystemThinkingMessage = SystemMessage
export type SystemTurnDurationMessage = SystemMessage
export type HookResultMessage = SystemMessage
export type ToolUseSummaryMessage = SystemMessage
export type TombstoneMessage = SystemMessage
export type CollapsibleMessage = Message
export type CollapsedReadSearchGroup = BaseMessage & { messages?: Message[] }
export type GroupedToolUseMessage = BaseMessage & { messages?: Message[] }

