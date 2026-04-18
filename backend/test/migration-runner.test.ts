import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { initializeSqliteDatabase, openSqliteDatabase } from '../src/db/sqlite';

test('initializeSqliteDatabase applies migrations to a fresh database', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'work-notes-dashboard-migrations-'));
  const databasePath = path.join(tempRoot, 'notes.sqlite');
  const database = openSqliteDatabase(databasePath);

  try {
    initializeSqliteDatabase(database);

    assert.deepEqual(
      database
        .prepare('SELECT name FROM _migrations ORDER BY id')
        .all()
        .map((row) => (row as { name: string }).name),
      [
        '001_initial.sql',
        '002_add_timestamps.sql',
        '003_add_note_metadata.sql',
        '004_add_chat_session_metadata.sql',
        '005_add_chat_session_tool_calls.sql'
      ]
    );

    assert.ok(
      database
        .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'notes'")
        .get()
    );
    assert.ok(
      database
        .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'chat_sessions'")
        .get()
    );
    assert.ok(
      database
        .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'chat_messages'")
        .get()
    );

    const noteColumns = database
      .prepare('PRAGMA table_info(notes)')
      .all() as Array<{ name: string }>;
    assert.deepEqual(noteColumns.map((column) => column.name), [
      'id',
      'title',
      'content',
      'metadata'
    ]);

    const chatSessionColumns = database
      .prepare('PRAGMA table_info(chat_sessions)')
      .all() as Array<{ name: string }>;
    assert.deepEqual(chatSessionColumns.map((column) => column.name), [
      'id',
      'name',
      'createdAt',
      'lastActivityAt',
      'metadata',
      'toolCalls'
    ]);
  } finally {
    database.close();
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

test('initializeSqliteDatabase does not reapply migrations on a second startup', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'work-notes-dashboard-migrations-repeat-'));
  const databasePath = path.join(tempRoot, 'notes.sqlite');
  const database = openSqliteDatabase(databasePath);

  try {
    initializeSqliteDatabase(database);
    database
      .prepare('INSERT INTO notes (title, content) VALUES (?, ?)')
      .run('Draft', 'Initial content');
    initializeSqliteDatabase(database);

    assert.deepEqual(
      database
        .prepare('SELECT name FROM _migrations ORDER BY id')
        .all()
        .map((row) => (row as { name: string }).name),
      [
        '001_initial.sql',
        '002_add_timestamps.sql',
        '003_add_note_metadata.sql',
        '004_add_chat_session_metadata.sql',
        '005_add_chat_session_tool_calls.sql'
      ]
    );
    assert.deepEqual(
      database.prepare('SELECT COUNT(*) AS count FROM notes').get(),
      { count: 1 }
    );
  } finally {
    database.close();
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

test('initializeSqliteDatabase repairs a partially migrated timestamp schema', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'work-notes-dashboard-migrations-partial-'));
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
        name TEXT,
        createdAt INTEGER NOT NULL DEFAULT 0
      );

      CREATE TABLE chat_messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sessionId TEXT NOT NULL,
        role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
        content TEXT NOT NULL,
        FOREIGN KEY (sessionId) REFERENCES chat_sessions(id) ON DELETE CASCADE
      );

      INSERT INTO notes (title, content) VALUES ('Legacy note', 'Old body');
      INSERT INTO chat_sessions (id, name, createdAt) VALUES ('session-partial', 'Partial Session', 12345);
      INSERT INTO chat_messages (sessionId, role, content) VALUES (
        'session-partial',
        'user',
        'Partial message'
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
      'lastActivityAt',
      'metadata',
      'toolCalls'
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

    const noteColumns = database
      .prepare('PRAGMA table_info(notes)')
      .all() as Array<{ name: string }>;
    assert.deepEqual(noteColumns.map((column) => column.name), [
      'id',
      'title',
      'content',
      'metadata'
    ]);
    assert.deepEqual(
      database
        .prepare('SELECT name FROM _migrations ORDER BY id')
        .all()
        .map((row) => (row as { name: string }).name),
      [
        '001_initial.sql',
        '002_add_timestamps.sql',
        '003_add_note_metadata.sql',
        '004_add_chat_session_metadata.sql',
        '005_add_chat_session_tool_calls.sql'
      ]
    );

    const legacyNote = database
      .prepare('SELECT id, title, content, metadata FROM notes WHERE title = ?')
      .get('Legacy note') as { metadata?: string } | undefined;
    assert.ok(legacyNote);
    assert.equal(legacyNote?.metadata, '{}');

    const session = database
      .prepare('SELECT createdAt, lastActivityAt FROM chat_sessions WHERE id = ?')
      .get('session-partial') as { createdAt: number; lastActivityAt: number } | undefined;
    assert.ok(session);
    assert.equal(session?.createdAt, 12345);
    assert.ok((session?.lastActivityAt ?? 0) > 0);

    const message = database
      .prepare('SELECT createdAt FROM chat_messages WHERE sessionId = ?')
      .get('session-partial') as { createdAt: number } | undefined;
    assert.ok(message);
    assert.ok((message?.createdAt ?? 0) > 0);
  } finally {
    database.close();
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

test('initializeSqliteDatabase repairs a partially migrated chat session metadata schema', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'work-notes-dashboard-migrations-metadata-partial-'));
  const databasePath = path.join(tempRoot, 'notes.sqlite');
  const database = openSqliteDatabase(databasePath);

  try {
    database.exec(`
      CREATE TABLE chat_sessions (
        id TEXT PRIMARY KEY,
        name TEXT,
        createdAt INTEGER NOT NULL DEFAULT 0,
        lastActivityAt INTEGER NOT NULL DEFAULT 0,
        metadata TEXT
      );

      INSERT INTO chat_sessions (id, name, createdAt, lastActivityAt, metadata) VALUES (
        'session-metadata',
        'Metadata Session',
        12345,
        12345,
        NULL
      );

      INSERT INTO chat_sessions (id, name, createdAt, lastActivityAt, metadata) VALUES (
        'session-metadata-empty',
        'Metadata Session Empty',
        23456,
        23456,
        ''
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
      'lastActivityAt',
      'metadata',
      'toolCalls'
    ]);

    assert.deepEqual(
      database
        .prepare('SELECT name FROM _migrations ORDER BY id')
        .all()
        .map((row) => (row as { name: string }).name),
      [
        '001_initial.sql',
        '002_add_timestamps.sql',
        '003_add_note_metadata.sql',
        '004_add_chat_session_metadata.sql',
        '005_add_chat_session_tool_calls.sql'
      ]
    );

    const rows = database
      .prepare('SELECT id, metadata FROM chat_sessions ORDER BY id')
      .all() as Array<{ id: string; metadata: string }>;
    assert.deepEqual(rows, [
      {
        id: 'session-metadata',
        metadata: '{}'
      },
      {
        id: 'session-metadata-empty',
        metadata: '{}'
      }
    ]);
  } finally {
    database.close();
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});
