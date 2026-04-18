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
}

export interface ChatSessionListResponse {
  sessions: ChatSessionSummary[];
}

export interface ChatSessionDetailResponse {
  session: ChatSessionSummary;
  messages: ChatMessage[];
}

export interface ChatResponse {
  assistantMessage: ChatTurn;
  changedNoteIds: number[];
  notesChanged: boolean;
}
