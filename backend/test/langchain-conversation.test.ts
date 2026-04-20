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

function systemMessageContent(messages: Array<{ getType(): string; content?: unknown }>) {
  const systemMessage = messages.find((message) => message.getType() === 'system');
  return typeof systemMessage?.content === 'string' ? systemMessage.content : '';
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
                notes: [
                  {
                    id: 2,
                    title: 'Meeting notes'
                  }
                ],
                hasMore: false,
                nextOffset: null
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
      ['create_note', 'read_note', 'open_note', 'list_notes', 'update_note'],
      ['create_note', 'read_note', 'open_note', 'list_notes', 'update_note']
    ]);
    assert.equal(invocationMessages.length, 2);
    assert.match(
      systemMessageContent(invocationMessages[0]),
      /You are a work notes assistant inside a split-view dashboard\./
    );
    assert.doesNotMatch(systemMessageContent(invocationMessages[0]), /may only use update_note/i);
    assert.deepEqual(messageTypes(invocationMessages[0]), ['system', 'human']);
    assert.deepEqual(messageTypes(invocationMessages[1]), ['system', 'human', 'ai', 'tool']);
    assert.deepEqual(response.assistantMessage, {
      role: 'assistant',
      content: 'Updated note 2.'
    });
    assert.equal(response.notesChanged, true);
    assert.deepEqual(response.createdNoteIds, []);
    assert.deepEqual(response.updatedNoteIds, [2]);
    assert.deepEqual(response.changedNoteIds, [2]);
    assert.deepEqual(response.openedNoteIds, []);
    assert.deepEqual(response.assistantMessage, {
      role: 'assistant',
      content: 'Updated note 2.'
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
    assert.equal(response.lockedNoteId, 2);
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

test('conversation service leaves an unlocked create-only reply unlocked', async () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'work-notes-dashboard-conversation-create-only-'));
  const databasePath = path.join(tempRoot, 'notes.sqlite');
  const database = openSqliteDatabase(databasePath);
  initializeSqliteDatabase(database);
  const repository = new NotesRepository(database);

  let invocationCount = 0;

  const model = {
    bindTools(tools: Array<{ name?: string }>) {
      assert.deepEqual(tools.map((tool) => tool.name ?? ''), ['create_note', 'read_note', 'open_note', 'list_notes', 'update_note']);

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

          assert.deepEqual(messageTypes(messages), ['system', 'human', 'ai', 'tool']);
          return new AIMessage({
            content: 'Created the weekly update.'
          });
        }
      };
    }
  };

  try {
    const service = createConversationService({ repository, model });
    const response = await service.replyToConversation({
      sessionId: 'session-create-only',
      messages: [
        {
          role: 'user',
          content: 'Create a weekly update.'
        }
      ]
    });

    assert.equal(invocationCount, 1);
    assert.deepEqual(response.assistantMessage, {
      role: 'assistant',
      content: 'Created note 1.'
    });
    assert.equal(response.lockedNoteId, undefined);
    assert.deepEqual(response.createdNoteIds, [1]);
    assert.deepEqual(response.updatedNoteIds, []);
    assert.deepEqual(response.changedNoteIds, [1]);
    assert.equal(response.notesChanged, true);
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

  const bindToolsCalls: string[][] = [];
  let invocationCount = 0;

  const model = {
    bindTools(tools: Array<{ name?: string }>) {
      bindToolsCalls.push(tools.map((tool) => tool.name ?? ''));

      return {
        async invoke(messages: Array<{ getType(): string; content?: unknown }>) {
          invocationCount += 1;

          if (invocationCount === 1) {
            assert.deepEqual(messageTypes(messages), ['system', 'human']);

            return new AIMessage({
              content: 'I will create and refine a note.',
              tool_calls: [
                {
                  id: 'call-1',
                  name: 'create_note',
                  args: {
                    title: 'Weekly update',
                    content: 'Draft the weekly update.'
                  }
                },
                {
                  id: 'call-2',
                  name: 'update_note',
                  args: {
                    id: 2,
                    title: 'Sprint plan refined',
                    content: 'Add the latest decisions.'
                  }
                }
              ]
            });
          }

          if (invocationCount === 2) {
            assert.match(
              systemMessageContent(messages),
              /You are a work notes assistant inside a split-view dashboard\./
            );
            assert.doesNotMatch(systemMessageContent(messages), /may only use update_note/i);
            assert.deepEqual(messageTypes(messages), ['system', 'human', 'ai', 'tool', 'tool']);
            return new AIMessage({
              content: 'Created and updated notes.'
            });
          }

          throw new Error('Unexpected invocation count.');
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
    assert.deepEqual(response.updatedNoteIds, [2]);
    assert.deepEqual(response.changedNoteIds, [2]);
    assert.deepEqual(response.lockedNoteId, 2);
    assert.equal(response.notesChanged, true);
    assert.deepEqual(bindToolsCalls, [
      ['create_note', 'read_note', 'open_note', 'list_notes', 'update_note'],
      ['create_note', 'read_note', 'open_note', 'list_notes', 'update_note']
    ]);
    assert.deepEqual(repository.getNoteById(1)?.title, 'Sprint plan');
    assert.deepEqual(repository.getNoteById(2)?.title, 'Sprint plan refined');
  } finally {
    database.close();
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

test('conversation service starts in locked mode when the session is already locked', async () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'work-notes-dashboard-conversation-locked-'));
  const databasePath = path.join(tempRoot, 'notes.sqlite');
  const database = openSqliteDatabase(databasePath);
  initializeSqliteDatabase(database);
  const repository = new NotesRepository(database);
  repository.createNote({
    title: 'Locked note',
    content: 'Draft content.'
  });
  repository.createNote({
    title: 'Other note',
    content: 'Other content.'
  });

  const bindToolsCalls: string[][] = [];
  const invocationMessages: Array<Array<{ getType(): string; content?: unknown }>> = [];
  let invocationCount = 0;

  const model = {
    bindTools(tools: Array<{ name?: string }>) {
      bindToolsCalls.push(tools.map((tool) => tool.name ?? ''));

      return {
        async invoke(messages: Array<{ getType(): string; content?: unknown }>) {
          invocationMessages.push(messages);
          invocationCount += 1;

          if (invocationCount === 1) {
            assert.deepEqual(messageTypes(messages), ['system', 'human', 'human']);
            assert.match(String(messages[0].content), /The conversation is locked to a single note/);
            assert.match(
              String(messages[0].content),
              /You will also receive the current note body as internal context\./
            );
            assert.match(String(messages[1].content), /Current locked note context:/);
            assert.match(String(messages[1].content), /Title: Locked note/);
            assert.match(String(messages[1].content), /Draft content\./);
            assert.equal(String(messages[2].content), 'Refine the locked note.');

            return new AIMessage({
              content: 'I will update the locked note.',
              tool_calls: [
                {
                  id: 'call-1',
                  name: 'update_note',
                  args: {
                    id: 1,
                    title: 'Locked note refined',
                    content: 'Refined content.'
                  }
                }
              ]
            });
          }

          assert.deepEqual(messageTypes(messages), ['system', 'human', 'human', 'ai', 'tool']);
          return new AIMessage({
            content: 'Updated the locked note.'
          });
        }
      };
    }
  };

  try {
    const service = createConversationService({ repository, model });
    const response = await service.replyToConversation({
      sessionId: 'session-locked',
      lockedNoteId: 1,
      messages: [
        {
          role: 'user',
          content: 'Refine the locked note.'
        }
      ]
    });

    assert.deepEqual(bindToolsCalls, [[
      'create_note',
      'read_note',
      'open_note',
      'list_notes',
      'update_note'
    ]]);
    assert.equal(invocationMessages.length, 1);
    assert.match(
      systemMessageContent(invocationMessages[0]),
      /The conversation is locked to a single note, so treat that note as the active editing target\./
    );
    assert.match(
      systemMessageContent(invocationMessages[0]),
      /You will also receive the current note body as internal context\./
    );
    assert.match(
      systemMessageContent(invocationMessages[0]),
      /After each user message, reorganize and update the note\./i
    );
    assert.deepEqual(messageTypes(invocationMessages[0]), ['system', 'human', 'human']);
    assert.deepEqual(response.assistantMessage, {
      role: 'assistant',
      content: 'Updated note 1.'
    });
    assert.deepEqual(response.lockedNoteId, 1);
    assert.deepEqual(response.updatedNoteIds, [1]);
    assert.deepEqual(repository.getNoteById(1)?.title, 'Locked note refined');
    assert.deepEqual(repository.getNoteById(2)?.title, 'Other note');
  } finally {
    database.close();
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

test('conversation service fails when the locked note no longer exists', async () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'work-notes-dashboard-conversation-locked-missing-'));
  const databasePath = path.join(tempRoot, 'notes.sqlite');
  const database = openSqliteDatabase(databasePath);
  initializeSqliteDatabase(database);
  const repository = new NotesRepository(database);

  const model = {
    bindTools() {
      throw new Error('should not bind tools when the locked note is missing');
    }
  };

  try {
    const service = createConversationService({ repository, model });

    await assert.rejects(
      () =>
        service.replyToConversation({
          sessionId: 'session-locked-missing',
          lockedNoteId: 1,
          messages: [
            {
              role: 'user',
              content: 'Refine the locked note.'
            }
          ]
        }),
      /Note 1 was not found\./
    );
  } finally {
    database.close();
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

test('conversation service tracks read_note reads separately from opened notes', async () => {
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
              content: 'I will read the note.',
              tool_calls: [
                {
                  id: 'call-1',
                  name: 'read_note',
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
            content: 'Read the note for context.'
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
    assert.equal(response.notesChanged, false);
    assert.deepEqual(response.createdNoteIds, []);
    assert.deepEqual(response.updatedNoteIds, []);
    assert.deepEqual(response.changedNoteIds, []);
    assert.deepEqual(response.openedNoteIds, []);
    assert.deepEqual(response.assistantMessage, {
      role: 'assistant',
      content: 'Read the note for context.'
    });
    assert.deepEqual(response.toolCalls, [
      {
        id: 'call-1',
        name: 'read_note',
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

test('conversation service tracks open_note calls as opened notes', async () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'work-notes-dashboard-conversation-open-note-'));
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
            content: 'Opened note 1.'
          });
        }
      };
    }
  };

  try {
    const service = createConversationService({ repository, model });
    const response = await service.replyToConversation({
      sessionId: 'session-open-note',
      messages: [
        {
          role: 'user',
          content: 'Open the sprint plan.'
        }
      ]
    });

    assert.equal(invocationCount, 1);
    assert.equal(response.notesChanged, false);
    assert.deepEqual(response.createdNoteIds, []);
    assert.deepEqual(response.updatedNoteIds, []);
    assert.deepEqual(response.changedNoteIds, []);
    assert.deepEqual(response.openedNoteIds, [1]);
    assert.deepEqual(response.assistantMessage, {
      role: 'assistant',
      content: 'Opened note 1.'
    });
    assert.deepEqual(response.toolCalls, [
      {
        id: 'call-1',
        name: 'open_note',
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

test('conversation service synthesizes a reply when open_note returns no assistant text', async () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'work-notes-dashboard-conversation-open-note-empty-'));
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
          return new AIMessage('   ');
        }
      };
    }
  };

  try {
    const service = createConversationService({ repository, model });
    const response = await service.replyToConversation({
      sessionId: 'session-open-note-empty',
      messages: [
        {
          role: 'user',
          content: 'Open the sprint plan.'
        }
      ]
    });

    assert.equal(invocationCount, 1);
    assert.equal(response.notesChanged, false);
    assert.deepEqual(response.openedNoteIds, [1]);
    assert.deepEqual(response.assistantMessage, {
      role: 'assistant',
      content: 'Opened note 1.'
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
                  name: 'read_note',
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
        name: 'read_note',
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
