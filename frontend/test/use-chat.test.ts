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
            lastActivityAt: 1_700_000_000_000
          },
          {
            id: 'session-2',
            name: null,
            createdAt: 1_700_000_100_000,
            lastActivityAt: 1_700_000_100_000
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
              lastActivityAt: 1_700_000_000_000
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
            lastActivityAt: 1_700_000_000_000
          },
          messages: [
            {
              id: 1,
              role: 'user',
              content: 'Draft a weekly update.'
            },
            {
              id: 2,
              role: 'assistant',
              content: 'Here is a draft.'
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
              lastActivityAt: 1_700_000_000_000
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
          changedNoteIds: [1],
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
              lastActivityAt: 1_700_000_000_000
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
      messages: Array<{ role: string; content: string }>;
    };

    expect(requestBody.sessionId).toBe('session-1');
    expect(requestBody.messages).toHaveLength(3);
    expect(requestBody.messages[0]).toMatchObject({
      role: 'user',
      content: 'Draft a weekly update.'
    });
    expect(requestBody.messages[2]).toMatchObject({
      role: 'user',
      content: 'Refine the sprint plan.'
    });
    expect(chat.messages.value).toHaveLength(4);
    expect(chat.messages.value.at(-1)).toMatchObject({
      role: 'assistant',
      content: 'I refined the sprint plan.'
    });
    expect(notesChanged).toHaveBeenCalledWith([1]);
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
          changedNoteIds: [],
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
              lastActivityAt: 1_700_000_000_000
            },
            {
              id: 'session-2',
              name: 'Sprint notes',
              createdAt: 1_700_000_100_000,
              lastActivityAt: 1_700_000_100_000
            }
          ]
        })
      )
      .mockResolvedValueOnce(new Response(null, { status: 503 }));

    vi.stubGlobal('fetch', fetchMock);

    const chat = useChat();
    await chat.loadSessions();

    chat.sessionId.value = 'session-1';
    chat.selectedSessionId.value = 'session-2';
    chat.messages.value = [
      {
        id: 1,
        role: 'user',
        content: 'Existing message'
      }
    ];

    await chat.loadSession('session-2');

    expect(chat.sessionId.value).toBe('session-1');
    expect(chat.selectedSessionId.value).toBe('session-1');
    expect(chat.messages.value).toHaveLength(1);
    expect(chat.errorMessage.value).toBe('Request failed with status 503');
  });
});
