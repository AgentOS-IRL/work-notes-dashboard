import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import request from 'supertest';

import { createServer } from '../src/server';
import { ChatSessionRepository } from '../src/chat-session-repository';
import { initializeSqliteDatabase, openSqliteDatabase } from '../src/db/sqlite';

const NOW = 1_700_000_000_000;
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function createTempFrontendDist() {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'work-notes-dashboard-server-'));
  const frontendDistPath = path.join(tempRoot, 'public');

  fs.mkdirSync(frontendDistPath, { recursive: true });
  fs.writeFileSync(
    path.join(frontendDistPath, 'index.html'),
    '<!doctype html><html><body>server</body></html>'
  );

  return {
    tempRoot,
    frontendDistPath
  };
}

test('createServer serves the SPA entry route from the resolved frontend dist', async () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'work-notes-dashboard-server-db-'));
  const databasePath = path.join(tempRoot, 'notes.sqlite');
  const { tempRoot: frontendRoot, frontendDistPath } = createTempFrontendDist();
  const server = createServer({
    databasePath,
    frontendDistPath
  });

  try {
    await request(server.app)
      .get('/notes/123')
      .expect(200)
      .expect('Content-Type', /html/)
      .expect((response) => {
        assert.match(response.text, /server/);
      });
  } finally {
    server.close();
    fs.rmSync(tempRoot, { recursive: true, force: true });
    fs.rmSync(frontendRoot, { recursive: true, force: true });
  }
});

test('createServer prunes expired chat storage during startup', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'work-notes-dashboard-server-retention-'));
  const databasePath = path.join(tempRoot, 'notes.sqlite');
  const database = openSqliteDatabase(databasePath);
  initializeSqliteDatabase(database);
  database
    .prepare('INSERT INTO chat_sessions (id, name, lastActivityAt) VALUES (?, ?, ?)')
    .run('session-expired', 'Expired Session', NOW - WEEK_MS - 1);
  database
    .prepare('INSERT INTO chat_messages (sessionId, role, content, createdAt) VALUES (?, ?, ?, ?)')
    .run('session-expired', 'user', 'Expired message.', NOW - WEEK_MS - 1);
  database.close();

  const { tempRoot: frontendRoot, frontendDistPath } = createTempFrontendDist();
  const server = createServer({
    databasePath,
    frontendDistPath,
    chatSessionRepositoryOptions: {
      now: () => NOW
    }
  });

  try {
    const repository = new ChatSessionRepository(server.database, { now: () => NOW });
    assert.equal(repository.getSessionById('session-expired'), null);
    assert.deepEqual(
      server.database.prepare('SELECT * FROM chat_messages').all(),
      []
    );
  } finally {
    server.close();
    fs.rmSync(tempRoot, { recursive: true, force: true });
    fs.rmSync(frontendRoot, { recursive: true, force: true });
  }
});

test('createServer fails fast when the frontend dist is missing index.html', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'work-notes-dashboard-server-empty-'));
  const databasePath = path.join(tempRoot, 'notes.sqlite');
  const frontendDistPath = path.join(tempRoot, 'public');

  fs.mkdirSync(frontendDistPath, { recursive: true });

  assert.throws(
    () =>
      createServer({
        databasePath,
        frontendDistPath
      }),
    /missing index\.html/
  );

  fs.rmSync(tempRoot, { recursive: true, force: true });
});
