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
      ['001_initial.sql', '002_add_timestamps.sql']
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
      ['001_initial.sql', '002_add_timestamps.sql']
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
