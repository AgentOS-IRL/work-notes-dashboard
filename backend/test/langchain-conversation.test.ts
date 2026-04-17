import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { AIMessage } from '@langchain/core/messages';

import { initializeSqliteDatabase, openSqliteDatabase } from '../src/db/sqlite';
import { createConversationService } from '../src/langchain';
import { NotesRepository } from '../src/notes-repository';

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
  const invocationMessages: Array<Array<{ getType(): string }>> = [];
  let invocationCount = 0;

  const model = {
    bindTools(tools: Array<{ name?: string }>) {
      bindToolsCalls.push(tools.map((tool) => tool.name ?? ''));

      return {
        async invoke(messages: Array<{ getType(): string }>) {
          invocationCount += 1;
          invocationMessages.push(messages);

          if (invocationCount === 1) {
            assert.equal(messages[0].getType(), 'system');
            assert.equal(messages[1].getType(), 'human');

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
            assert.equal(messages[2].getType(), 'ai');
            assert.equal(messages[3].getType(), 'tool');

            return new AIMessage({
              content: '',
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

          return new AIMessage('Updated the sprint note.');
        }
      };
    }
  };

  try {
    const service = createConversationService({ repository, model });
    const response = await service.replyToConversation({
      messages: [
        {
          role: 'user',
          content: 'Make the sprint note clearer.'
        }
      ]
    });

    assert.deepEqual(bindToolsCalls, [
      ['create_note', 'get_note', 'list_notes', 'update_note']
    ]);
    assert.equal(invocationMessages.length, 3);
    assert.equal(response.notesChanged, true);
    assert.deepEqual(response.changedNoteIds, [1]);
    assert.deepEqual(response.assistantMessage, {
      role: 'assistant',
      content: 'Updated the sprint note.'
    });
    assert.equal(repository.getNoteById(1)?.title, 'Sprint plan refined');
  } finally {
    database.close();
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});
