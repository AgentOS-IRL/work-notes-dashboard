import { computed, ref } from 'vue';
import type {
  ChatMessage,
  ChatRequest,
  ChatNotesActivity,
  ChatSessionMetadata,
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

function createEmptySessionMetadata(): ChatSessionMetadata {
  return {
    created: [],
    updated: [],
    lockedNoteId: null
  };
}

function normalizeSessionMetadata(metadata?: Partial<ChatSessionMetadata> | null): ChatSessionMetadata {
  return {
    created: [...(metadata?.created ?? [])],
    updated: [...(metadata?.updated ?? [])],
    lockedNoteId: metadata?.lockedNoteId ?? null
  };
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

export function useChat(options: {
  onNotesChanged?: (changedNoteIds: number[]) => void;
  onNoteOpened?: (openedNoteIds: number[]) => void;
  onNotesActivity?: (activity: ChatNotesActivity) => void;
} = {}) {
  const messages = ref<ChatMessage[]>([]);
  const sessions = ref<ChatSessionSummary[]>([]);
  const draft = ref('');
  const isSending = ref(false);
  const isLoadingSession = ref(false);
  const errorMessage = ref('');
  const sessionId = ref(createSessionId());
  const selectedSessionId = ref('');
  const activeSessionMetadata = ref<ChatSessionMetadata>(createEmptySessionMetadata());
  const activeSessionSource = ref<'local' | 'loaded'>('local');
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

  function updateActiveSessionMetadata(metadata?: Partial<ChatSessionMetadata> | null) {
    activeSessionMetadata.value = normalizeSessionMetadata(metadata);
  }

  async function loadSessions() {
    const data = await requestJson<ChatSessionListResponse>('/api/chat/sessions', {
      method: 'GET'
    });

    sessions.value = data.sessions;
    const currentSession = data.sessions.find((session) => session.id === sessionId.value);
    if (currentSession) {
      activeSessionSource.value = 'loaded';
      updateActiveSessionMetadata(currentSession.metadata);
    } else if (activeSessionSource.value === 'loaded') {
      updateActiveSessionMetadata(null);
    }
    syncSelectedSessionId();
  }

  async function refreshSessions() {
    try {
      await loadSessions();
    } catch {
      // Session browsing is best-effort and should not block chat interactions.
    }
  }

  function resetChat() {
    if (isSending.value || isLoadingSession.value) {
      return;
    }

    sessionId.value = createSessionId();
    selectedSessionId.value = '';
    activeSessionSource.value = 'local';
    messages.value = [];
    draft.value = '';
    errorMessage.value = '';
    updateActiveSessionMetadata(null);
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

    const previousSessionId = sessionId.value;
    const previousSelectedSessionId = selectedSessionId.value;
    const previousSessionSource = activeSessionSource.value;
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
      activeSessionSource.value = 'loaded';
      updateActiveSessionMetadata(response.session.metadata);
      messages.value = response.messages;
      draft.value = '';
      nextMessageId = response.messages.reduce((maxId, message) => Math.max(maxId, message.id), 0) + 1;
      await refreshSessions();
    } catch (error) {
      sessionId.value = previousSessionId;
      selectedSessionId.value = previousSelectedSessionId;
      activeSessionSource.value = previousSessionSource;
      syncSelectedSessionId();
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
      content: trimmed,
      toolCalls: []
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
        content: response.assistantMessage.content,
        toolCalls: response.toolCalls
      };
      nextMessageId += 1;

      messages.value = [...nextMessages, assistantMessage];
      updateActiveSessionMetadata({
        ...activeSessionMetadata.value,
        lockedNoteId: response.lockedNoteId ?? (response.createdNoteIds.length > 0 ? response.createdNoteIds[0] : null)
      });

      if (
        response.createdNoteIds.length > 0 ||
        response.changedNoteIds.length > 0 ||
        response.openedNoteIds.length > 0
      ) {
        if (options.onNotesActivity) {
          options.onNotesActivity({
            createdNoteIds: response.createdNoteIds,
            changedNoteIds: response.changedNoteIds,
            openedNoteIds: response.openedNoteIds
          });
        } else {
          if (response.notesChanged || response.createdNoteIds.length > 0) {
            options.onNotesChanged?.(
              response.changedNoteIds.length > 0 ? response.changedNoteIds : response.createdNoteIds
            );
          }

          if (response.openedNoteIds.length > 0) {
            options.onNoteOpened?.(response.openedNoteIds);
          }
        }
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
    activeSessionMetadata,
    isNoteDumpLocked: computed(() => activeSessionMetadata.value.lockedNoteId !== null),
    loadSession,
    loadSessions: refreshSessions,
    sendMessage,
    resetChat
  };
}
