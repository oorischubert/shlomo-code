export type QueueOperation = string

export type QueueOperationMessage = {
  operation: QueueOperation
  timestamp?: number
  [key: string]: unknown
}

