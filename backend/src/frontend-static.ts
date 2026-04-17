import fs from 'node:fs';
import path from 'node:path';
import express, { type Express, type Response } from 'express';

export const frontendBuildDir = process.env.FRONTEND_BUILD_DIR ?? '.output/public';

export function resolveFrontendDistPath(options: {
  cwd?: string;
  frontendBuildDir?: string;
} = {}) {
  const cwd = options.cwd ?? process.cwd();
  const buildDir = options.frontendBuildDir ?? frontendBuildDir;
  const candidates = [
    path.resolve(cwd, 'frontend', buildDir),
    path.resolve(cwd, '..', 'frontend', buildDir),
    path.resolve(cwd, '..', '..', 'frontend', buildDir)
  ];

  return candidates.find((candidate) => fs.existsSync(candidate)) ?? candidates[0];
}

export function ensureFrontendDistPathExists(frontendDistPath = resolveFrontendDistPath()) {
  if (!fs.existsSync(frontendDistPath)) {
    throw new Error(
      `Frontend build directory not found at ${frontendDistPath}. Run "npm run build:frontend" or set FRONTEND_BUILD_DIR.`
    );
  }

  if (!fs.statSync(frontendDistPath).isDirectory()) {
    throw new Error(
      `Frontend build path exists but is not a directory: ${frontendDistPath}.`
    );
  }

  return frontendDistPath;
}

export function sendSPAIndex(res: Response, frontendDistPath: string) {
  res.sendFile(path.join(frontendDistPath, 'index.html'));
}

function normalizeBasePath(basePath: string) {
  const trimmed = basePath.trim();
  if (trimmed === '' || trimmed === '/') {
    return '/';
  }

  return `/${trimmed.replace(/^\/+/, '').replace(/\/+$/, '')}`;
}

export function configureFrontendStatic(
  app: Express,
  basePath: string,
  frontendDistPath = ensureFrontendDistPathExists()
) {
  const mountBase = normalizeBasePath(basePath);
  const router = express.Router();

  router.use(express.static(frontendDistPath, { index: false }));
  router.use((req, res) => {
    if (path.extname(req.path)) {
      res.sendStatus(404);
      return;
    }

    sendSPAIndex(res, frontendDistPath);
  });

  app.use(mountBase, router);
}
