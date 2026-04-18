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
  repository.createNote({
    title: 'Meeting notes',
    content: 'A second note for paging.'
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
                  args: {
                    limit: 1,
                    offset: 1
                  }
                }
              ]
            });
          }

          if (invocationCount === 2) {
            assert.deepEqual(messageTypes(messages), ['system', 'human', 'ai', 'tool']);
            assert.equal(
              String(messages[3].content),
              JSON.stringify({
                titles: ['Meeting notes']
              })
            );

            return new AIMessage({
              content: 'I found the note and will refine it.',
              tool_calls: [
                {
                  id: 'call-2',
                  name: 'update_note',
                  args: {
                    id: 2,
                    title: 'Meeting notes refined',
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
                id: 2,
                title: 'Meeting notes refined',
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
    assert.deepEqual(response.createdNoteIds, []);
    assert.deepEqual(response.updatedNoteIds, [2]);
    assert.deepEqual(response.changedNoteIds, [2]);
    assert.deepEqual(response.openedNoteIds, []);
    assert.deepEqual(response.assistantMessage, {
      role: 'assistant',
      content: 'Updated the sprint note.'
    });
    assert.deepEqual(response.toolCalls, [
      {
        id: 'call-1',
        name: 'list_notes',
        args: {
          limit: 1,
          offset: 1
        }
      },
      {
        id: 'call-2',
        name: 'update_note',
        args: {
          id: 2,
          title: 'Meeting notes refined',
          content: 'Add a sharper project summary.'
        }
      }
    ]);
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

test('conversation service tracks created and updated note ids separately', async () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'work-notes-dashboard-conversation-created-updated-'));
  const databasePath = path.join(tempRoot, 'notes.sqlite');
  const database = openSqliteDatabase(databasePath);
  initializeSqliteDatabase(database);
  const repository = new NotesRepository(database);
  repository.createNote({
    title: 'Sprint plan',
    content: 'Draft the kickoff note.'
  });

  let invocationCount = 0;

  const model = {
    bindTools() {
      return {
        async invoke(messages: Array<{ getType(): string; content?: unknown }>) {
          invocationCount += 1;

          if (invocationCount === 1) {
            assert.deepEqual(messageTypes(messages), ['system', 'human']);

            return new AIMessage({
              content: 'I will create a note.',
              tool_calls: [
                {
                  id: 'call-1',
                  name: 'create_note',
                  args: {
                    title: 'Weekly update',
                    content: 'Draft the weekly update.'
                  }
                }
              ]
            });
          }

          if (invocationCount === 2) {
            assert.deepEqual(messageTypes(messages), ['system', 'human', 'ai', 'tool']);
            return new AIMessage({
              content: 'I will also update the sprint plan.',
              tool_calls: [
                {
                  id: 'call-2',
                  name: 'update_note',
                  args: {
                    id: 1,
                    title: 'Sprint plan refined',
                    content: 'Add the latest decisions.'
                  }
                }
              ]
            });
          }

          assert.deepEqual(messageTypes(messages), ['system', 'human', 'ai', 'tool', 'ai', 'tool']);
          return new AIMessage({
            content: 'Created and updated notes.'
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
          content: 'Create a weekly update and refine the sprint plan.'
        }
      ]
    });

    assert.deepEqual(response.createdNoteIds, [2]);
    assert.deepEqual(response.updatedNoteIds, [1]);
    assert.deepEqual(response.changedNoteIds, [2, 1]);
    assert.equal(response.notesChanged, true);
    assert.deepEqual(repository.getNoteById(1)?.title, 'Sprint plan refined');
    assert.deepEqual(repository.getNoteById(2)?.title, 'Weekly update');
  } finally {
    database.close();
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

test('conversation service tracks get_note reads as opened notes', async () => {
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
                  name: 'get_note',
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
    assert.deepEqual(response.createdNoteIds, []);
    assert.deepEqual(response.updatedNoteIds, []);
    assert.deepEqual(response.changedNoteIds, []);
    assert.deepEqual(response.openedNoteIds, [1]);
    assert.deepEqual(response.assistantMessage, {
      role: 'assistant',
      content: 'Opened the note for context.'
    });
    assert.deepEqual(response.toolCalls, [
      {
        id: 'call-1',
        name: 'get_note',
        args: {
          id: 1
        }
      }
    ]);
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

test('conversation service preserves tool-call order within a turn and across loops', async () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'work-notes-dashboard-conversation-tool-order-'));
  const databasePath = path.join(tempRoot, 'notes.sqlite');
  const database = openSqliteDatabase(databasePath);
  initializeSqliteDatabase(database);
  const repository = new NotesRepository(database);
  repository.createNote({
    title: 'Sprint plan',
    content: 'Draft the kickoff note.'
  });

  let invocationCount = 0;

  const model = {
    bindTools() {
      return {
        async invoke(messages: Array<{ getType(): string; content?: unknown }>) {
          invocationCount += 1;

          if (invocationCount === 1) {
            assert.deepEqual(messageTypes(messages), ['system', 'human']);

            return new AIMessage({
              content: 'I will inspect the notes first.',
              tool_calls: [
                {
                  id: 'call-1',
                  name: 'list_notes',
                  args: {}
                },
                {
                  id: 'call-2',
                  name: 'get_note',
                  args: {
                    id: 1
                  }
                }
              ]
            });
          }

          assert.deepEqual(messageTypes(messages), ['system', 'human', 'ai', 'tool', 'tool']);
          return new AIMessage({
            content: 'I inspected the note and am done.'
          });
        }
      };
    }
  };

  try {
    const service = createConversationService({ repository, model });
    const response = await service.replyToConversation({
      sessionId: 'session-order',
      messages: [
        {
          role: 'user',
          content: 'Check the sprint plan.'
        }
      ]
    });

    assert.deepEqual(response.toolCalls, [
      {
        id: 'call-1',
        name: 'list_notes',
        args: {}
      },
      {
        id: 'call-2',
        name: 'get_note',
        args: {
          id: 1
        }
      }
    ]);
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
