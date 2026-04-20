import express from 'express';
import {
  configureFrontendStatic,
  ensureFrontendDistPathExists
} from './frontend-static';
import { createConversationService } from './langchain';
import { createChatRouter } from './routes/chat';
import { createChatSessionsRouter } from './routes/chat-sessions';
import { createNotesRouter } from './routes/notes';
import { createTasksRouter } from './routes/tasks';
import { initializeSqliteDatabase, openSqliteDatabase } from './db/sqlite';
import { ChatSessionRepository } from './chat-session-repository';
import { createChatSessionService } from './chat-session-service';
import { NotesRepository } from './notes-repository';
import { TasksRepository } from './tasks-repository';
import { resolveDatabasePath } from './config';
import type { ConversationService } from './langchain';
import type { ChatSessionService } from './chat-session-service';
import type { ChatSessionRepositoryOptions } from './chat-session-repository';

export function createServer(options: {
  port?: number;
  frontendBasePath?: string;
  frontendDistPath?: string;
  databasePath?: string;
  conversationService?: ConversationService;
  chatSessionRepositoryOptions?: ChatSessionRepositoryOptions;
} = {}) {
  const app = express();
  const port = Number(options.port ?? process.env.PORT ?? 3000);
  const frontendBasePath = options.frontendBasePath ?? process.env.FRONTEND_BASE_PATH ?? '/';
  const frontendDistPath = ensureFrontendDistPathExists(options.frontendDistPath);
  const databasePath = resolveDatabasePath(options.databasePath);
  const database = openSqliteDatabase(databasePath);
  initializeSqliteDatabase(database);
  const notesRepository = new NotesRepository(database);
  const tasksRepository = new TasksRepository(database);
  const chatSessionRepository = new ChatSessionRepository(
    database,
    options.chatSessionRepositoryOptions
  );
  let conversationService = options.conversationService ?? null;
  let chatSessionService: ChatSessionService | null = null;

  try {
    chatSessionRepository.cleanupExpiredData();
  } catch {
    // Startup cleanup is best-effort and should not block the server.
  }

  function getConversationService() {
    if (!conversationService) {
      conversationService = createConversationService({
        repository: notesRepository
      });
    }

    return conversationService;
  }

  function getChatSessionService() {
    if (!chatSessionService) {
      chatSessionService = createChatSessionService({
        repository: chatSessionRepository,
        conversationService: getConversationService()
      });
    }

    return chatSessionService;
  }

  app.get('/healthz', (_req, res) => {
    res.json({ ok: true });
  });

  app.use(express.json());
  app.use('/api/chat/sessions', createChatSessionsRouter(chatSessionRepository));
  app.use('/api/chat', createChatRouter(getChatSessionService));
  app.use('/api/notes', createNotesRouter(notesRepository));
  app.use('/api/tasks', createTasksRouter(tasksRepository));
  configureFrontendStatic(app, frontendBasePath, frontendDistPath);

  return {
    app,
    port,
    database,
    close() {
      database.close();
    }
  };
}

if (require.main === module) {
  const { app, port } = createServer();

  app.listen(port, () => {
    console.log(`Backend listening on http://localhost:${port}`);
  });
}
