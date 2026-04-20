import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { initializeSqliteDatabase, openSqliteDatabase } from '../src/db/sqlite';
import { ChatSessionRepository } from '../src/chat-session-repository';
import { createChatSessionService } from '../src/chat-session-service';

const NOW = 1_700_000_000_000;
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

test('chat session service persists turns and generates a session name after the threshold', async () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'work-notes-dashboard-chat-service-'));
  const databasePath = path.join(tempRoot, 'notes.sqlite');
  const database = openSqliteDatabase(databasePath);
  initializeSqliteDatabase(database);
  const repository = new ChatSessionRepository(database);

  const generatedNames: string[][] = [];
  const conversationService = {
    async replyToConversation(request: {
      sessionId: string;
      messages: Array<{ role: string; content: string }>;
      lockedNoteId?: number | null;
    }) {
      assert.equal(request.sessionId, 'session-abc');
      assert.equal(request.lockedNoteId ?? null, null);
        return {
          assistantMessage: {
            role: 'assistant',
            content: `Assistant reply ${request.messages.length}`
          },
          toolCalls: [],
          createdNoteIds: [],
          updatedNoteIds: [],
          changedNoteIds: [],
          openedNoteIds: [],
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
      toolCalls: [],
      createdNoteIds: [],
      updatedNoteIds: [],
      changedNoteIds: [],
      openedNoteIds: [],
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
      toolCalls: [],
      createdNoteIds: [],
      updatedNoteIds: [],
      changedNoteIds: [],
      openedNoteIds: [],
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

test('chat session service prunes expired rows before replying and refreshes session activity', async () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'work-notes-dashboard-chat-service-retention-'));
  const databasePath = path.join(tempRoot, 'notes.sqlite');
  const database = openSqliteDatabase(databasePath);
  initializeSqliteDatabase(database);
  const repository = new ChatSessionRepository(database, { now: () => NOW });
  const expiredAt = NOW - WEEK_MS - 1;
  const staleActivityAt = NOW - 10_000;

  database
    .prepare('INSERT INTO chat_sessions (id, name, createdAt, lastActivityAt) VALUES (?, ?, ?, ?)')
    .run('session-expired', 'Expired Session', expiredAt, expiredAt);
  database
    .prepare(
      'INSERT INTO chat_messages (sessionId, role, content, createdAt) VALUES (?, ?, ?, ?)'
    )
    .run('session-expired', 'user', 'Expired turn.', expiredAt);
  database
    .prepare('INSERT INTO chat_sessions (id, name, createdAt, lastActivityAt) VALUES (?, ?, ?, ?)')
    .run('session-active', null, staleActivityAt, staleActivityAt);

  const service = createChatSessionService({
    repository,
    conversationService: {
      async replyToConversation(request: { sessionId: string }) {
        assert.equal(request.sessionId, 'session-active');
        assert.equal(repository.getSessionById('session-expired'), null);
        assert.equal(repository.getSessionById('session-active')?.lastActivityAt, staleActivityAt);

        return {
          assistantMessage: {
            role: 'assistant',
            content: 'Assistant reply after cleanup'
          },
          toolCalls: [],
          createdNoteIds: [],
          updatedNoteIds: [],
          changedNoteIds: [],
          openedNoteIds: [],
          notesChanged: false
        };
      }
    }
  });

  try {
    const response = await service.replyToConversation({
      sessionId: 'session-active',
      messages: [
        {
          role: 'user',
          content: 'Continue the conversation.'
        }
      ]
    });

    assert.deepEqual(response, {
      assistantMessage: {
        role: 'assistant',
        content: 'Assistant reply after cleanup'
      },
      toolCalls: [],
      createdNoteIds: [],
      updatedNoteIds: [],
      changedNoteIds: [],
      openedNoteIds: [],
      notesChanged: false
    });
    assert.equal(repository.getSessionById('session-expired'), null);
    assert.equal(repository.getSessionById('session-active')?.lastActivityAt, NOW);
    assert.deepEqual(
      repository.getRecentMessages('session-active', 10).map((message) => ({
        role: message.role,
        content: message.content,
        createdAt: message.createdAt
      })),
      [
        {
          role: 'user',
          content: 'Continue the conversation.',
          createdAt: NOW
        },
        {
          role: 'assistant',
          content: 'Assistant reply after cleanup',
          createdAt: NOW
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
      async replyToConversation(request: { sessionId: string }) {
        assert.equal(request.sessionId, 'session-fail');
        return {
          assistantMessage: {
            role: 'assistant',
            content: 'Assistant reply'
          },
          toolCalls: [],
          createdNoteIds: [],
          updatedNoteIds: [],
          changedNoteIds: [],
          openedNoteIds: [],
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
      toolCalls: [],
      createdNoteIds: [],
      updatedNoteIds: [],
      changedNoteIds: [],
      openedNoteIds: [],
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
      toolCalls: [],
      createdNoteIds: [],
      updatedNoteIds: [],
      changedNoteIds: [],
      openedNoteIds: [],
      notesChanged: false
    });
    assert.equal(repository.getSessionById('session-fail')?.name, null);
    assert.equal(repository.countUserTurns('session-fail'), 2);
  } finally {
    database.close();
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

test('chat session service persists unlocked create-only metadata without locking', async () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'work-notes-dashboard-chat-service-metadata-'));
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
            content: 'Created notes.'
          },
          toolCalls: [
            {
              id: 'call-1',
              name: 'create_note',
              args: {
                title: 'Session summary'
              }
            }
          ],
          createdNoteIds: [10, 11, 10],
          updatedNoteIds: [],
          changedNoteIds: [10, 11],
          openedNoteIds: [],
          notesChanged: true
        };
      }
    }
  });

  try {
    const response = await service.replyToConversation({
      sessionId: 'session-metadata',
      messages: [
        {
          role: 'user',
          content: 'Create and update the note.'
        }
      ]
    });

    assert.deepEqual(response, {
      assistantMessage: {
        role: 'assistant',
        content: 'Created notes.'
      },
      toolCalls: [
        {
          id: 'call-1',
          name: 'create_note',
          args: {
            title: 'Session summary'
          }
        }
      ],
      createdNoteIds: [10, 11, 10],
      updatedNoteIds: [],
      changedNoteIds: [10, 11],
      openedNoteIds: [],
      notesChanged: true
    });
    assert.deepEqual(repository.getSessionById('session-metadata')?.metadata, {
      created: [10, 11],
      updated: [],
      lockedNoteId: null
    });
    assert.deepEqual(repository.getRecentMessages('session-metadata', 10).map((message) => ({
      role: message.role,
      content: message.content,
      toolCalls: message.toolCalls
    })), [
      {
        role: 'user',
        content: 'Create and update the note.',
        toolCalls: []
      },
      {
        role: 'assistant',
        content: 'Created notes.',
        toolCalls: [
          {
            id: 'call-1',
            name: 'create_note',
            args: {
              title: 'Session summary'
            }
          }
        ]
      }
    ]);
    assert.deepEqual(repository.getRecentMessages('session-metadata', 10)[1].toolCalls, [
      {
        id: 'call-1',
        name: 'create_note',
        args: {
          title: 'Session summary'
        }
      }
    ]);
  } finally {
    database.close();
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

test('chat session service persists the first update lock and reuses it on later turns', async () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'work-notes-dashboard-chat-service-lock-'));
  const databasePath = path.join(tempRoot, 'notes.sqlite');
  const database = openSqliteDatabase(databasePath);
  initializeSqliteDatabase(database);
  const repository = new ChatSessionRepository(database);

  let invocationCount = 0;
  const service = createChatSessionService({
    repository,
    conversationService: {
      async replyToConversation(request: {
        sessionId: string;
        messages: Array<{ role: string; content: string }>;
        lockedNoteId?: number | null;
      }) {
        invocationCount += 1;

        if (invocationCount === 1) {
          assert.equal(request.sessionId, 'session-lock');
          assert.equal(request.lockedNoteId ?? null, null);
          return {
            assistantMessage: {
              role: 'assistant',
              content: 'Updated the note.'
            },
            toolCalls: [
              {
                id: 'call-1',
                name: 'update_note',
                args: {
                  id: 7,
                  title: 'Weekly update',
                  content: 'Draft content'
                }
              }
            ],
            createdNoteIds: [],
            updatedNoteIds: [7],
            changedNoteIds: [7],
            openedNoteIds: [],
            lockedNoteId: 7,
            notesChanged: true
          };
        }

        assert.equal(request.sessionId, 'session-lock');
        assert.equal(request.lockedNoteId, 7);
        return {
          assistantMessage: {
            role: 'assistant',
            content: 'Updated the locked note.'
          },
          toolCalls: [
            {
              id: 'call-2',
              name: 'update_note',
              args: {
                title: 'Weekly update refined',
                content: 'Refined content'
              }
            }
          ],
          createdNoteIds: [],
          updatedNoteIds: [7],
          changedNoteIds: [7],
          openedNoteIds: [],
          lockedNoteId: 7,
          notesChanged: true
        };
      }
    }
  });

  try {
    const firstResponse = await service.replyToConversation({
      sessionId: 'session-lock',
      messages: [
        {
          role: 'user',
          content: 'Create a weekly update note.'
        }
      ]
    });

    assert.deepEqual(firstResponse.lockedNoteId, 7);
    assert.deepEqual(repository.getSessionById('session-lock')?.metadata, {
      created: [],
      updated: [7],
      lockedNoteId: 7
    });

    const secondResponse = await service.replyToConversation({
      sessionId: 'session-lock',
      messages: [
        {
          role: 'user',
          content: 'Refine the weekly update note.'
        }
      ]
    });

    assert.deepEqual(secondResponse.lockedNoteId, 7);
    assert.equal(invocationCount, 2);
    assert.deepEqual(repository.getSessionById('session-lock')?.metadata, {
      created: [],
      updated: [7],
      lockedNoteId: 7
    });
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
      async replyToConversation(request: { sessionId: string }) {
        assert.equal(request.sessionId, 'session-timeout');
        throw new Error('Upstream timeout.');
      }
    },
    generateSessionName: async () => {
      throw new Error('This should not be called.');
    },
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
