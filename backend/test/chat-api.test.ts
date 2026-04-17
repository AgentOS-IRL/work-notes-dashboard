import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import request from 'supertest';

import { createServer } from '../src/server';

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
  const { tempRoot: frontendRoot, frontendDistPath } = createTempFrontendDist();
  const conversationService = {
    async replyToConversation(requestBody: { messages: Array<{ role: string; content: string }> }) {
      assert.deepEqual(requestBody.messages, [
        {
          role: 'user',
          content: 'Refine the sprint plan.'
        }
      ]);

      return {
        assistantMessage: {
          role: 'assistant',
          content: 'I updated the sprint plan note.'
        },
        changedNoteIds: [1],
        notesChanged: true
      };
    }
  };
  const server = createServer({
    databasePath,
    frontendDistPath,
    conversationService
  });

  try {
    await request(server.app)
      .post('/api/chat')
      .send({
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
          changedNoteIds: [1],
          notesChanged: true
        });
      });

    await request(server.app)
      .post('/api/chat')
      .send({})
      .expect(400)
      .expect((response) => {
        assert.equal(response.body.error, 'Request body must include a non-empty messages array.');
      });
  } finally {
    server.close();
    fs.rmSync(tempRoot, { recursive: true, force: true });
    fs.rmSync(frontendRoot, { recursive: true, force: true });
  }
});

