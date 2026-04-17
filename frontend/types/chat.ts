export type ChatRole = 'assistant' | 'user';

export interface ChatMessage {
  id: number;
  role: ChatRole;
  content: string;
}

export interface ChatRequest {
  messages: ChatMessage[];
}

export interface ChatResponse {
  assistantMessage: ChatMessage;
  changedNoteIds: number[];
  notesChanged: boolean;
}
