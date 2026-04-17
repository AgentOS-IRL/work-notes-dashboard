import { Router, type Response } from 'express';
import { NotesRepository, NotFoundError, ValidationError, type NoteInput } from '../notes-repository';

function parseNoteId(rawId: string) {
  const id = Number.parseInt(rawId, 10);
  if (!Number.isInteger(id) || id <= 0 || String(id) !== rawId.trim()) {
    throw new ValidationError('A valid note id is required.');
  }

  return id;
}

function parseNoteInput(body: unknown): NoteInput {
  if (body === null || typeof body !== 'object') {
    throw new ValidationError('Request body must be a JSON object.');
  }

  return body as NoteInput;
}

function sendError(res: Response, error: unknown) {
  if (error instanceof ValidationError) {
    res.status(400).json({ error: error.message });
    return true;
  }

  if (error instanceof NotFoundError) {
    res.status(404).json({ error: error.message });
    return true;
  }

  return false;
}

export function createNotesRouter(repository: NotesRepository) {
  const router = Router();

  router.get('/', (_req, res) => {
    res.json({ notes: repository.listNotes() });
  });

  router.get('/:id', (req, res) => {
    try {
      const note = repository.getNoteById(parseNoteId(req.params.id));
      if (!note) {
        res.status(404).json({ error: 'Note not found.' });
        return;
      }

      res.json({ note });
    } catch (error) {
      if (!sendError(res, error)) {
        throw error;
      }
    }
  });

  router.post('/', (req, res) => {
    try {
      const note = repository.createNote(parseNoteInput(req.body));
      res.status(201).json({ note });
    } catch (error) {
      if (!sendError(res, error)) {
        throw error;
      }
    }
  });

  router.put('/:id', (req, res) => {
    try {
      const note = repository.updateNote(parseNoteId(req.params.id), parseNoteInput(req.body));
      res.json({ note });
    } catch (error) {
      if (!sendError(res, error)) {
        throw error;
      }
    }
  });

  router.delete('/:id', (req, res) => {
    try {
      repository.deleteNote(parseNoteId(req.params.id));
      res.status(204).send();
    } catch (error) {
      if (!sendError(res, error)) {
        throw error;
      }
    }
  });

  return router;
}
