import { Router, type Response } from 'express';
import * as z from 'zod';
import { ChatSessionRepository } from '../chat-session-repository';
import { NotFoundError, ValidationError } from '../notes-repository';

const sessionIdSchema = z.string().trim().min(1);
const sessionLimitSchema = z.coerce.number().int().positive().max(100).default(20);

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Request failed.';
}

function sendError(res: Response, error: unknown) {
  if (error instanceof ValidationError || error instanceof NotFoundError) {
    res.status(error.statusCode).json({ error: error.message });
    return true;
  }

  return false;
}

export function createChatSessionsRouter(repository: ChatSessionRepository) {
  const router = Router();

  router.get('/', (req, res) => {
    const parsed = sessionLimitSchema.safeParse(req.query.limit);
    if (!parsed.success) {
      res.status(400).json({
        error: 'A valid session limit is required.',
        issues: parsed.error.issues
      });
      return;
    }

    try {
      res.json({
        sessions: repository.listRecentSessions(parsed.data)
      });
    } catch (error) {
      if (!sendError(res, error)) {
        res.status(500).json({ error: getErrorMessage(error) });
      }
    }
  });

  router.get('/:sessionId', (req, res) => {
    const parsed = sessionIdSchema.safeParse(req.params.sessionId);
    if (!parsed.success) {
      res.status(400).json({
        error: 'A valid session id is required.',
        issues: parsed.error.issues
      });
      return;
    }

    try {
      const session = repository.getSessionById(parsed.data);
      if (!session) {
        res.status(404).json({ error: `Session ${parsed.data} was not found.` });
        return;
      }

      res.json({
        session,
        messages: repository.getTranscript(parsed.data)
      });
    } catch (error) {
      if (!sendError(res, error)) {
        res.status(500).json({ error: getErrorMessage(error) });
      }
    }
  });

  router.use((_, res) => {
    res.status(404).json({ error: 'Not found.' });
  });

  return router;
}
