import { Router } from 'express';
import * as z from 'zod';
import type { ConversationService } from '../langchain';

const chatTurnSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string().trim().min(1)
});

const chatRequestSchema = z.object({
  messages: z.array(chatTurnSchema).min(1)
});

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Chat request failed.';
}

export function createChatRouter(getConversationService: () => ConversationService) {
  const router = Router();

  router.post('/', async (req, res) => {
    const parsed = chatRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: 'Request body must include a non-empty messages array.',
        issues: parsed.error.issues
      });
      return;
    }

    try {
      const service = getConversationService();
      const response = await service.replyToConversation(parsed.data);

      res.json(response);
    } catch (error) {
      res.status(500).json({ error: getErrorMessage(error) });
    }
  });

  router.use((_, res) => {
    res.status(404).json({ error: 'Not found.' });
  });

  return router;
}

