import express from 'express';
import {
  configureFrontendStatic,
  ensureFrontendDistPathExists
} from './frontend-static';
import { createNotesRouter } from './routes/notes';
import { initializeSqliteDatabase, openSqliteDatabase } from './db/sqlite';
import { NotesRepository } from './notes-repository';
import { resolveDatabasePath } from './config';

export function createServer(options: {
  port?: number;
  frontendBasePath?: string;
  frontendDistPath?: string;
  databasePath?: string;
} = {}) {
  const app = express();
  const port = Number(options.port ?? process.env.PORT ?? 3000);
  const frontendBasePath = options.frontendBasePath ?? process.env.FRONTEND_BASE_PATH ?? '/';
  const frontendDistPath = ensureFrontendDistPathExists(options.frontendDistPath);
  const databasePath = resolveDatabasePath(options.databasePath);
  const database = openSqliteDatabase(databasePath);
  initializeSqliteDatabase(database);
  const notesRepository = new NotesRepository(database);

  app.get('/healthz', (_req, res) => {
    res.json({ ok: true });
  });

  app.use(express.json());
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
