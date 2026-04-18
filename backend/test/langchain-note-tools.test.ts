import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { initializeSqliteDatabase, openSqliteDatabase } from '../src/db/sqlite';
import { createNoteTools } from '../src/langchain';
import { NotesRepository, type Note, NotFoundError } from '../src/notes-repository';

test('LangChain note tools create, get, open, list, and update notes', async () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'work-notes-dashboard-tools-'));
  const databasePath = path.join(tempRoot, 'notes.sqlite');
  const database = openSqliteDatabase(databasePath);
  initializeSqliteDatabase(database);
  const repository = new NotesRepository(database);
  const tools = createNoteTools(repository, { sessionId: 'session-abc' });

  try {
    const created = await tools.createNoteTool.invoke({
      title: 'Sprint plan',
      content: 'Initial body'
    });

    for (let index = 2; index <= 12; index += 1) {
      repository.createNote({
        title: `Note ${index}`,
        content: `Body ${index}`
      });
    }

    assert.deepEqual(created, {
      note: {
        id: 1,
        title: 'Sprint plan',
        content: 'Initial body',
        metadata: {
          created: 'session-abc',
          updated: ['session-abc']
        }
      }
    });

    const fetched = await tools.getNoteTool.invoke({ id: 1 });
    assert.deepEqual(fetched, {
      note: {
        id: 1,
        title: 'Sprint plan',
        content: 'Initial body',
        metadata: {
          created: 'session-abc',
          updated: ['session-abc']
        }
      }
    });

    const opened = await tools.openNoteTool.invoke({ id: 1 });
    assert.deepEqual(opened, fetched);

    const listed = await tools.listNotesTool.invoke({});
    assert.deepEqual(listed, {
      titles: [
        'Sprint plan',
        'Note 2',
        'Note 3',
        'Note 4',
        'Note 5',
        'Note 6',
        'Note 7',
        'Note 8',
        'Note 9',
        'Note 10'
      ]
    });

    const paged = await tools.listNotesTool.invoke({
      limit: 3,
      offset: 8
    });
    assert.deepEqual(paged, {
      titles: ['Note 9', 'Note 10', 'Note 11']
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
        content: 'Updated body',
        metadata: {
          created: 'session-abc',
          updated: ['session-abc']
        }
      }
    });

    assert.deepEqual(repository.getNoteById(1) as Note, {
      id: 1,
      title: 'Sprint plan v2',
      content: 'Updated body',
      metadata: {
        created: 'session-abc',
        updated: ['session-abc']
      }
    });

    const reopened = await tools.openNoteTool.invoke({ id: 1 });
    assert.deepEqual(reopened, {
      note: {
        id: 1,
        title: 'Sprint plan v2',
        content: 'Updated body',
        metadata: {
          created: 'session-abc',
          updated: ['session-abc']
        }
      }
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
      titles: []
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
      return {
        id: 1,
        title: 'x',
        content: 'y',
        metadata: { created: '', updated: [] }
      };
    },
    getNoteById() {
      throw new Error('not used');
    },
    updateNote() {
      throw new Error('not used');
    },
    listNotesPage() {
      throw new Error('not used');
    },
    createNoteForSession() {
      throw new Error('not used');
    },
    updateNoteForSession() {
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
    listNotesPage() {
      throw new Error('not used');
    },
    createNoteForSession() {
      throw new Error('not used');
    },
    updateNoteForSession() {
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
    listNotesPage() {
      throw new Error('not used');
    },
    createNoteForSession() {
      throw new Error('not used');
    },
    updateNoteForSession() {
      throw new Error('not used');
    }
  });

  await assert.rejects(
    () => tools.getNoteTool.invoke({ id: 99 }),
    NotFoundError
  );
});
