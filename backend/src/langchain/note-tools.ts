import { tool } from '@langchain/core/tools';
import * as z from 'zod';
import { NotFoundError, type Note, type NotesRepository } from '../notes-repository';

type NoteToolRepository = Pick<NotesRepository, 'createNote' | 'getNoteById' | 'updateNote'>;

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

export function createNoteTools(repository: NoteToolRepository) {
  const createNoteTool = tool(
    async ({ title, content }) => {
      const note = repository.createNote({ title, content });
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

  const updateNoteTool = tool(
    async ({ id, title, content }) => {
      const note = repository.updateNote(id, { title, content });
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
    updateNoteTool
  };
}
