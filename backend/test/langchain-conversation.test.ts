import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { AIMessage } from '@langchain/core/messages';

import { initializeSqliteDatabase, openSqliteDatabase } from '../src/db/sqlite';
import { createConversationService } from '../src/langchain';
import { NotesRepository } from '../src/notes-repository';

function messageTypes(messages: Array<{ getType(): string }>) {
  return messages.map((message) => message.getType());
}

test('conversation service uses note tools to inspect and update notes', async () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'work-notes-dashboard-conversation-'));
  const databasePath = path.join(tempRoot, 'notes.sqlite');
  const database = openSqliteDatabase(databasePath);
  initializeSqliteDatabase(database);
  const repository = new NotesRepository(database);
  repository.createNote({
    title: 'Sprint plan',
    content: 'Draft the kickoff note.'
  });

  const bindToolsCalls: string[][] = [];
  const invocationMessages: Array<Array<{ getType(): string; content?: unknown }>> = [];
  let invocationCount = 0;

  const model = {
    bindTools(tools: Array<{ name?: string }>) {
      bindToolsCalls.push(tools.map((tool) => tool.name ?? ''));

      return {
        async invoke(messages: Array<{ getType(): string; content?: unknown }>) {
          invocationCount += 1;
          invocationMessages.push(messages);

          if (invocationCount === 1) {
            assert.deepEqual(messageTypes(messages), ['system', 'human']);

            return new AIMessage({
              content: 'I will inspect the notes first.',
              tool_calls: [
                {
                  id: 'call-1',
                  name: 'list_notes',
                  args: {}
                }
              ]
            });
          }

          if (invocationCount === 2) {
            assert.deepEqual(messageTypes(messages), ['system', 'human', 'ai', 'tool']);
            assert.equal(
              String(messages[3].content),
              JSON.stringify({
                notes: [
                  {
                    id: 1,
                    title: 'Sprint plan',
                    content: 'Draft the kickoff note.',
                    metadata: {
                      created: '',
                      updated: []
                    }
                  }
                ]
              })
            );

            return new AIMessage({
              content: 'I found the note and will refine it.',
              tool_calls: [
                {
                  id: 'call-2',
                  name: 'update_note',
                  args: {
                    id: 1,
                    title: 'Sprint plan refined',
                    content: 'Add a sharper project summary.'
                  }
                }
              ]
            });
          }

          assert.deepEqual(messageTypes(messages), ['system', 'human', 'ai', 'tool', 'ai', 'tool']);
          assert.equal(
            String(messages[5].content),
            JSON.stringify({
              note: {
                id: 1,
                title: 'Sprint plan refined',
                content: 'Add a sharper project summary.',
                metadata: {
                  created: '',
                  updated: ['session-abc']
                }
              }
            })
          );

          return new AIMessage({
            content: 'Updated the sprint note.'
          });
        }
      };
    }
  };

  try {
    const service = createConversationService({ repository, model });
    const response = await service.replyToConversation({
      sessionId: 'session-abc',
      messages: [
        {
          role: 'user',
          content: 'Make the sprint note clearer.'
        }
      ]
    });

    assert.deepEqual(bindToolsCalls, [
      ['create_note', 'get_note', 'open_note', 'list_notes', 'update_note']
    ]);
    assert.equal(invocationMessages.length, 3);
    assert.deepEqual(messageTypes(invocationMessages[0]), ['system', 'human']);
    assert.deepEqual(messageTypes(invocationMessages[1]), ['system', 'human', 'ai', 'tool']);
    assert.deepEqual(messageTypes(invocationMessages[2]), ['system', 'human', 'ai', 'tool', 'ai', 'tool']);
    assert.equal(response.notesChanged, true);
    assert.deepEqual(response.changedNoteIds, [1]);
    assert.deepEqual(response.openedNoteIds, []);
    assert.deepEqual(response.assistantMessage, {
      role: 'assistant',
      content: 'Updated the sprint note.'
    });
    assert.deepEqual(repository.getNoteById(1), {
      id: 1,
      title: 'Sprint plan refined',
      content: 'Add a sharper project summary.',
      metadata: {
        created: '',
        updated: ['session-abc']
      }
    });
  } finally {
    database.close();
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

test('conversation service tracks opened notes separately from note changes', async () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'work-notes-dashboard-conversation-open-'));
  const databasePath = path.join(tempRoot, 'notes.sqlite');
  const database = openSqliteDatabase(databasePath);
  initializeSqliteDatabase(database);
  const repository = new NotesRepository(database);
  repository.createNote({
    title: 'Sprint plan',
    content: 'Draft the kickoff note.'
  });

  const invocationMessages: Array<Array<{ getType(): string; content?: unknown }>> = [];
  let invocationCount = 0;

  const model = {
    bindTools() {
      return {
        async invoke(messages: Array<{ getType(): string; content?: unknown }>) {
          invocationCount += 1;
          invocationMessages.push(messages);

          if (invocationCount === 1) {
            assert.deepEqual(messageTypes(messages), ['system', 'human']);

            return new AIMessage({
              content: 'I will open the note.',
              tool_calls: [
                {
                  id: 'call-1',
                  name: 'open_note',
                  args: {
                    id: 1
                  }
                }
              ]
            });
          }

          assert.deepEqual(messageTypes(messages), ['system', 'human', 'ai', 'tool']);
          assert.equal(
            String(messages[3].content),
            JSON.stringify({
              note: {
                id: 1,
                title: 'Sprint plan',
                content: 'Draft the kickoff note.',
                metadata: {
                  created: '',
                  updated: []
                }
              }
            })
          );

          return new AIMessage({
            content: 'Opened the note for context.'
          });
        }
      };
    }
  };

  try {
    const service = createConversationService({ repository, model });
    const response = await service.replyToConversation({
      sessionId: 'session-open',
      messages: [
        {
          role: 'user',
          content: 'Open the sprint plan.'
        }
      ]
    });

    assert.equal(invocationCount, 2);
    assert.deepEqual(messageTypes(invocationMessages[0]), ['system', 'human']);
    assert.deepEqual(messageTypes(invocationMessages[1]), ['system', 'human', 'ai', 'tool']);
    assert.equal(response.notesChanged, false);
    assert.deepEqual(response.changedNoteIds, []);
    assert.deepEqual(response.openedNoteIds, [1]);
    assert.deepEqual(response.assistantMessage, {
      role: 'assistant',
      content: 'Opened the note for context.'
    });
    assert.deepEqual(repository.getNoteById(1), {
      id: 1,
      title: 'Sprint plan',
      content: 'Draft the kickoff note.',
      metadata: {
        created: '',
        updated: []
      }
    });
  } finally {
    database.close();
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

test('conversation service rejects an empty assistant response before returning', async () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'work-notes-dashboard-conversation-empty-'));
  const databasePath = path.join(tempRoot, 'notes.sqlite');
  const database = openSqliteDatabase(databasePath);
  initializeSqliteDatabase(database);
  const repository = new NotesRepository(database);

  const model = {
    bindTools() {
      return {
        async invoke() {
          return new AIMessage('   ');
        }
      };
    }
  };

  try {
    const service = createConversationService({ repository, model });

    await assert.rejects(
      () =>
        service.replyToConversation({
          sessionId: 'session-empty',
          messages: [
            {
              role: 'user',
              content: 'Say nothing.'
            }
          ]
        }),
      /empty response/
    );
  } finally {
    database.close();
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});
