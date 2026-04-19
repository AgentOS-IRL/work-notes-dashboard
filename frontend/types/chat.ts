export type ChatRole = 'assistant' | 'user';

export interface ChatTurn {
  role: ChatRole;
  content: string;
}

export interface ChatMessage extends ChatTurn {
  id: number;
  toolCalls: ChatToolCall[];
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
}

export interface ChatSessionMetadata {
  created: number[];
  updated: number[];
  lockedNoteId: number | null;
}

export type ChatToolCall = Record<string, unknown>;

export interface ChatSessionListResponse {
  sessions: ChatSessionSummary[];
}

export interface ChatSessionDetail {
  id: string;
  name: string | null;
  createdAt: number;
  lastActivityAt: number;
  metadata: ChatSessionMetadata;
}

export interface ChatSessionDetailResponse {
  session: ChatSessionDetail;
  messages: ChatMessage[];
}

export interface ChatResponse {
  assistantMessage: ChatTurn;
  toolCalls: ChatToolCall[];
  createdNoteIds: number[];
  updatedNoteIds: number[];
  changedNoteIds: number[];
  openedNoteIds: number[];
  lockedNoteId?: number | null;
  notesChanged: boolean;
}

export interface ChatNotesActivity {
  createdNoteIds: number[];
  changedNoteIds: number[];
  openedNoteIds: number[];
}
