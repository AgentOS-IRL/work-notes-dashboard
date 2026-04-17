import type { SqliteDatabase } from './db/sqlite';

export interface Note {
  id: number;
  title: string;
  content: string;
}

export interface NoteInput {
  title: unknown;
  content: unknown;
}

export class ValidationError extends Error {
  readonly statusCode = 400;
}

export class NotFoundError extends Error {
  readonly statusCode = 404;
}

function assertPositiveInteger(id: number) {
  if (!Number.isInteger(id) || id <= 0) {
    throw new ValidationError('A valid note id is required.');
  }
}

function normalizeNoteInput(input: NoteInput) {
  if (typeof input.title !== 'string') {
    throw new ValidationError('A note title is required.');
  }

  if (input.title.trim() === '') {
    throw new ValidationError('A note title is required.');
  }

  if (typeof input.content !== 'string') {
    throw new ValidationError('A note content value is required.');
  }

  return {
    title: input.title.trim(),
    content: input.content
  };
}

function toNote(row: unknown): Note {
  const note = row as Note | undefined;
  if (!note) {
    throw new Error('Expected a note row.');
  }

  return note;
}

export class NotesRepository {
  constructor(private readonly database: SqliteDatabase) {}

  listNotes(): Note[] {
    return this.database
      .prepare('SELECT id, title, content FROM notes ORDER BY id ASC')
      .all() as Note[];
  }

  getNoteById(id: number): Note | null {
    assertPositiveInteger(id);

    const note = this.database
      .prepare('SELECT id, title, content FROM notes WHERE id = ?')
      .get(id);

    return note ? toNote(note) : null;
  }

  createNote(input: NoteInput): Note {
    const noteInput = normalizeNoteInput(input);
    const info = this.database
      .prepare('INSERT INTO notes (title, content) VALUES (?, ?)')
      .run(noteInput.title, noteInput.content);

    return this.getNoteById(Number(info.lastInsertRowid)) as Note;
  }

  updateNote(id: number, input: NoteInput): Note {
    assertPositiveInteger(id);
    const noteInput = normalizeNoteInput(input);

    const result = this.database
      .prepare('UPDATE notes SET title = ?, content = ? WHERE id = ?')
      .run(noteInput.title, noteInput.content, id);

    if (result.changes === 0) {
      throw new NotFoundError(`Note ${id} was not found.`);
    }

    return this.getNoteById(id) as Note;
  }

  deleteNote(id: number): void {
    assertPositiveInteger(id);

    const result = this.database.prepare('DELETE FROM notes WHERE id = ?').run(id);
    if (result.changes === 0) {
      throw new NotFoundError(`Note ${id} was not found.`);
    }
  }
}
