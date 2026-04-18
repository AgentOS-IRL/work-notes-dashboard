import { computed, ref } from 'vue';
import type {
  ChatMessage,
  ChatRequest,
  ChatResponse,
  ChatSessionDetailResponse,
  ChatSessionListResponse,
  ChatSessionSummary
} from '~/types/chat';

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {})
    },
    ...init
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(payload?.error ?? `Request failed with status ${response.status}`);
  }

  return response.json() as Promise<T>;
}

function createSessionId() {
  const cryptoObject = globalThis.crypto as { randomUUID?: () => string } | undefined;
  if (cryptoObject?.randomUUID) {
    return cryptoObject.randomUUID();
  }

  return `session-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function formatChatSessionLabel(session: Pick<ChatSessionSummary, 'name' | 'createdAt'>) {
  if (session.name) {
    return session.name;
  }

  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  }).format(new Date(session.createdAt));
}

export function useChat(options: { onNotesChanged?: (changedNoteIds: number[]) => void } = {}) {
  const messages = ref<ChatMessage[]>([]);
  const sessions = ref<ChatSessionSummary[]>([]);
  const draft = ref('');
  const isSending = ref(false);
  const isLoadingSession = ref(false);
  const errorMessage = ref('');
  const sessionId = ref(createSessionId());
  const selectedSessionId = ref('');
  let nextMessageId = 1;

  const hasMessages = computed(() => messages.value.length > 0);
  const sessionOptions = computed(() =>
    sessions.value.map((session) => ({
      ...session,
      label: formatChatSessionLabel(session)
    }))
  );

  function syncSelectedSessionId() {
    if (sessions.value.some((session) => session.id === sessionId.value)) {
      selectedSessionId.value = sessionId.value;
      return;
    }

    if (!sessions.value.some((session) => session.id === selectedSessionId.value)) {
      selectedSessionId.value = '';
    }
  }

  async function loadSessions() {
    const data = await requestJson<ChatSessionListResponse>('/api/chat/sessions', {
      method: 'GET'
    });

    sessions.value = data.sessions;
    syncSelectedSessionId();
  }

  async function refreshSessions() {
    try {
      await loadSessions();
    } catch {
      // Session browsing is best-effort and should not block chat interactions.
    }
  }

  function addSuggestion(text: string) {
    draft.value = text;
  }

  function resetChat() {
    if (isSending.value || isLoadingSession.value) {
      return;
    }

    sessionId.value = createSessionId();
    selectedSessionId.value = '';
    messages.value = [];
    draft.value = '';
    errorMessage.value = '';
    nextMessageId = 1;
  }

  async function loadSession(targetSessionId: string) {
    if (isSending.value || isLoadingSession.value) {
      return;
    }

    const normalizedSessionId = targetSessionId.trim();
    if (!normalizedSessionId) {
      return;
    }

    isLoadingSession.value = true;
    errorMessage.value = '';

    try {
      const response = await requestJson<ChatSessionDetailResponse>(
        `/api/chat/sessions/${encodeURIComponent(normalizedSessionId)}`,
        {
          method: 'GET'
        }
      );

      sessionId.value = response.session.id;
      selectedSessionId.value = response.session.id;
      messages.value = response.messages;
      draft.value = '';
      nextMessageId = response.messages.reduce((maxId, message) => Math.max(maxId, message.id), 0) + 1;
      await refreshSessions();
    } catch (error) {
      errorMessage.value = error instanceof Error ? error.message : 'Failed to load session.';
    } finally {
      isLoadingSession.value = false;
    }
  }

  async function sendMessage() {
    const trimmed = draft.value.trim();
    if (!trimmed || isSending.value || isLoadingSession.value) {
      return;
    }

    const previousMessages = messages.value;
    const userMessage: ChatMessage = {
      id: nextMessageId,
      role: 'user',
      content: trimmed
    };
    nextMessageId += 1;

    const nextMessages = [...messages.value, userMessage];
    messages.value = nextMessages;
    draft.value = '';
    isSending.value = true;
    errorMessage.value = '';

    try {
      const response = await requestJson<ChatResponse>('/api/chat', {
        method: 'POST',
        body: JSON.stringify({
          sessionId: sessionId.value,
          messages: nextMessages
        } satisfies ChatRequest)
      });

      const assistantMessage: ChatMessage = {
        id: nextMessageId,
        role: response.assistantMessage.role,
        content: response.assistantMessage.content
      };
      nextMessageId += 1;

      messages.value = [...nextMessages, assistantMessage];

      if (response.notesChanged) {
        options.onNotesChanged?.(response.changedNoteIds);
      }

      void refreshSessions();
    } catch (error) {
      messages.value = previousMessages;
      draft.value = trimmed;
      nextMessageId -= 1;
      errorMessage.value = error instanceof Error ? error.message : 'Failed to send chat message.';
    } finally {
      isSending.value = false;
    }
  }

  return {
    messages,
    sessions: sessionOptions,
    sessionId,
    selectedSessionId,
    draft,
    isSending,
    isLoadingSession,
    errorMessage,
    hasMessages,
    addSuggestion,
    loadSession,
    loadSessions: refreshSessions,
    sendMessage,
    resetChat
  };
}
