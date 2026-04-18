import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { initializeSqliteDatabase, openSqliteDatabase } from '../src/db/sqlite';
import {
  ChatSessionRepository
} from '../src/chat-session-repository';

test('initializeSqliteDatabase creates the chat session tables', () => {
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

    const sessionColumns = database
      .prepare('PRAGMA table_info(chat_sessions)')
      .all() as Array<{ name: string }>;
    assert.deepEqual(sessionColumns.map((column) => column.name), ['id', 'name']);

    const messageColumns = database
      .prepare('PRAGMA table_info(chat_messages)')
      .all() as Array<{ name: string }>;
    assert.deepEqual(messageColumns.map((column) => column.name), [
      'id',
      'sessionId',
      'role',
      'content'
    ]);

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

test('ChatSessionRepository creates sessions, stores messages, and renames sessions', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'work-notes-dashboard-chat-repo-'));
  const databasePath = path.join(tempRoot, 'notes.sqlite');
  const database = openSqliteDatabase(databasePath);
  initializeSqliteDatabase(database);
  const repository = new ChatSessionRepository(database);

  try {
    const created = repository.createOrEnsureSession('session-123');
    assert.deepEqual(created, {
      id: 'session-123',
      name: null
    });

    const userMessage = repository.insertUserMessage('session-123', 'Draft a weekly update.');
    const assistantMessage = repository.insertAssistantMessage(
      'session-123',
      'I will draft it now.'
    );

    assert.equal(userMessage.sessionId, 'session-123');
    assert.equal(userMessage.role, 'user');
    assert.equal(assistantMessage.role, 'assistant');
    assert.equal(repository.countUserTurns('session-123'), 1);
    assert.deepEqual(repository.getRecentMessages('session-123', 10), [
      userMessage,
      assistantMessage
    ]);

    const renamed = repository.updateSessionName('session-123', 'Weekly update');
    assert.deepEqual(renamed, {
      id: 'session-123',
      name: 'Weekly update'
    });
    assert.deepEqual(repository.getSessionById('session-123'), renamed);
  } finally {
    database.close();
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});
