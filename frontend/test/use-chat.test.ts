import { describe, expect, it, vi } from 'vitest';
import { useChat } from '~/composables/useChat';

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
  it('submits chat turns and appends the assistant reply', async () => {
    const notesChanged = vi.fn();
    const fetchMock = vi.fn().mockResolvedValueOnce(
      jsonResponse({
        assistantMessage: {
          role: 'assistant',
          content: 'I refined the sprint plan.'
        },
        changedNoteIds: [1],
        notesChanged: true
      })
    );

    vi.stubGlobal('fetch', fetchMock);

    const chat = useChat({
      onNotesChanged: notesChanged
    });

    expect(chat.sessionId.value).toBeTruthy();

    chat.draft.value = 'Refine the sprint plan.';
    await chat.sendMessage();

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/chat',
      expect.objectContaining({
        method: 'POST'
      })
    );

    const requestBody = JSON.parse(fetchMock.mock.calls[0][1]?.body as string) as {
      sessionId: string;
      messages: Array<{ role: string; content: string }>;
    };

    expect(requestBody.sessionId).toBe(chat.sessionId.value);
    expect(requestBody.messages).toHaveLength(1);
    expect(requestBody.messages[0]).toMatchObject({
      role: 'user',
      content: 'Refine the sprint plan.'
    });
    expect(chat.messages.value).toHaveLength(2);
    expect(chat.messages.value.at(-1)).toMatchObject({
      role: 'assistant',
      content: 'I refined the sprint plan.'
    });
    expect(notesChanged).toHaveBeenCalledWith([1]);
  });

  it('resets the transcript and session id when cleared', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      jsonResponse({
        assistantMessage: {
          role: 'assistant',
          content: 'Ready for the next prompt.'
        },
        changedNoteIds: [],
        notesChanged: false
      })
    );

    vi.stubGlobal('fetch', fetchMock);

    const chat = useChat();
    const initialSessionId = chat.sessionId.value;

    chat.draft.value = 'Start a session.';
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
});
