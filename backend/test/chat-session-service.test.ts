import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { initializeSqliteDatabase, openSqliteDatabase } from '../src/db/sqlite';
import { ChatSessionRepository } from '../src/chat-session-repository';
import { createChatSessionService } from '../src/chat-session-service';

test('chat session service persists turns and generates a session name after the threshold', async () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'work-notes-dashboard-chat-service-'));
  const databasePath = path.join(tempRoot, 'notes.sqlite');
  const database = openSqliteDatabase(databasePath);
  initializeSqliteDatabase(database);
  const repository = new ChatSessionRepository(database);

  const generatedNames: string[][] = [];
  const conversationService = {
    async replyToConversation(request: { messages: Array<{ role: string; content: string }> }) {
      return {
        assistantMessage: {
          role: 'assistant',
          content: `Assistant reply ${request.messages.length}`
        },
        changedNoteIds: [],
        notesChanged: false
      };
    }
  };

  const service = createChatSessionService({
    repository,
    conversationService,
    generateSessionName: async (messages) => {
      generatedNames.push(messages.map((message) => message.content));
      return 'Weekly Sprint Update';
    }
  });

  try {
    const firstResponse = await service.replyToConversation({
      sessionId: 'session-abc',
      messages: [
        {
          role: 'user',
          content: 'Draft the sprint update.'
        }
      ]
    });

    assert.deepEqual(firstResponse, {
      assistantMessage: {
        role: 'assistant',
        content: 'Assistant reply 1'
      },
      changedNoteIds: [],
      notesChanged: false
    });
    assert.equal(repository.countUserTurns('session-abc'), 1);
    assert.equal(repository.getSessionById('session-abc')?.name, null);

    const secondResponse = await service.replyToConversation({
      sessionId: 'session-abc',
      messages: [
        {
          role: 'user',
          content: 'Draft the sprint update.'
        },
        {
          role: 'assistant',
          content: 'Assistant reply 1'
        },
        {
          role: 'user',
          content: 'Make it shorter.'
        }
      ]
    });

    assert.deepEqual(secondResponse, {
      assistantMessage: {
        role: 'assistant',
        content: 'Assistant reply 3'
      },
      changedNoteIds: [],
      notesChanged: false
    });
    assert.equal(repository.countUserTurns('session-abc'), 2);
    assert.equal(repository.getSessionById('session-abc')?.name, 'Weekly Sprint Update');
    assert.deepEqual(generatedNames, [['Draft the sprint update.', 'Make it shorter.']]);
    assert.deepEqual(
      repository.getRecentMessages('session-abc', 10).map((message) => ({
        role: message.role,
        content: message.content
      })),
      [
        {
          role: 'user',
          content: 'Draft the sprint update.'
        },
        {
          role: 'assistant',
          content: 'Assistant reply 1'
        },
        {
          role: 'user',
          content: 'Make it shorter.'
        },
        {
          role: 'assistant',
          content: 'Assistant reply 3'
        }
      ]
    );
  } finally {
    database.close();
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

test('chat session service keeps the chat response working when naming fails', async () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'work-notes-dashboard-chat-service-fail-'));
  const databasePath = path.join(tempRoot, 'notes.sqlite');
  const database = openSqliteDatabase(databasePath);
  initializeSqliteDatabase(database);
  const repository = new ChatSessionRepository(database);

  const service = createChatSessionService({
    repository,
    conversationService: {
      async replyToConversation() {
        return {
          assistantMessage: {
            role: 'assistant',
            content: 'Assistant reply'
          },
          changedNoteIds: [],
          notesChanged: false
        };
      }
    },
    generateSessionName: async () => {
      throw new Error('OpenRouter unavailable.');
    }
  });

  try {
    const firstResponse = await service.replyToConversation({
      sessionId: 'session-fail',
      messages: [
        {
          role: 'user',
          content: 'Name this session.'
        }
      ]
    });

    assert.deepEqual(firstResponse, {
      assistantMessage: {
        role: 'assistant',
        content: 'Assistant reply'
      },
      changedNoteIds: [],
      notesChanged: false
    });

    const response = await service.replyToConversation({
      sessionId: 'session-fail',
      messages: [
        {
          role: 'user',
          content: 'Name this session.'
        },
        {
          role: 'assistant',
          content: 'Assistant reply'
        },
        {
          role: 'user',
          content: 'Try again.'
        }
      ]
    });

    assert.deepEqual(response, {
      assistantMessage: {
        role: 'assistant',
        content: 'Assistant reply'
      },
      changedNoteIds: [],
      notesChanged: false
    });
    assert.equal(repository.getSessionById('session-fail')?.name, null);
    assert.equal(repository.countUserTurns('session-fail'), 2);
  } finally {
    database.close();
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

test('chat session service does not persist a user turn when reply generation fails', async () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'work-notes-dashboard-chat-service-reply-fail-'));
  const databasePath = path.join(tempRoot, 'notes.sqlite');
  const database = openSqliteDatabase(databasePath);
  initializeSqliteDatabase(database);
  const repository = new ChatSessionRepository(database);

  const service = createChatSessionService({
    repository,
    conversationService: {
      async replyToConversation() {
        throw new Error('Upstream timeout.');
      }
    },
    generateSessionName: async () => {
      throw new Error('This should not be called.');
    }
  });

  try {
    await assert.rejects(
      service.replyToConversation({
        sessionId: 'session-timeout',
        messages: [
          {
            role: 'user',
            content: 'Draft a summary.'
          }
        ]
      }),
      /Upstream timeout\./
    );

    assert.equal(repository.getSessionById('session-timeout'), null);
    assert.throws(() => repository.countUserTurns('session-timeout'), /Session session-timeout was not found\./);
    assert.throws(
      () => repository.getRecentMessages('session-timeout', 10),
      /Session session-timeout was not found\./
    );
  } finally {
    database.close();
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});
