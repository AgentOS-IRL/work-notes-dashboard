import { tool } from '@langchain/core/tools';
import * as z from 'zod';
import { NotFoundError, type Note, type NotesRepository } from '../notes-repository';

type NoteToolRepository = Pick<
  NotesRepository,
  'createNote' | 'getNoteById' | 'listNotesPage' | 'updateNote'
> &
  Partial<
    Pick<NotesRepository, 'createNoteForSession' | 'updateNoteForSession'>
  >;

export interface NoteToolContext {
  sessionId?: string;
}

const noteIdSchema = z.object({
  id: z.number().int().positive().describe('The note id.')
});

const noteInputSchema = z.object({
  title: z.string().trim().min(1).describe('The note title.'),
  content: z.string().describe('The note content.')
});

function asNote(note: Note | null) {
  if (!note) {
    throw new NotFoundError('Note was not found.');
  }

  return note;
}

export function createNoteTools(repository: NoteToolRepository, context: NoteToolContext = {}) {
  const createNoteTool = tool(
    async ({ title, content }) => {
      const note =
        context.sessionId && repository.createNoteForSession
          ? repository.createNoteForSession(context.sessionId, { title, content })
          : repository.createNote({ title, content });
      return { note };
    },
    {
      name: 'create_note',
      description: 'Create a note in the SQLite-backed notes store.',
      schema: noteInputSchema
    }
  );

  const getNoteTool = tool(
    async ({ id }) => {
      return { note: asNote(repository.getNoteById(id)) };
    },
    {
      name: 'get_note',
      description: 'Fetch a note by id from the SQLite-backed notes store.',
      schema: noteIdSchema
    }
  );

  const openNoteTool = tool(
    async ({ id }) => {
      return { note: asNote(repository.getNoteById(id)) };
    },
    {
      name: 'open_note',
      description: 'Open a note by id from the SQLite-backed notes store without modifying it.',
      schema: noteIdSchema
    }
  );

  const listNotesTool = tool(
    async ({ limit, offset }) => {
      return {
        notes: repository.listNotesPage(limit, offset).map((note) => ({
          id: note.id,
          title: note.title
        }))
      };
    },
    {
      name: 'list_notes',
      description:
        'List note ids and titles from the SQLite-backed notes store. Returns ids and titles only, not note content or metadata. Defaults to 10 notes and accepts offset-based paging for later pages.',
      schema: z.object({
        limit: z.number().int().positive().default(10).describe('The number of notes to return.'),
        offset: z.number().int().min(0).default(0).describe('The zero-based note offset for paging notes.')
      })
    }
  );

  const updateNoteTool = tool(
    async ({ id, title, content }) => {
      const note =
        context.sessionId && repository.updateNoteForSession
          ? repository.updateNoteForSession(id, context.sessionId, { title, content })
          : repository.updateNote(id, { title, content });
      return { note };
    },
    {
      name: 'update_note',
      description: 'Update an existing note in the SQLite-backed notes store.',
      schema: noteIdSchema.extend(noteInputSchema.shape)
    }
  );

  return {
    createNoteTool,
    getNoteTool,
    openNoteTool,
    listNotesTool,
    updateNoteTool
  };
}
