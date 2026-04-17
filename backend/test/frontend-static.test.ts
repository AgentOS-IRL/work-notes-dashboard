import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import express from 'express';
import request from 'supertest';

import {
  configureFrontendStatic,
  ensureFrontendDistPathExists,
  resolveFrontendDistPath
} from '../src/frontend-static';

test('resolveFrontendDistPath finds the frontend dist next to the repo root', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'work-notes-dashboard-'));
  const backendDir = path.join(tempRoot, 'backend');
  const frontendDistDir = path.join(tempRoot, 'frontend', '.output', 'public');

  fs.mkdirSync(backendDir, { recursive: true });
  fs.mkdirSync(frontendDistDir, { recursive: true });

  const resolved = resolveFrontendDistPath({
    cwd: backendDir,
    frontendBuildDir: '.output/public'
  });

  assert.equal(resolved, frontendDistDir);
});

test('ensureFrontendDistPathExists throws a clear error when the dist directory is missing', () => {
  const missingPath = path.join(os.tmpdir(), 'work-notes-dashboard-missing-dist');

  assert.throws(
    () => ensureFrontendDistPathExists(missingPath),
    /Frontend build directory not found/
  );
});

test('configureFrontendStatic serves index.html for SPA routes', async () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'work-notes-dashboard-static-'));
  const distDir = path.join(tempRoot, 'public');
  const indexFile = path.join(distDir, 'index.html');

  fs.mkdirSync(distDir, { recursive: true });
  fs.writeFileSync(indexFile, '<!doctype html><html><body>index</body></html>');

  const app = express();
  configureFrontendStatic(app, '/', distDir);

  await request(app)
    .get('/notes/123')
    .expect(200)
    .expect('Content-Type', /html/)
    .expect((response) => {
      assert.match(response.text, /index/);
    });
});
