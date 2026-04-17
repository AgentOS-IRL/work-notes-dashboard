export type ChatRole = 'assistant' | 'user';

export interface ChatTurn {
  role: ChatRole;
  content: string;
}

export interface ChatMessage extends ChatTurn {
  id: number;
}

export interface ChatRequest {
  messages: ChatMessage[];
}

export interface ChatResponse {
  assistantMessage: ChatTurn;
  changedNoteIds: number[];
  notesChanged: boolean;
}
