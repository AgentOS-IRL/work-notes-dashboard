import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import express from 'express';
import request from 'supertest';

import { ChatSessionRepository } from '../src/chat-session-repository';
import { createChatSessionsRouter } from '../src/routes/chat-sessions';
import { initializeSqliteDatabase, openSqliteDatabase } from '../src/db/sqlite';

const NOW = 1_700_000_000_000;

function createChatSessionsApp(databasePath: string) {
  const database = openSqliteDatabase(databasePath);
  const app = express();
  app.use(express.json());
  app.use('/api/chat/sessions', createChatSessionsRouter(new ChatSessionRepository(database, {
    now: () => NOW
  })));

  return { app, database };
}

test('chat sessions API lists sessions and loads transcripts', async () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'work-notes-dashboard-chat-sessions-db-'));
  const databasePath = path.join(tempRoot, 'notes.sqlite');
  const database = openSqliteDatabase(databasePath);
  initializeSqliteDatabase(database);
  database
    .prepare(
      'INSERT INTO chat_sessions (id, name, createdAt, lastActivityAt, metadata) VALUES (?, ?, ?, ?, ?)'
    )
    .run(
      'session-1',
      'Named session',
      NOW - 2_000,
      NOW - 1_000,
      '{"created":[1],"updated":[1,2],"lockedNoteId":1}'
    );
  database
    .prepare(
      'INSERT INTO chat_sessions (id, name, createdAt, lastActivityAt, metadata) VALUES (?, ?, ?, ?, ?)'
    )
    .run('session-2', null, NOW - 4_000, NOW - 2_000, '{"created":[],"updated":[3],"lockedNoteId":null}');
  database
    .prepare(
      'INSERT INTO chat_messages (sessionId, role, content, createdAt, toolCalls) VALUES (?, ?, ?, ?, ?)'
    )
    .run('session-2', 'user', 'Draft a note.', NOW - 4_000, null);
  database
    .prepare(
      'INSERT INTO chat_messages (sessionId, role, content, createdAt, toolCalls) VALUES (?, ?, ?, ?, ?)'
    )
    .run(
      'session-2',
      'assistant',
      'Here is a draft.',
      NOW - 3_500,
      '[{"id":"call-1","name":"create_note","args":{"title":"Sprint plan"}}]'
  );
  database.close();

  const { app, database: appDatabase } = createChatSessionsApp(databasePath);

  try {
    await request(app)
      .get('/api/chat/sessions')
      .expect(200)
      .expect((response) => {
        assert.deepEqual(response.body, {
          sessions: [
            {
              id: 'session-1',
              name: 'Named session',
              createdAt: NOW - 2_000,
              lastActivityAt: NOW - 1_000,
              metadata: {
                created: [1],
                updated: [1, 2],
                lockedNoteId: 1
              }
            },
            {
              id: 'session-2',
              name: null,
              createdAt: NOW - 4_000,
              lastActivityAt: NOW - 2_000,
              metadata: {
                created: [],
                updated: [3],
                lockedNoteId: null
              }
            }
          ]
        });
      });

    await request(app)
      .get('/api/chat/sessions/session-2')
      .expect(200)
      .expect((response) => {
        assert.deepEqual(response.body, {
          session: {
            id: 'session-2',
            name: null,
            createdAt: NOW - 4_000,
            lastActivityAt: NOW - 2_000,
            metadata: {
              created: [],
              updated: [3],
              lockedNoteId: null
            },
            toolCalls: []
          },
          messages: [
            {
              id: 1,
              sessionId: 'session-2',
              role: 'user',
              content: 'Draft a note.',
              createdAt: NOW - 4_000,
              toolCalls: []
            },
            {
              id: 2,
              sessionId: 'session-2',
              role: 'assistant',
              content: 'Here is a draft.',
              createdAt: NOW - 3_500,
              toolCalls: [
                {
                  id: 'call-1',
                  name: 'create_note',
                  args: {
                    title: 'Sprint plan'
                  }
                }
              ]
            }
          ]
        });
      });
  } finally {
    appDatabase.close();
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

test('chat sessions API renames a session and returns the updated label', async () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'work-notes-dashboard-chat-sessions-rename-'));
  const databasePath = path.join(tempRoot, 'notes.sqlite');
  const database = openSqliteDatabase(databasePath);
  initializeSqliteDatabase(database);
  database
    .prepare(
      'INSERT INTO chat_sessions (id, name, createdAt, lastActivityAt, metadata) VALUES (?, ?, ?, ?, ?)'
    )
    .run('session-1', null, NOW - 2_000, NOW - 1_000, '{"created":[],"updated":[],"lockedNoteId":null}');
  database.close();

  const { app, database: appDatabase } = createChatSessionsApp(databasePath);

  try {
    await request(app)
      .patch('/api/chat/sessions/session-1')
      .send({ name: 'Updated session name' })
      .expect(200)
      .expect((response) => {
        assert.deepEqual(response.body, {
          session: {
            id: 'session-1',
            name: 'Updated session name',
            createdAt: NOW - 2_000,
            lastActivityAt: NOW - 1_000,
            metadata: {
              created: [],
              updated: [],
              lockedNoteId: null
            },
            toolCalls: []
          }
        });
      });

    await request(app)
      .get('/api/chat/sessions/session-1')
      .expect(200)
      .expect((response) => {
        assert.equal(response.body.session.name, 'Updated session name');
      });

    await request(app)
      .get('/api/chat/sessions')
      .expect(200)
      .expect((response) => {
        assert.equal(response.body.sessions[0].name, 'Updated session name');
      });
  } finally {
    appDatabase.close();
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

test('chat sessions API validates session and limit inputs', async () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'work-notes-dashboard-chat-sessions-validation-'));
  const databasePath = path.join(tempRoot, 'notes.sqlite');
  const database = openSqliteDatabase(databasePath);
  initializeSqliteDatabase(database);
  database.close();

  const { app, database: appDatabase } = createChatSessionsApp(databasePath);

  try {
    await request(app)
      .get('/api/chat/sessions?limit=0')
      .expect(400)
      .expect((response) => {
        assert.equal(response.body.error, 'A valid session limit is required.');
      });

    await request(app)
      .get('/api/chat/sessions/%20%20%20')
      .expect(400)
      .expect((response) => {
        assert.equal(response.body.error, 'A valid session id is required.');
      });

    await request(app)
      .get('/api/chat/sessions/missing-session')
      .expect(404)
      .expect((response) => {
        assert.equal(response.body.error, 'Session missing-session was not found.');
      });
  } finally {
    appDatabase.close();
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

test('chat sessions API validates rename input and session existence', async () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'work-notes-dashboard-chat-sessions-rename-validation-'));
  const databasePath = path.join(tempRoot, 'notes.sqlite');
  const database = openSqliteDatabase(databasePath);
  initializeSqliteDatabase(database);
  database.close();

  const { app, database: appDatabase } = createChatSessionsApp(databasePath);

  try {
    await request(app)
      .patch('/api/chat/sessions/%20%20%20')
      .send({ name: 'Updated session name' })
      .expect(400)
      .expect((response) => {
        assert.equal(response.body.error, 'A valid session id is required.');
      });

    await request(app)
      .patch('/api/chat/sessions/session-1')
      .send({})
      .expect(400)
      .expect((response) => {
        assert.equal(response.body.error, 'A valid session name is required.');
      });

    await request(app)
      .patch('/api/chat/sessions/session-1')
      .send({ name: '   ' })
      .expect(400)
      .expect((response) => {
        assert.equal(response.body.error, 'A valid session name is required.');
      });

    await request(app)
      .patch('/api/chat/sessions/missing-session')
      .send({ name: 'Updated session name' })
      .expect(404)
      .expect((response) => {
        assert.equal(response.body.error, 'Session missing-session was not found.');
      });

    await request(app)
      .patch('/api/chat/sessions/session-1')
      .send([])
      .expect(400)
      .expect((response) => {
        assert.equal(response.body.error, 'A valid session name is required.');
      });
  } finally {
    appDatabase.close();
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});
