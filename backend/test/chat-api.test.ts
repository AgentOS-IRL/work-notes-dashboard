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
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'work-notes-dashboard-chat-api-'));
  const frontendDistPath = path.join(tempRoot, 'public');
  fs.mkdirSync(frontendDistPath, { recursive: true });
  fs.writeFileSync(
    path.join(frontendDistPath, 'index.html'),
    '<!doctype html><html><body>chat</body></html>'
  );

  return {
    tempRoot,
    frontendDistPath
  };
}

test('chat API returns assistant replies and note change metadata', async () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'work-notes-dashboard-chat-db-'));
  const databasePath = path.join(tempRoot, 'notes.sqlite');
  const database = openSqliteDatabase(databasePath);
  initializeSqliteDatabase(database);
  database.close();
  const { tempRoot: frontendRoot, frontendDistPath } = createTempFrontendDist();
  const serverState = { current: null as ReturnType<typeof createServer> | null };
  const server = createServer({
    databasePath,
    frontendDistPath,
    chatSessionRepositoryOptions: {
      now: () => NOW
    },
    conversationService: {
      async replyToConversation(requestBody: {
        sessionId: string;
        messages: Array<{ role: string; content: string }>;
      }) {
        assert.equal(requestBody.sessionId, 'session-123');
        assert.deepEqual(requestBody.messages, [
          {
            role: 'user',
            content: 'Refine the sprint plan.'
          }
        ]);

        assert.ok(serverState.current);
        const repository = new ChatSessionRepository(serverState.current.database, {
          now: () => NOW
        });
        assert.equal(repository.getSessionById('session-expired'), null);

        return {
          assistantMessage: {
            role: 'assistant',
            content: 'I updated the sprint plan note.'
          },
          toolCalls: [
            {
              id: 'call-1',
              name: 'update_note',
              args: {
                id: 1
              }
            }
          ],
          createdNoteIds: [1],
          updatedNoteIds: [1],
          changedNoteIds: [1],
          openedNoteIds: [],
          lockedNoteId: 1,
          notesChanged: true
        };
      }
    }
  });
  serverState.current = server;

  server.database
    .prepare('INSERT INTO chat_sessions (id, name, createdAt, lastActivityAt) VALUES (?, ?, ?, ?)')
    .run('session-expired', 'Expired Session', NOW - WEEK_MS - 1, NOW - WEEK_MS - 1);
  server.database
    .prepare('INSERT INTO chat_messages (sessionId, role, content, createdAt) VALUES (?, ?, ?, ?)')
    .run('session-expired', 'user', 'Expired message.', NOW - WEEK_MS - 1);

  try {
    await request(server.app)
      .post('/api/chat')
      .send({
        sessionId: 'session-123',
        messages: [
          {
            role: 'user',
            content: 'Refine the sprint plan.'
          }
        ]
      })
      .expect(200)
      .expect((response) => {
        assert.deepEqual(response.body, {
          assistantMessage: {
            role: 'assistant',
            content: 'I updated the sprint plan note.'
          },
          toolCalls: [
            {
              id: 'call-1',
              name: 'update_note',
              args: {
                id: 1
              }
            }
          ],
          createdNoteIds: [1],
          updatedNoteIds: [1],
          changedNoteIds: [1],
          openedNoteIds: [],
          lockedNoteId: 1,
          notesChanged: true
        });
      });

    const repository = new ChatSessionRepository(server.database, { now: () => NOW });
    assert.equal(repository.getSessionById('session-expired'), null);
    assert.deepEqual(repository.getSessionById('session-123'), {
      id: 'session-123',
      name: null,
      createdAt: NOW,
      lastActivityAt: NOW,
      metadata: {
        created: [1],
        updated: [1],
        lockedNoteId: 1
      },
      toolCalls: []
    });
    assert.deepEqual(
      repository.getRecentMessages('session-123', 10).map((message) => ({
        role: message.role,
        content: message.content,
        createdAt: message.createdAt,
        toolCalls: message.toolCalls
      })),
      [
        {
          role: 'user',
          content: 'Refine the sprint plan.',
          createdAt: NOW,
          toolCalls: []
        },
        {
          role: 'assistant',
          content: 'I updated the sprint plan note.',
          createdAt: NOW,
          toolCalls: [
            {
              id: 'call-1',
              name: 'update_note',
              args: {
                id: 1
              }
            }
          ]
        }
      ]
    );

    await request(server.app)
      .post('/api/chat')
      .send({})
      .expect(400)
      .expect((response) => {
        assert.equal(
          response.body.error,
          'Request body must include a sessionId and a non-empty messages array.'
        );
      });
  } finally {
    server.close();
    fs.rmSync(tempRoot, { recursive: true, force: true });
    fs.rmSync(frontendRoot, { recursive: true, force: true });
  }
});
