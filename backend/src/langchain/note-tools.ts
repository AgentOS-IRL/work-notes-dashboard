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

function createReadNoteTool(
  repository: NoteToolRepository,
  context: NoteToolContext,
  name: 'read_note' | 'get_note' | 'open_note',
  description: string
) {
  return tool(
    async ({ id }) => {
      return { note: asNote(repository.getNoteById(id)) };
    },
    {
      name,
      description,
      schema: noteIdSchema
    }
  );
}

export function createNoteTools(
  repository: NoteToolRepository,
  context: NoteToolContext = {}
) {
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

  const readNoteTool = createReadNoteTool(
    repository,
    context,
    'read_note',
    'Read a note by id from the SQLite-backed notes store for model-side inspection. Use this when the LLM needs note content or metadata.'
  );

  const getNoteTool = createReadNoteTool(
    repository,
    context,
    'get_note',
    'Backward-compatible alias for read_note.'
  );

  const openNoteTool = createReadNoteTool(
    repository,
    context,
    'open_note',
    'Open a note by id from the SQLite-backed notes store without modifying it. This is the user-facing note-open action.'
  );

  const listNotesTool = tool(
    async ({ limit, offset }) => {
      const page = repository.listNotesPage(limit + 1, offset);
      const hasMore = page.length > limit;
      const notes = page.slice(0, limit).map((note) => ({
        id: note.id,
        title: note.title
      }));

      return {
        notes,
        hasMore,
        nextOffset: hasMore ? offset + limit : null
      };
    },
    {
      name: 'list_notes',
      description:
        'List note ids and titles from the SQLite-backed notes store for discovery. Returns ids and titles only, plus explicit paging state (`hasMore` and `nextOffset`) so callers can tell when they reached the last page. Defaults to 10 notes and accepts offset-based paging for later pages.',
      schema: z.object({
        limit: z.number().int().positive().default(10).describe('The number of notes to return.'),
        offset: z.number().int().min(0).default(0).describe('The zero-based note offset for paging notes.')
      })
    }
  );

  const updateNoteTool = tool(
    async (input: { id: number; title: string; content: string }) => {
      const { id, title, content } = input;
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
    readNoteTool,
    getNoteTool,
    openNoteTool,
    listNotesTool,
    updateNoteTool
  };
}
