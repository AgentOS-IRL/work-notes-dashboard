import type { SqliteDatabase } from './db/sqlite';

export interface NoteMetadata {
  created: string;
  updated: string[];
}

export interface Note {
  id: number;
  title: string;
  content: string;
  metadata: NoteMetadata;
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

function assertPositiveInteger(value: number, message = 'A valid note id is required.') {
  if (!Number.isInteger(value) || value <= 0) {
    throw new ValidationError(message);
  }
}

function assertNonNegativeInteger(value: number, message: string) {
  if (!Number.isInteger(value) || value < 0) {
    throw new ValidationError(message);
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

function createEmptyMetadata(): NoteMetadata {
  return {
    created: '',
    updated: []
  };
}

function normalizeMetadataList(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  const seen = new Set<string>();
  const normalized: string[] = [];

  for (const entry of value) {
    if (typeof entry !== 'string') {
      continue;
    }

    const trimmed = entry.trim();
    if (trimmed === '' || seen.has(trimmed)) {
      continue;
    }

    seen.add(trimmed);
    normalized.push(trimmed);
  }

  return normalized;
}

function normalizeNoteMetadata(rawMetadata: unknown): NoteMetadata {
  const parsedMetadata =
    typeof rawMetadata === 'string'
      ? (() => {
          if (rawMetadata.trim() === '') {
            return null;
          }

          try {
            return JSON.parse(rawMetadata) as unknown;
          } catch {
            return null;
          }
        })()
      : rawMetadata;

  if (!parsedMetadata || typeof parsedMetadata !== 'object') {
    return createEmptyMetadata();
  }

  const metadata = parsedMetadata as Partial<NoteMetadata> & { updated?: unknown };

  return {
    created: typeof metadata.created === 'string' ? metadata.created.trim() : '',
    updated: normalizeMetadataList(metadata.updated)
  };
}

function serializeNoteMetadata(metadata: NoteMetadata) {
  return JSON.stringify(normalizeNoteMetadata(metadata));
}

function normalizeSessionId(sessionId: string) {
  if (typeof sessionId !== 'string' || sessionId.trim() === '') {
    throw new ValidationError('A valid session id is required.');
  }

  return sessionId.trim();
}

function buildSessionMetadata(
  currentMetadata: NoteMetadata | null,
  sessionId: string
): NoteMetadata {
  const normalizedSessionId = normalizeSessionId(sessionId);
  const metadata = currentMetadata ?? createEmptyMetadata();
  const updated = metadata.updated.includes(normalizedSessionId)
    ? metadata.updated
    : [...metadata.updated, normalizedSessionId];

  return {
    created: metadata.created,
    updated
  };
}

function toNote(row: unknown): Note {
  const note = row as
    | (Pick<Note, 'id' | 'title' | 'content'> & { metadata?: unknown })
    | undefined;
  if (!note) {
    throw new Error('Expected a note row.');
  }

  return {
    id: note.id,
    title: note.title,
    content: note.content,
    metadata: normalizeNoteMetadata(note.metadata)
  };
}

export class NotesRepository {
  constructor(private readonly database: SqliteDatabase) {}

  listNotes(): Note[] {
    return this.database
      .prepare('SELECT id, title, content, metadata FROM notes ORDER BY id ASC')
      .all()
      .map((row) => toNote(row));
  }

  listNotesPage(limit: number, offset = 0): Note[] {
    assertPositiveInteger(limit, 'A valid note limit is required.');
    assertNonNegativeInteger(offset, 'A valid note offset is required.');

    return this.database
      .prepare('SELECT id, title, content, metadata FROM notes ORDER BY id ASC LIMIT ? OFFSET ?')
      .all(limit, offset)
      .map((row) => toNote(row));
  }

  getNoteById(id: number): Note | null {
    assertPositiveInteger(id);

    const note = this.database
      .prepare('SELECT id, title, content, metadata FROM notes WHERE id = ?')
      .get(id);

    return note ? toNote(note) : null;
  }

  createNote(input: NoteInput): Note {
    const noteInput = normalizeNoteInput(input);
    const info = this.database
      .prepare('INSERT INTO notes (title, content, metadata) VALUES (?, ?, ?)')
      .run(noteInput.title, noteInput.content, serializeNoteMetadata(createEmptyMetadata()));

    return this.getNoteById(Number(info.lastInsertRowid)) as Note;
  }

  createNoteForSession(sessionId: string, input: NoteInput): Note {
    const noteInput = normalizeNoteInput(input);
    const normalizedSessionId = normalizeSessionId(sessionId);
    const info = this.database
      .prepare('INSERT INTO notes (title, content, metadata) VALUES (?, ?, ?)')
      .run(
        noteInput.title,
        noteInput.content,
        serializeNoteMetadata({
          created: normalizedSessionId,
          updated: [normalizedSessionId]
        })
      );

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

  updateNoteForSession(id: number, sessionId: string, input: NoteInput): Note {
    assertPositiveInteger(id);
    const noteInput = normalizeNoteInput(input);
    const existing = this.getNoteById(id);
    if (!existing) {
      throw new NotFoundError(`Note ${id} was not found.`);
    }

    const metadata = buildSessionMetadata(existing.metadata, sessionId);

    const result = this.database
      .prepare('UPDATE notes SET title = ?, content = ?, metadata = ? WHERE id = ?')
      .run(noteInput.title, noteInput.content, serializeNoteMetadata(metadata), id);

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
