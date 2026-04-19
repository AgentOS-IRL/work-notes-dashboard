import { describe, expect, it, vi } from 'vitest';
import { formatChatSessionLabel, useChat } from '~/composables/useChat';

function jsonResponse(body: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(body), {
    status: init?.status ?? 200,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {})
    }
  });
}

describe('useChat', () => {
  it('loads session lists and formats unnamed session labels', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      jsonResponse({
        sessions: [
          {
            id: 'session-1',
            name: 'Named session',
            createdAt: 1_700_000_000_000,
            lastActivityAt: 1_700_000_000_000,
            metadata: {
              created: [1],
              updated: [1],
              lockedNoteId: null
            }
          },
          {
            id: 'session-2',
            name: null,
            createdAt: 1_700_000_100_000,
            lastActivityAt: 1_700_000_100_000,
            metadata: {
              created: [],
              updated: [],
              lockedNoteId: null
            }
          }
        ]
      })
    );

    vi.stubGlobal('fetch', fetchMock);

    const chat = useChat();
    await chat.loadSessions();

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/chat/sessions',
      expect.objectContaining({
        method: 'GET'
      })
    );
    expect(chat.sessions.value).toHaveLength(2);
    expect(chat.sessions.value[0].label).toBe('Named session');
    expect(chat.sessions.value[1].label).toMatch(/2023|2024|2025|2026/);
    expect(chat.sessions.value[1].label).toMatch(/:/);
    expect(
      formatChatSessionLabel({
        name: null,
        createdAt: 1_700_000_100_000
      })
    ).toMatch(/:/);
  });

  it('restores a loaded session transcript and continues sending from it', async () => {
    const notesChanged = vi.fn();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          sessions: [
            {
              id: 'session-1',
              name: 'Weekly update',
              createdAt: 1_700_000_000_000,
              lastActivityAt: 1_700_000_000_000,
              metadata: {
                created: [],
                updated: [],
                lockedNoteId: 1
              }
            }
          ]
        })
      )
      .mockResolvedValueOnce(
        jsonResponse({
          session: {
            id: 'session-1',
            name: 'Weekly update',
            createdAt: 1_700_000_000_000,
            lastActivityAt: 1_700_000_000_000,
            metadata: {
              created: [],
              updated: [1],
              lockedNoteId: 1
            }
          },
          messages: [
            {
              id: 1,
              role: 'user',
              content: 'Draft a weekly update.',
              toolCalls: []
            },
            {
              id: 2,
              role: 'assistant',
              content: 'Here is a draft.',
              toolCalls: [
                {
                  id: 'call-1',
                  type: 'function',
                  name: 'createNote',
                  arguments: {
                    title: 'Weekly update'
                  }
                }
              ]
            }
          ]
        })
      )
      .mockResolvedValueOnce(
        jsonResponse({
          sessions: [
            {
              id: 'session-1',
              name: 'Weekly update',
              createdAt: 1_700_000_000_000,
              lastActivityAt: 1_700_000_000_000,
              metadata: {
                created: [],
                updated: [1],
                lockedNoteId: 1
              }
            }
          ]
        })
      )
      .mockResolvedValueOnce(
        jsonResponse({
          assistantMessage: {
            role: 'assistant',
            content: 'I refined the sprint plan.'
          },
          toolCalls: [
            {
              id: 'call-2',
              type: 'function',
              name: 'updateNote',
              arguments: {
                id: 1,
                title: 'Sprint plan'
              }
            }
          ],
          createdNoteIds: [1],
          updatedNoteIds: [1],
          changedNoteIds: [1],
          openedNoteIds: [],
          lockedNoteId: 1,
          notesChanged: true
        })
      )
      .mockResolvedValueOnce(
        jsonResponse({
          sessions: [
            {
              id: 'session-1',
              name: 'Weekly update',
              createdAt: 1_700_000_000_000,
              lastActivityAt: 1_700_000_000_000,
              metadata: {
                created: [1],
                updated: [1],
                lockedNoteId: 1
              }
            }
          ]
        })
      );

    vi.stubGlobal('fetch', fetchMock);

    const chat = useChat({
      onNotesChanged: notesChanged
    });

    await chat.loadSessions();
    await chat.loadSession('session-1');

    expect(chat.sessionId.value).toBe('session-1');
    expect(chat.selectedSessionId.value).toBe('session-1');
    expect(chat.isNoteDumpLocked.value).toBe(true);
    expect(chat.messages.value).toHaveLength(2);
    expect(chat.draft.value).toBe('');

    chat.draft.value = 'Refine the sprint plan.';
    await chat.sendMessage();

    expect(fetchMock).toHaveBeenCalledWith('/api/chat/sessions', expect.any(Object));
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/chat/sessions/session-1',
      expect.objectContaining({
        method: 'GET'
      })
    );
    expect(fetchMock).toHaveBeenCalledWith('/api/chat', expect.objectContaining({ method: 'POST' }));

    const postCall = fetchMock.mock.calls.find(
      ([url, init]) => url === '/api/chat' && (init as RequestInit | undefined)?.method === 'POST'
    );
    const requestBody = JSON.parse(postCall?.[1]?.body as string) as {
      sessionId: string;
      messages: Array<{ role: string; content: string; toolCalls: unknown[] }>;
    };

    expect(requestBody.sessionId).toBe('session-1');
    expect(requestBody.messages).toHaveLength(3);
    expect(requestBody.messages[0]).toMatchObject({
      role: 'user',
      content: 'Draft a weekly update.',
      toolCalls: []
    });
    expect(requestBody.messages[1]).toMatchObject({
      role: 'assistant',
      content: 'Here is a draft.',
      toolCalls: [
        {
          id: 'call-1',
          type: 'function',
          name: 'createNote',
          arguments: {
            title: 'Weekly update'
          }
        }
      ]
    });
    expect(requestBody.messages[2]).toMatchObject({
      role: 'user',
      content: 'Refine the sprint plan.',
      toolCalls: []
    });
    expect(chat.messages.value).toHaveLength(4);
    expect(chat.messages.value.at(-1)).toMatchObject({
      role: 'assistant',
      content: 'I refined the sprint plan.',
      toolCalls: [
        {
          id: 'call-2',
          type: 'function',
          name: 'updateNote',
          arguments: {
            id: 1,
            title: 'Sprint plan'
          }
        }
      ]
    });
    expect(chat.sessions.value[0]).toMatchObject({
      metadata: {
        created: [],
        updated: [1],
        lockedNoteId: 1
      }
    });
    expect(chat.isNoteDumpLocked.value).toBe(true);
    expect(notesChanged).toHaveBeenCalledWith([1]);
  });

  it('clears stale lock metadata when the active session is no longer in the session list', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          sessions: [
            {
              id: 'session-1',
              name: 'Weekly update',
              createdAt: 1_700_000_000_000,
              lastActivityAt: 1_700_000_000_000,
              metadata: {
                created: [],
                updated: [],
                lockedNoteId: 1
              }
            }
          ]
        })
      )
      .mockResolvedValueOnce(
        jsonResponse({
          sessions: [
            {
              id: 'session-2',
              name: 'Another session',
              createdAt: 1_700_000_100_000,
              lastActivityAt: 1_700_000_100_000,
              metadata: {
                created: [],
                updated: [],
                lockedNoteId: null
              }
            }
          ]
        })
      );

    vi.stubGlobal('fetch', fetchMock);

    const chat = useChat();
    chat.sessionId.value = 'session-1';

    await chat.loadSessions();

    expect(chat.isNoteDumpLocked.value).toBe(true);

    chat.sessionId.value = 'session-missing';
    await chat.loadSessions();

    expect(chat.isNoteDumpLocked.value).toBe(false);
    expect(chat.activeSessionMetadata.value).toEqual({
      created: [],
      updated: [],
      lockedNoteId: null
    });
  });

  it('clears the lock when a later response does not return a locked note', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          sessions: [
            {
              id: 'session-1',
              name: 'Weekly update',
              createdAt: 1_700_000_000_000,
              lastActivityAt: 1_700_000_000_000,
              metadata: {
                created: [],
                updated: [],
                lockedNoteId: 1
              }
            }
          ]
        })
      )
      .mockResolvedValueOnce(
        jsonResponse({
          assistantMessage: {
            role: 'assistant',
            content: 'I updated the sprint plan.'
          },
          toolCalls: [],
          createdNoteIds: [],
          updatedNoteIds: [1],
          changedNoteIds: [1],
          openedNoteIds: [],
          notesChanged: true
        })
      )
      .mockResolvedValueOnce(
        jsonResponse({
          sessions: [
            {
              id: 'session-1',
              name: 'Weekly update',
              createdAt: 1_700_000_000_000,
              lastActivityAt: 1_700_000_000_000,
              metadata: {
                created: [],
                updated: [1],
                lockedNoteId: null
              }
            }
          ]
        })
      );

    vi.stubGlobal('fetch', fetchMock);

    const chat = useChat();
    chat.sessionId.value = 'session-1';

    await chat.loadSessions();
    expect(chat.isNoteDumpLocked.value).toBe(true);

    chat.draft.value = 'Refine the sprint plan.';
    await chat.sendMessage();

    expect(chat.isNoteDumpLocked.value).toBe(false);
    expect(chat.activeSessionMetadata.value.lockedNoteId).toBe(null);
  });

  it('surfaces opened note ids separately from note changes', async () => {
    const noteOpened = vi.fn();
    const notesChanged = vi.fn();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ sessions: [] }))
      .mockResolvedValueOnce(
        jsonResponse({
          assistantMessage: {
            role: 'assistant',
            content: 'I opened the sprint plan note.'
          },
          toolCalls: [],
          createdNoteIds: [],
          updatedNoteIds: [],
          changedNoteIds: [],
          openedNoteIds: [7],
          notesChanged: false
        })
      )
      .mockResolvedValueOnce(jsonResponse({ sessions: [] }));

    vi.stubGlobal('fetch', fetchMock);

    const chat = useChat({
      onNotesChanged: notesChanged,
      onNoteOpened: noteOpened
    });

    await chat.loadSessions();
    chat.draft.value = 'Open the sprint plan note.';
    await chat.sendMessage();

    expect(noteOpened).toHaveBeenCalledWith([7]);
    expect(notesChanged).not.toHaveBeenCalled();
  });

  it('surfaces note activity once when a response changes and opens notes', async () => {
    const noteActivity = vi.fn();
    const notesChanged = vi.fn();
    const noteOpened = vi.fn();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ sessions: [] }))
      .mockResolvedValueOnce(
        jsonResponse({
          assistantMessage: {
            role: 'assistant',
            content: 'I updated and opened the sprint plan note.'
          },
          toolCalls: [],
          createdNoteIds: [2],
          updatedNoteIds: [2],
          changedNoteIds: [2],
          openedNoteIds: [7],
          notesChanged: true
        })
      )
      .mockResolvedValueOnce(jsonResponse({ sessions: [] }));

    vi.stubGlobal('fetch', fetchMock);

    const chat = useChat({
      onNotesActivity: noteActivity,
      onNotesChanged: notesChanged,
      onNoteOpened: noteOpened
    });

    await chat.loadSessions();
    chat.draft.value = 'Update and open the sprint plan note.';
    await chat.sendMessage();

    expect(noteActivity).toHaveBeenCalledWith({
      createdNoteIds: [2],
      changedNoteIds: [2],
      openedNoteIds: [7]
    });
    expect(notesChanged).not.toHaveBeenCalled();
    expect(noteOpened).not.toHaveBeenCalled();
  });

  it('surfaces created note ids even when the response only creates a note', async () => {
    const noteActivity = vi.fn();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ sessions: [] }))
      .mockResolvedValueOnce(
        jsonResponse({
          assistantMessage: {
            role: 'assistant',
            content: 'I created the weekly update note.'
          },
          toolCalls: [],
          createdNoteIds: [9],
          updatedNoteIds: [9],
          changedNoteIds: [],
          openedNoteIds: [],
          notesChanged: true
        })
      )
      .mockResolvedValueOnce(jsonResponse({ sessions: [] }));

    vi.stubGlobal('fetch', fetchMock);

    const chat = useChat({
      onNotesActivity: noteActivity
    });

    await chat.loadSessions();
    chat.draft.value = 'Create a weekly update note.';
    await chat.sendMessage();

    expect(noteActivity).toHaveBeenCalledWith({
      createdNoteIds: [9],
      changedNoteIds: [],
      openedNoteIds: []
    });
  });

  it('resets the transcript and session id when cleared', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          sessions: []
        })
      )
      .mockResolvedValueOnce(
        jsonResponse({
          assistantMessage: {
            role: 'assistant',
            content: 'Ready for the next prompt.'
          },
          toolCalls: [],
          createdNoteIds: [],
          updatedNoteIds: [],
          changedNoteIds: [],
          openedNoteIds: [],
          notesChanged: false
        })
      )
      .mockResolvedValueOnce(
        jsonResponse({
          sessions: []
        })
      );

    vi.stubGlobal('fetch', fetchMock);

    const chat = useChat();
    const initialSessionId = chat.sessionId.value;

    chat.draft.value = 'Start a session.';
    await chat.loadSessions();
    await chat.sendMessage();
    chat.resetChat();

    expect(chat.sessionId.value).not.toBe(initialSessionId);
    expect(chat.messages.value).toHaveLength(0);
    expect(chat.draft.value).toBe('');
    expect(chat.errorMessage.value).toBe('');
    expect(chat.hasMessages.value).toBe(false);
  });

  it('rolls back the optimistic user turn when the request fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(new Response(null, { status: 500 })));

    const chat = useChat();
    chat.draft.value = 'Hello';
    await chat.sendMessage();

    expect(chat.errorMessage.value).toBe('Request failed with status 500');
    expect(chat.messages.value).toHaveLength(0);
    expect(chat.draft.value).toBe('Hello');
  });

  it('restores the previous session selection if loading a session fails', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          sessions: [
            {
              id: 'session-1',
              name: 'Weekly update',
              createdAt: 1_700_000_000_000,
              lastActivityAt: 1_700_000_000_000,
              metadata: {
                created: [],
                updated: []
              }
            }
          ]
        })
      )
      .mockResolvedValueOnce(new Response(null, { status: 503 }));

    vi.stubGlobal('fetch', fetchMock);

    const chat = useChat();
    await chat.loadSessions();

    chat.sessionId.value = 'session-1';
    chat.selectedSessionId.value = 'session-1';
    chat.messages.value = [
      {
        id: 1,
        role: 'user',
        content: 'Existing message',
        toolCalls: []
      }
    ];

    await chat.loadSession('missing-session');

    expect(chat.sessionId.value).toBe('session-1');
    expect(chat.selectedSessionId.value).toBe('session-1');
    expect(chat.messages.value).toHaveLength(1);
    expect(chat.errorMessage.value).toBe('Request failed with status 503');
  });
});
