export type ToolProgressData = {
  tool?: string
  message?: string
  status?: string
  [key: string]: unknown
}

export type ShellProgress = ToolProgressData
export type BashProgress = ShellProgress
export type PowerShellProgress = ShellProgress
export type MCPProgress = ToolProgressData
export type SkillToolProgress = ToolProgressData
export type AgentToolProgress = ToolProgressData
export type WebSearchProgress = ToolProgressData
export type TaskOutputProgress = ToolProgressData
export type REPLToolProgress = ToolProgressData
export type SdkWorkflowProgress = ToolProgressData

