import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { initializeSqliteDatabase, openSqliteDatabase } from '../src/db/sqlite';
import { createNoteTools } from '../src/langchain';
import { NotesRepository, type Note, NotFoundError } from '../src/notes-repository';

test('LangChain note tools create, read, open, list, and update notes', async () => {
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

    const read = await tools.readNoteTool.invoke({ id: 1 });
    assert.deepEqual(read, {
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
    assert.deepEqual(fetched, read);

    const opened = await tools.openNoteTool.invoke({ id: 1 });
    assert.deepEqual(opened, read);

    const listed = await tools.listNotesTool.invoke({});
    assert.deepEqual(listed, {
      notes: [
        {
          id: 1,
          title: 'Sprint plan'
        },
        {
          id: 2,
          title: 'Note 2'
        },
        {
          id: 3,
          title: 'Note 3'
        },
        {
          id: 4,
          title: 'Note 4'
        },
        {
          id: 5,
          title: 'Note 5'
        },
        {
          id: 6,
          title: 'Note 6'
        },
        {
          id: 7,
          title: 'Note 7'
        },
        {
          id: 8,
          title: 'Note 8'
        },
        {
          id: 9,
          title: 'Note 9'
        },
        {
          id: 10,
          title: 'Note 10'
        }
      ],
      hasMore: true,
      nextOffset: 10
    });

    const paged = await tools.listNotesTool.invoke({
      limit: 3,
      offset: 8
    });
    assert.deepEqual(paged, {
      notes: [
        {
          id: 9,
          title: 'Note 9'
        },
        {
          id: 10,
          title: 'Note 10'
        },
        {
          id: 11,
          title: 'Note 11'
        }
      ],
      hasMore: true,
      nextOffset: 11
    });

    const finalPage = await tools.listNotesTool.invoke({
      limit: 3,
      offset: 10
    });
    assert.deepEqual(finalPage, {
      notes: [
        {
          id: 11,
          title: 'Note 11'
        },
        {
          id: 12,
          title: 'Note 12'
        }
      ],
      hasMore: false,
      nextOffset: null
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
      notes: [],
      hasMore: false,
      nextOffset: null
    });
  } finally {
    database.close();
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

test('locked update_note ignores caller ids and updates the captured note', async () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'work-notes-dashboard-locked-update-'));
  const databasePath = path.join(tempRoot, 'notes.sqlite');
  const database = openSqliteDatabase(databasePath);
  initializeSqliteDatabase(database);
  const repository = new NotesRepository(database);

  try {
    const lockedNote = repository.createNote({
      title: 'Locked note',
      content: 'Original locked body'
    });
    const otherNote = repository.createNote({
      title: 'Other note',
      content: 'Original other body'
    });
    const tools = createNoteTools(repository, { sessionId: 'session-locked' }, { lockedNoteId: lockedNote.id });

    const updated = await tools.updateNoteTool.invoke({
      id: otherNote.id,
      title: 'Locked note updated',
      content: 'Updated locked body'
    });

    assert.equal(updated.note.id, lockedNote.id);
    assert.deepEqual(updated.note.metadata, {
      created: '',
      updated: ['session-locked']
    });
    assert.equal(repository.getNoteById(lockedNote.id)?.title, 'Locked note updated');
    assert.equal(repository.getNoteById(otherNote.id)?.title, 'Other note');
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
