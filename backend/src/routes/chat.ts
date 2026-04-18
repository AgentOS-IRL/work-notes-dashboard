import { Router } from 'express';
import * as z from 'zod';
import type { ChatSessionService } from '../chat-session-service';

const chatTurnSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string().trim().min(1)
});

const chatRequestSchema = z.object({
  sessionId: z.string().trim().min(1),
  messages: z.array(chatTurnSchema).min(1)
}).refine(
  (request) => request.messages.at(-1)?.role === 'user',
  {
    message: 'The last message in a chat request must be a user message.',
    path: ['messages']
  }
);

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Chat request failed.';
}

export function createChatRouter(getChatSessionService: () => ChatSessionService) {
  const router = Router();

  router.post('/', async (req, res) => {
    const parsed = chatRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: 'Request body must include a sessionId and a non-empty messages array.',
        issues: parsed.error.issues
      });
      return;
    }

    try {
      const service = getChatSessionService();
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
