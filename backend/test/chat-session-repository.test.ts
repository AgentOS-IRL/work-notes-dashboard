import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { initializeSqliteDatabase, openSqliteDatabase } from '../src/db/sqlite';
import {
  ChatSessionRepository
} from '../src/chat-session-repository';

const NOW = 1_700_000_000_000;
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

test('initializeSqliteDatabase applies the chat schema migrations', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'work-notes-dashboard-chat-schema-'));
  const databasePath = path.join(tempRoot, 'notes.sqlite');
  const database = openSqliteDatabase(databasePath);

  try {
    initializeSqliteDatabase(database);

    const sessionsTable = database
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'chat_sessions'")
      .get();
    const messagesTable = database
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'chat_messages'")
      .get();

    assert.ok(sessionsTable);
    assert.ok(messagesTable);
    assert.deepEqual(
      database
        .prepare('SELECT name FROM _migrations ORDER BY id')
        .all()
        .map((row) => (row as { name: string }).name),
      ['001_initial.sql', '002_add_timestamps.sql']
    );

    const sessionColumns = database
      .prepare('PRAGMA table_info(chat_sessions)')
      .all() as Array<{ name: string }>;
    assert.deepEqual(sessionColumns.map((column) => column.name), [
      'id',
      'name',
      'createdAt',
      'lastActivityAt'
    ]);

    const messageColumns = database
      .prepare('PRAGMA table_info(chat_messages)')
      .all() as Array<{ name: string }>;
    assert.deepEqual(messageColumns.map((column) => column.name), [
      'id',
      'sessionId',
      'role',
      'content',
      'createdAt'
    ]);

    const sessionIndexes = database
      .prepare('PRAGMA index_list(chat_sessions)')
      .all() as Array<{ name: string }>;
    assert.ok(sessionIndexes.some((index) => index.name === 'idx_chat_sessions_last_activity_at'));

    const messageIndexes = database
      .prepare('PRAGMA index_list(chat_messages)')
      .all() as Array<{ name: string }>;
    assert.ok(messageIndexes.some((index) => index.name === 'idx_chat_messages_created_at'));

    const foreignKeys = database
      .prepare('PRAGMA foreign_key_list(chat_messages)')
      .all() as Array<{ table: string; from: string; to: string }>;
    assert.equal(foreignKeys.length, 1);
    assert.equal(foreignKeys[0].table, 'chat_sessions');
    assert.equal(foreignKeys[0].from, 'sessionId');
    assert.equal(foreignKeys[0].to, 'id');
  } finally {
    database.close();
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

test('initializeSqliteDatabase migrates legacy chat tables without timestamp columns', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'work-notes-dashboard-chat-migration-'));
  const databasePath = path.join(tempRoot, 'notes.sqlite');
  const database = openSqliteDatabase(databasePath);

  try {
    database.exec(`
      CREATE TABLE IF NOT EXISTS notes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        content TEXT NOT NULL
      );

      CREATE TABLE chat_sessions (
        id TEXT PRIMARY KEY,
        name TEXT
      );

      CREATE TABLE chat_messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sessionId TEXT NOT NULL,
        role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
        content TEXT NOT NULL,
        FOREIGN KEY (sessionId) REFERENCES chat_sessions(id) ON DELETE CASCADE
      );

      INSERT INTO chat_sessions (id, name) VALUES ('session-legacy', 'Legacy Session');
      INSERT INTO chat_messages (sessionId, role, content) VALUES (
        'session-legacy',
        'user',
        'Legacy message'
      );
    `);

    initializeSqliteDatabase(database);

    const sessionColumns = database
      .prepare('PRAGMA table_info(chat_sessions)')
      .all() as Array<{ name: string }>;
    assert.deepEqual(sessionColumns.map((column) => column.name), [
      'id',
      'name',
      'createdAt',
      'lastActivityAt'
    ]);

    const messageColumns = database
      .prepare('PRAGMA table_info(chat_messages)')
      .all() as Array<{ name: string }>;
    assert.deepEqual(messageColumns.map((column) => column.name), [
      'id',
      'sessionId',
      'role',
      'content',
      'createdAt'
    ]);
    assert.deepEqual(
      database
        .prepare('SELECT name FROM _migrations ORDER BY id')
        .all()
        .map((row) => (row as { name: string }).name),
      ['001_initial.sql', '002_add_timestamps.sql']
    );

    const repository = new ChatSessionRepository(database, { now: () => NOW });
    const session = repository.getSessionById('session-legacy');
    assert.ok(session);
    assert.equal(session?.name, 'Legacy Session');
    assert.equal(typeof session?.createdAt, 'number');
    assert.equal(typeof session?.lastActivityAt, 'number');
    assert.ok((session?.lastActivityAt ?? 0) > 0);
    assert.equal(session?.createdAt, session?.lastActivityAt);

    const messages = repository.getRecentMessages('session-legacy', 10);
    assert.equal(messages.length, 1);
    assert.equal(messages[0].content, 'Legacy message');
    assert.equal(typeof messages[0].createdAt, 'number');
    assert.ok(messages[0].createdAt > 0);
  } finally {
    database.close();
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

test('ChatSessionRepository creates sessions, stores messages, and renames sessions', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'work-notes-dashboard-chat-repo-'));
  const databasePath = path.join(tempRoot, 'notes.sqlite');
  const database = openSqliteDatabase(databasePath);
  initializeSqliteDatabase(database);
  const repository = new ChatSessionRepository(database, { now: () => NOW });

  try {
    const created = repository.createOrEnsureSession('session-123');
    assert.deepEqual(created, {
      id: 'session-123',
      name: null,
      createdAt: NOW,
      lastActivityAt: NOW
    });

    const userMessage = repository.insertUserMessage('session-123', 'Draft a weekly update.');
    const assistantMessage = repository.insertAssistantMessage(
      'session-123',
      'I will draft it now.'
    );

    assert.equal(userMessage.sessionId, 'session-123');
    assert.equal(userMessage.role, 'user');
    assert.equal(userMessage.createdAt, NOW);
    assert.equal(assistantMessage.role, 'assistant');
    assert.equal(assistantMessage.createdAt, NOW);
    assert.equal(repository.countUserTurns('session-123'), 1);
    assert.deepEqual(repository.getRecentMessages('session-123', 10), [
      userMessage,
      assistantMessage
    ]);

    const renamed = repository.updateSessionName('session-123', 'Weekly update');
    assert.deepEqual(renamed, {
      id: 'session-123',
      name: 'Weekly update',
      createdAt: NOW,
      lastActivityAt: NOW
    });
    assert.deepEqual(repository.getSessionById('session-123'), renamed);
  } finally {
    database.close();
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

test('ChatSessionRepository lists sessions by recency and loads full transcripts', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'work-notes-dashboard-chat-list-'));
  const databasePath = path.join(tempRoot, 'notes.sqlite');
  const database = openSqliteDatabase(databasePath);
  initializeSqliteDatabase(database);
  const repository = new ChatSessionRepository(database, { now: () => NOW });

  try {
    database
      .prepare('INSERT INTO chat_sessions (id, name, createdAt, lastActivityAt) VALUES (?, ?, ?, ?)')
      .run('session-old', null, NOW - 5_000, NOW - 5_000);
    database
      .prepare('INSERT INTO chat_sessions (id, name, createdAt, lastActivityAt) VALUES (?, ?, ?, ?)')
      .run('session-new', 'Named session', NOW - 1_000, NOW - 1_000);
    database
      .prepare('INSERT INTO chat_sessions (id, name, createdAt, lastActivityAt) VALUES (?, ?, ?, ?)')
      .run('session-middle', null, NOW - 2_000, NOW - 2_000);
    database
      .prepare(
        'INSERT INTO chat_messages (sessionId, role, content, createdAt) VALUES (?, ?, ?, ?)'
      )
      .run('session-middle', 'user', 'First', NOW - 2_000);
    database
      .prepare(
        'INSERT INTO chat_messages (sessionId, role, content, createdAt) VALUES (?, ?, ?, ?)'
      )
      .run('session-middle', 'assistant', 'Second', NOW - 1_500);
    database
      .prepare(
        'INSERT INTO chat_messages (sessionId, role, content, createdAt) VALUES (?, ?, ?, ?)'
      )
      .run('session-middle', 'user', 'Third', NOW - 1_000);

    const sessions = repository.listRecentSessions(10);
    assert.deepEqual(
      sessions.map((session) => ({
        id: session.id,
        name: session.name,
        createdAt: session.createdAt,
        lastActivityAt: session.lastActivityAt
      })),
      [
        {
          id: 'session-new',
          name: 'Named session',
          createdAt: NOW - 1_000,
          lastActivityAt: NOW - 1_000
        },
        {
          id: 'session-middle',
          name: null,
          createdAt: NOW - 2_000,
          lastActivityAt: NOW - 2_000
        },
        {
          id: 'session-old',
          name: null,
          createdAt: NOW - 5_000,
          lastActivityAt: NOW - 5_000
        }
      ]
    );

    database
      .prepare(
        'INSERT INTO chat_sessions (id, name, createdAt, lastActivityAt) VALUES (?, ?, ?, ?)'
      )
      .run('session-retained', null, NOW - WEEK_MS, NOW);
    database
      .prepare(
        'INSERT INTO chat_messages (sessionId, role, content, createdAt) VALUES (?, ?, ?, ?)'
      )
      .run('session-retained', 'user', 'Expired turn', NOW - WEEK_MS - 1);
    database
      .prepare(
        'INSERT INTO chat_messages (sessionId, role, content, createdAt) VALUES (?, ?, ?, ?)'
      )
      .run('session-retained', 'assistant', 'Fresh turn', NOW - 500);

    assert.deepEqual(
      repository.getTranscript('session-middle').map((message) => ({
        role: message.role,
        content: message.content,
        createdAt: message.createdAt
      })),
      [
        {
          role: 'user',
          content: 'First',
          createdAt: NOW - 2_000
        },
        {
          role: 'assistant',
          content: 'Second',
          createdAt: NOW - 1_500
        },
        {
          role: 'user',
          content: 'Third',
          createdAt: NOW - 1_000
        }
      ]
    );

    assert.deepEqual(
      repository.getTranscript('session-retained').map((message) => ({
        role: message.role,
        content: message.content,
        createdAt: message.createdAt
      })),
      [
        {
          role: 'assistant',
          content: 'Fresh turn',
          createdAt: NOW - 500
        }
      ]
    );
  } finally {
    database.close();
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

test('ChatSessionRepository prunes expired sessions and messages at the 1-week boundary', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'work-notes-dashboard-chat-retention-'));
  const databasePath = path.join(tempRoot, 'notes.sqlite');
  const database = openSqliteDatabase(databasePath);
  initializeSqliteDatabase(database);
  const repository = new ChatSessionRepository(database, { now: () => NOW });
  const freshActivityAt = NOW - WEEK_MS + 1;
  const expiredActivityAt = NOW - WEEK_MS - 1;

  try {
    database
      .prepare('INSERT INTO chat_sessions (id, name, createdAt, lastActivityAt) VALUES (?, ?, ?, ?)')
      .run('session-fresh', 'Fresh Session', freshActivityAt, freshActivityAt);
    database
      .prepare(
        'INSERT INTO chat_messages (sessionId, role, content, createdAt) VALUES (?, ?, ?, ?)'
      )
      .run('session-fresh', 'user', 'Old message that should disappear.', NOW - WEEK_MS - 1);
    database
      .prepare(
        'INSERT INTO chat_messages (sessionId, role, content, createdAt) VALUES (?, ?, ?, ?)'
      )
      .run('session-fresh', 'assistant', 'Recent message that should remain.', NOW);

    database
      .prepare('INSERT INTO chat_sessions (id, name, createdAt, lastActivityAt) VALUES (?, ?, ?, ?)')
      .run('session-expired', 'Expired Session', expiredActivityAt, expiredActivityAt);
    database
      .prepare(
        'INSERT INTO chat_messages (sessionId, role, content, createdAt) VALUES (?, ?, ?, ?)'
      )
      .run('session-expired', 'user', 'Expired message.', NOW);

    repository.cleanupExpiredData();

    assert.equal(repository.getSessionById('session-expired'), null);
    assert.equal(repository.getSessionById('session-fresh')?.lastActivityAt, freshActivityAt);
    assert.deepEqual(
      repository.getRecentMessages('session-fresh', 10).map((message) => ({
        role: message.role,
        content: message.content,
        createdAt: message.createdAt
      })),
      [
        {
          role: 'assistant',
          content: 'Recent message that should remain.',
          createdAt: NOW
        }
      ]
    );
    assert.equal(repository.countUserTurns('session-fresh'), 0);

    const remainingMessages = database
      .prepare('SELECT sessionId, content FROM chat_messages ORDER BY id')
      .all() as Array<{ sessionId: string; content: string }>;
    assert.deepEqual(remainingMessages, [
      {
        sessionId: 'session-fresh',
        content: 'Recent message that should remain.'
      }
    ]);
  } finally {
    database.close();
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});
