import type { SqliteDatabase } from './db/sqlite';
import { NotFoundError, ValidationError } from './notes-repository';
import type { ChatRole } from './langchain/conversation';

const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export interface ChatSession {
  id: string;
  name: string | null;
  lastActivityAt: number;
}

export interface ChatMessage {
  id: number;
  sessionId: string;
  role: ChatRole;
  content: string;
  createdAt: number;
}

export interface ChatSessionRepositoryOptions {
  now?: () => number;
  retentionMs?: number;
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
    name: session.name ?? null,
    lastActivityAt: session.lastActivityAt
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
  private readonly now: () => number;
  private readonly retentionMs: number;

  constructor(
    private readonly database: SqliteDatabase,
    options: ChatSessionRepositoryOptions = {}
  ) {
    this.now = options.now ?? Date.now;
    this.retentionMs = options.retentionMs ?? ONE_WEEK_MS;
  }

  cleanupExpiredData(now = this.now()) {
    const cutoff = now - this.retentionMs;

    const transaction = this.database.transaction(() => {
      this.database
        .prepare('DELETE FROM chat_messages WHERE createdAt < ?')
        .run(cutoff);

      this.database
        .prepare('DELETE FROM chat_sessions WHERE lastActivityAt < ?')
        .run(cutoff);
    });

    transaction();
  }

  getSessionById(sessionId: string): ChatSession | null {
    const normalizedSessionId = assertSessionId(sessionId);
    const session = this.database
      .prepare('SELECT id, name, lastActivityAt FROM chat_sessions WHERE id = ?')
      .get(normalizedSessionId);

    if (!session) {
      return null;
    }

    const chatSession = toChatSession(session);
    if (chatSession.lastActivityAt < this.now() - this.retentionMs) {
      return null;
    }

    return chatSession;
  }

  createOrEnsureSession(sessionId: string): ChatSession {
    const normalizedSessionId = assertSessionId(sessionId);
    this.database
      .prepare('INSERT OR IGNORE INTO chat_sessions (id, name, lastActivityAt) VALUES (?, NULL, ?)')
      .run(normalizedSessionId, this.now());

    return this.requireSession(normalizedSessionId);
  }

  insertUserMessage(sessionId: string, content: string): ChatMessage {
    return this.insertMessage(sessionId, 'user', content);
  }

  insertAssistantMessage(sessionId: string, content: string): ChatMessage {
    return this.insertMessage(sessionId, 'assistant', content);
  }

  recordConversationTurn(
    sessionId: string,
    userContent: string,
    assistantContent: string
  ): {
    session: ChatSession;
    userMessage: ChatMessage;
    assistantMessage: ChatMessage;
  } {
    const normalizedSessionId = assertSessionId(sessionId);
    const normalizedUserContent = normalizeMessageContent(userContent);
    const normalizedAssistantContent = normalizeMessageContent(assistantContent);

    const transaction = this.database.transaction(() => {
      this.createOrEnsureSession(normalizedSessionId);

      const userMessage = this.insertMessage(
        normalizedSessionId,
        'user',
        normalizedUserContent
      );
      const assistantMessage = this.insertMessage(
        normalizedSessionId,
        'assistant',
        normalizedAssistantContent
      );

      return {
        session: this.requireSession(normalizedSessionId),
        userMessage,
        assistantMessage
      };
    });

    return transaction();
  }

  countUserTurns(sessionId: string): number {
    const normalizedSessionId = assertSessionId(sessionId);
    this.requireSession(normalizedSessionId);
    const cutoff = this.now() - this.retentionMs;

    const result = this.database
      .prepare(
        "SELECT COUNT(*) AS count FROM chat_messages WHERE sessionId = ? AND role = 'user' AND createdAt >= ?"
      )
      .get(normalizedSessionId, cutoff) as { count?: number } | undefined;

    return Number(result?.count ?? 0);
  }

  getRecentMessages(sessionId: string, limit = 10): ChatMessage[] {
    const normalizedSessionId = assertSessionId(sessionId);
    this.requireSession(normalizedSessionId);
    const cutoff = this.now() - this.retentionMs;

    if (!Number.isInteger(limit) || limit <= 0) {
      throw new ValidationError('A valid message limit is required.');
    }

    const rows = this.database
      .prepare(
        `
          SELECT id, sessionId, role, content, createdAt
          FROM chat_messages
          WHERE sessionId = ?
            AND createdAt >= ?
          ORDER BY id DESC
          LIMIT ?
        `
      )
      .all(normalizedSessionId, cutoff, limit) as ChatMessage[];

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

  touchSession(sessionId: string): ChatSession {
    const normalizedSessionId = assertSessionId(sessionId);
    const session = this.requireSession(normalizedSessionId);
    const timestamp = this.now();

    const result = this.database
      .prepare('UPDATE chat_sessions SET lastActivityAt = ? WHERE id = ?')
      .run(timestamp, normalizedSessionId);

    if (result.changes === 0) {
      throw new NotFoundError(`Session ${normalizedSessionId} was not found.`);
    }

    return {
      ...session,
      lastActivityAt: timestamp
    };
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
    const timestamp = this.now();

    this.createOrEnsureSession(normalizedSessionId);

    const result = this.database
      .prepare(
        'INSERT INTO chat_messages (sessionId, role, content, createdAt) VALUES (?, ?, ?, ?)'
      )
      .run(normalizedSessionId, role, normalizedContent, timestamp);

    const message = this.database
      .prepare('SELECT id, sessionId, role, content, createdAt FROM chat_messages WHERE id = ?')
      .get(Number(result.lastInsertRowid));

    this.database
      .prepare('UPDATE chat_sessions SET lastActivityAt = ? WHERE id = ?')
      .run(timestamp, normalizedSessionId);

    return toChatMessage(message);
  }
}
