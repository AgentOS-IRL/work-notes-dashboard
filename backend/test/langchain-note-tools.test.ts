import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { initializeSqliteDatabase, openSqliteDatabase } from '../src/db/sqlite';
import { createNoteTools } from '../src/langchain';
import { NotesRepository, type Note, NotFoundError } from '../src/notes-repository';

test('LangChain note tools create, get, list, and update notes', async () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'work-notes-dashboard-tools-'));
  const databasePath = path.join(tempRoot, 'notes.sqlite');
  const database = openSqliteDatabase(databasePath);
  initializeSqliteDatabase(database);
  const repository = new NotesRepository(database);
  const tools = createNoteTools(repository);

  try {
    const created = await tools.createNoteTool.invoke({
      title: 'Sprint plan',
      content: 'Initial body'
    });

    assert.deepEqual(created, {
      note: {
        id: 1,
        title: 'Sprint plan',
        content: 'Initial body'
      }
    });

    const fetched = await tools.getNoteTool.invoke({ id: 1 });
    assert.deepEqual(fetched, {
      note: {
        id: 1,
        title: 'Sprint plan',
        content: 'Initial body'
      }
    });

    const listed = await tools.listNotesTool.invoke({});
    assert.deepEqual(listed, {
      notes: [
        {
          id: 1,
          title: 'Sprint plan',
          content: 'Initial body'
        }
      ]
    });

    const updated = await tools.updateNoteTool.invoke({
      id: 1,
      title: 'Sprint plan v2',
      content: 'Updated body'
    });

    assert.deepEqual(updated, {
      note: {
        id: 1,
        title: 'Sprint plan v2',
        content: 'Updated body'
      }
    });

    assert.deepEqual(repository.getNoteById(1) as Note, {
      id: 1,
      title: 'Sprint plan v2',
      content: 'Updated body'
    });
  } finally {
    database.close();
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

test('listNotesTool returns an empty list for an empty repository', async () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'work-notes-dashboard-empty-list-'));
  const databasePath = path.join(tempRoot, 'notes.sqlite');
  const database = openSqliteDatabase(databasePath);
  initializeSqliteDatabase(database);
  const repository = new NotesRepository(database);
  const tools = createNoteTools(repository);

  try {
    const listed = await tools.listNotesTool.invoke({});

    assert.deepEqual(listed, {
      notes: []
    });
  } finally {
    database.close();
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

test('createNoteTool rejects blank titles before repository access', async () => {
  let createCalls = 0;
  const tools = createNoteTools({
    createNote() {
      createCalls += 1;
      return { id: 1, title: 'x', content: 'y' };
    },
    getNoteById() {
      throw new Error('not used');
    },
    updateNote() {
      throw new Error('not used');
    },
    listNotes() {
      throw new Error('not used');
    }
  });

  await assert.rejects(
    () => tools.createNoteTool.invoke({ title: '   ', content: 'Body' })
  );

  assert.equal(createCalls, 0);
});

test('updateNoteTool surfaces repository errors correctly', async () => {
  const error = new Error('database exploded');
  const tools = createNoteTools({
    createNote() {
      throw new Error('not used');
    },
    getNoteById() {
      throw new Error('not used');
    },
    updateNote() {
      throw error;
    },
    listNotes() {
      throw new Error('not used');
    }
  });

  await assert.rejects(
    () =>
      tools.updateNoteTool.invoke({
        id: 1,
        title: 'Sprint plan v2',
        content: 'Updated body'
      }),
    /database exploded/
  );
});

test('getNoteTool surfaces not found errors from the repository layer', async () => {
  const tools = createNoteTools({
    createNote() {
      throw new Error('not used');
    },
    getNoteById() {
      return null;
    },
    updateNote() {
      throw new Error('not used');
    },
    listNotes() {
      throw new Error('not used');
    }
  });

  await assert.rejects(
    () => tools.getNoteTool.invoke({ id: 99 }),
    NotFoundError
  );
});
