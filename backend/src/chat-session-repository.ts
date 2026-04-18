import type { SqliteDatabase } from './db/sqlite';
import { NotFoundError, ValidationError } from './notes-repository';
import type { ChatRole } from './langchain/conversation';

export interface ChatSession {
  id: string;
  name: string | null;
}

export interface ChatMessage {
  id: number;
  sessionId: string;
  role: ChatRole;
  content: string;
}

function assertSessionId(sessionId: string) {
  if (typeof sessionId !== 'string' || sessionId.trim() === '') {
    throw new ValidationError('A valid session id is required.');
  }

  return sessionId.trim();
}

function normalizeMessageContent(content: string) {
  if (typeof content !== 'string') {
    throw new ValidationError('A chat message content value is required.');
  }

  const normalizedContent = content.trim();
  if (normalizedContent === '') {
    throw new ValidationError('A chat message content value is required.');
  }

  return normalizedContent;
}

function toChatSession(row: unknown): ChatSession {
  const session = row as ChatSession | undefined;
  if (!session) {
    throw new Error('Expected a chat session row.');
  }

  return {
    id: session.id,
    name: session.name ?? null
  };
}

function toChatMessage(row: unknown): ChatMessage {
  const message = row as ChatMessage | undefined;
  if (!message) {
    throw new Error('Expected a chat message row.');
  }

  return message;
}

export class ChatSessionRepository {
  constructor(private readonly database: SqliteDatabase) {}

  getSessionById(sessionId: string): ChatSession | null {
    const normalizedSessionId = assertSessionId(sessionId);
    const session = this.database
      .prepare('SELECT id, name FROM chat_sessions WHERE id = ?')
      .get(normalizedSessionId);

    return session ? toChatSession(session) : null;
  }

  createOrEnsureSession(sessionId: string): ChatSession {
    const normalizedSessionId = assertSessionId(sessionId);
    this.database
      .prepare('INSERT OR IGNORE INTO chat_sessions (id) VALUES (?)')
      .run(normalizedSessionId);

    return this.requireSession(normalizedSessionId);
  }

  insertUserMessage(sessionId: string, content: string): ChatMessage {
    return this.insertMessage(sessionId, 'user', content);
  }

  insertAssistantMessage(sessionId: string, content: string): ChatMessage {
    return this.insertMessage(sessionId, 'assistant', content);
  }

  countUserTurns(sessionId: string): number {
    const normalizedSessionId = assertSessionId(sessionId);
    this.requireSession(normalizedSessionId);

    const result = this.database
      .prepare(
        "SELECT COUNT(*) AS count FROM chat_messages WHERE sessionId = ? AND role = 'user'"
      )
      .get(normalizedSessionId) as { count?: number } | undefined;

    return Number(result?.count ?? 0);
  }

  getRecentMessages(sessionId: string, limit = 10): ChatMessage[] {
    const normalizedSessionId = assertSessionId(sessionId);
    this.requireSession(normalizedSessionId);

    if (!Number.isInteger(limit) || limit <= 0) {
      throw new ValidationError('A valid message limit is required.');
    }

    const rows = this.database
      .prepare(
        `
          SELECT id, sessionId, role, content
          FROM chat_messages
          WHERE sessionId = ?
          ORDER BY id DESC
          LIMIT ?
        `
      )
      .all(normalizedSessionId, limit) as ChatMessage[];

    return rows.reverse().map((row) => toChatMessage(row));
  }

  updateSessionName(sessionId: string, name: string): ChatSession {
    const normalizedSessionId = assertSessionId(sessionId);
    const normalizedName = normalizeMessageContent(name);

    this.requireSession(normalizedSessionId);

    const result = this.database
      .prepare('UPDATE chat_sessions SET name = ? WHERE id = ?')
      .run(normalizedName, normalizedSessionId);

    if (result.changes === 0) {
      throw new NotFoundError(`Session ${normalizedSessionId} was not found.`);
    }

    return this.requireSession(normalizedSessionId);
  }

  private requireSession(sessionId: string): ChatSession {
    const session = this.getSessionById(sessionId);
    if (!session) {
      throw new NotFoundError(`Session ${sessionId} was not found.`);
    }

    return session;
  }

  private insertMessage(sessionId: string, role: ChatRole, content: string): ChatMessage {
    const normalizedSessionId = assertSessionId(sessionId);
    const normalizedContent = normalizeMessageContent(content);

    this.createOrEnsureSession(normalizedSessionId);

    const result = this.database
      .prepare('INSERT INTO chat_messages (sessionId, role, content) VALUES (?, ?, ?)')
      .run(normalizedSessionId, role, normalizedContent);

    const message = this.database
      .prepare('SELECT id, sessionId, role, content FROM chat_messages WHERE id = ?')
      .get(Number(result.lastInsertRowid));

    return toChatMessage(message);
  }
}
