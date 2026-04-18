import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import request from 'supertest';

import { createServer } from '../src/server';
import { initializeSqliteDatabase, openSqliteDatabase } from '../src/db/sqlite';

const NOW = 1_700_000_000_000;

function createTempFrontendDist() {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'work-notes-dashboard-chat-sessions-api-'));
  const frontendDistPath = path.join(tempRoot, 'public');
  fs.mkdirSync(frontendDistPath, { recursive: true });
  fs.writeFileSync(
    path.join(frontendDistPath, 'index.html'),
    '<!doctype html><html><body>sessions</body></html>'
  );

  return {
    tempRoot,
    frontendDistPath
  };
}

test('chat sessions API lists sessions and loads transcripts', async () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'work-notes-dashboard-chat-sessions-db-'));
  const databasePath = path.join(tempRoot, 'notes.sqlite');
  const database = openSqliteDatabase(databasePath);
  initializeSqliteDatabase(database);
  database
    .prepare('INSERT INTO chat_sessions (id, name, createdAt, lastActivityAt) VALUES (?, ?, ?, ?)')
    .run('session-1', 'Named session', NOW - 2_000, NOW - 1_000);
  database
    .prepare('INSERT INTO chat_sessions (id, name, createdAt, lastActivityAt) VALUES (?, ?, ?, ?)')
    .run('session-2', null, NOW - 4_000, NOW - 2_000);
  database
    .prepare('INSERT INTO chat_messages (sessionId, role, content, createdAt) VALUES (?, ?, ?, ?)')
    .run('session-2', 'user', 'Draft a note.', NOW - 4_000);
  database
    .prepare('INSERT INTO chat_messages (sessionId, role, content, createdAt) VALUES (?, ?, ?, ?)')
    .run('session-2', 'assistant', 'Here is a draft.', NOW - 3_500);
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
    await request(server.app)
      .get('/api/chat/sessions')
      .expect(200)
      .expect((response) => {
        assert.deepEqual(response.body, {
          sessions: [
            {
              id: 'session-1',
              name: 'Named session',
              createdAt: NOW - 2_000,
              lastActivityAt: NOW - 1_000
            },
            {
              id: 'session-2',
              name: null,
              createdAt: NOW - 4_000,
              lastActivityAt: NOW - 2_000
            }
          ]
        });
      });

    await request(server.app)
      .get('/api/chat/sessions/session-2')
      .expect(200)
      .expect((response) => {
        assert.deepEqual(response.body, {
          session: {
            id: 'session-2',
            name: null,
            createdAt: NOW - 4_000,
            lastActivityAt: NOW - 2_000
          },
          messages: [
            {
              id: 1,
              sessionId: 'session-2',
              role: 'user',
              content: 'Draft a note.',
              createdAt: NOW - 4_000
            },
            {
              id: 2,
              sessionId: 'session-2',
              role: 'assistant',
              content: 'Here is a draft.',
              createdAt: NOW - 3_500
            }
          ]
        });
      });
  } finally {
    server.close();
    fs.rmSync(tempRoot, { recursive: true, force: true });
    fs.rmSync(frontendRoot, { recursive: true, force: true });
  }
});

test('chat sessions API validates session and limit inputs', async () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'work-notes-dashboard-chat-sessions-validation-'));
  const databasePath = path.join(tempRoot, 'notes.sqlite');
  const database = openSqliteDatabase(databasePath);
  initializeSqliteDatabase(database);
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
    await request(server.app)
      .get('/api/chat/sessions?limit=0')
      .expect(400)
      .expect((response) => {
        assert.equal(response.body.error, 'A valid session limit is required.');
      });

    await request(server.app)
      .get('/api/chat/sessions/%20%20%20')
      .expect(400)
      .expect((response) => {
        assert.equal(response.body.error, 'A valid session id is required.');
      });

    await request(server.app)
      .get('/api/chat/sessions/missing-session')
      .expect(404)
      .expect((response) => {
        assert.equal(response.body.error, 'Session missing-session was not found.');
      });
  } finally {
    server.close();
    fs.rmSync(tempRoot, { recursive: true, force: true });
    fs.rmSync(frontendRoot, { recursive: true, force: true });
  }
});
