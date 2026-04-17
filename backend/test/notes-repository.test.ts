import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { initializeSqliteDatabase, openSqliteDatabase } from '../src/db/sqlite';
import {
  NotesRepository,
  NotFoundError,
  ValidationError
} from '../src/notes-repository';

test('initializeSqliteDatabase creates the notes table with the expected columns', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'work-notes-dashboard-db-'));
  const databasePath = path.join(tempRoot, 'notes.sqlite');
  const database = openSqliteDatabase(databasePath);

  try {
    initializeSqliteDatabase(database);

    const table = database
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'notes'")
      .get();
    assert.ok(table);

    const columns = database.prepare('PRAGMA table_info(notes)').all() as Array<{ name: string }>;
    assert.deepEqual(
      columns.map((column) => column.name),
      ['id', 'title', 'content']
    );
  } finally {
    database.close();
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

test('NotesRepository supports CRUD operations against SQLite', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'work-notes-dashboard-repo-'));
  const databasePath = path.join(tempRoot, 'notes.sqlite');
  const database = openSqliteDatabase(databasePath);
  initializeSqliteDatabase(database);
  const repository = new NotesRepository(database);

  try {
    const created = repository.createNote({
      title: 'Sprint plan',
      content: '# Heading\n\nWrite the first draft.'
    });

    assert.equal(created.id, 1);
    assert.equal(created.title, 'Sprint plan');
    assert.equal(created.content, '# Heading\n\nWrite the first draft.');

    assert.deepEqual(repository.listNotes(), [created]);
    assert.deepEqual(repository.getNoteById(created.id), created);

    const updated = repository.updateNote(created.id, {
      title: 'Updated sprint plan',
      content: 'Updated body'
    });

    assert.equal(updated.id, created.id);
    assert.equal(updated.title, 'Updated sprint plan');
    assert.equal(updated.content, 'Updated body');

    repository.deleteNote(created.id);
    assert.deepEqual(repository.listNotes(), []);
    assert.equal(repository.getNoteById(created.id), null);
  } finally {
    database.close();
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

test('NotesRepository validates input and missing rows', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'work-notes-dashboard-repo-invalid-'));
  const databasePath = path.join(tempRoot, 'notes.sqlite');
  const database = openSqliteDatabase(databasePath);
  initializeSqliteDatabase(database);
  const repository = new NotesRepository(database);

  try {
    assert.throws(
      () =>
        repository.createNote({
          title: '',
          content: 'Body'
        }),
      ValidationError
    );

    assert.throws(
      () =>
        repository.updateNote(1, {
          title: 'Missing note',
          content: 'Body'
        }),
      NotFoundError
    );

    assert.throws(
      () =>
        repository.deleteNote(1),
      NotFoundError
    );

    assert.equal(repository.getNoteById(1), null);
  } finally {
    database.close();
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});
