import express from 'express';
import {
  configureFrontendStatic,
  ensureFrontendDistPathExists
} from './frontend-static';

export function createServer() {
  const app = express();
  const port = Number(process.env.PORT ?? 3000);
  const frontendBasePath = process.env.FRONTEND_BASE_PATH ?? '/';
  const frontendDistPath = ensureFrontendDistPathExists();

  app.get('/healthz', (_req, res) => {
    res.json({ ok: true });
  });

  configureFrontendStatic(app, frontendBasePath, frontendDistPath);

  return { app, port };
}

if (require.main === module) {
  const { app, port } = createServer();

  app.listen(port, () => {
    console.log(`Backend listening on http://localhost:${port}`);
  });
}
