import express from 'express';
import {
  configureFrontendStatic,
  ensureFrontendDistPathExists
} from './frontend-static';
import { createConversationService } from './langchain';
import { createChatRouter } from './routes/chat';
import { createNotesRouter } from './routes/notes';
import { initializeSqliteDatabase, openSqliteDatabase } from './db/sqlite';
import { NotesRepository } from './notes-repository';
import { resolveDatabasePath } from './config';
import type { ConversationService } from './langchain';

export function createServer(options: {
  port?: number;
  frontendBasePath?: string;
  frontendDistPath?: string;
  databasePath?: string;
  conversationService?: ConversationService;
} = {}) {
  const app = express();
  const port = Number(options.port ?? process.env.PORT ?? 3000);
  const frontendBasePath = options.frontendBasePath ?? process.env.FRONTEND_BASE_PATH ?? '/';
  const frontendDistPath = ensureFrontendDistPathExists(options.frontendDistPath);
  const databasePath = resolveDatabasePath(options.databasePath);
  const database = openSqliteDatabase(databasePath);
  initializeSqliteDatabase(database);
  const notesRepository = new NotesRepository(database);
  let conversationService = options.conversationService ?? null;

  function getConversationService() {
    if (!conversationService) {
      conversationService = createConversationService({
        repository: notesRepository
      });
    }

    return conversationService;
  }

  app.get('/healthz', (_req, res) => {
    res.json({ ok: true });
  });

  app.use(express.json());
  app.use('/api/chat', createChatRouter(getConversationService));
  app.use('/api/notes', createNotesRouter(notesRepository));
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
