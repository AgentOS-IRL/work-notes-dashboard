export type ChatRole = 'assistant' | 'user';

export interface ChatTurn {
  role: ChatRole;
  content: string;
}

export interface ChatMessage extends ChatTurn {
  id: number;
}

export interface ChatRequest {
  sessionId: string;
  messages: ChatMessage[];
}

export interface ChatSessionSummary {
  id: string;
  name: string | null;
  createdAt: number;
  lastActivityAt: number;
  metadata: ChatSessionMetadata;
  toolCalls: ChatToolCall[];
}

export interface ChatSessionMetadata {
  created: number[];
  updated: number[];
}

export type ChatToolCall = Record<string, unknown>;

export interface ChatSessionListResponse {
  sessions: ChatSessionSummary[];
}

export interface ChatSessionDetailResponse {
  session: ChatSessionSummary;
  messages: ChatMessage[];
}

export interface ChatResponse {
  assistantMessage: ChatTurn;
  toolCalls: ChatToolCall[];
  createdNoteIds: number[];
  updatedNoteIds: number[];
  changedNoteIds: number[];
  openedNoteIds: number[];
  notesChanged: boolean;
}
