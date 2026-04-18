import { computed, ref } from 'vue';
import type { ChatMessage, ChatRequest, ChatResponse } from '~/types/chat';

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

export function useChat(options: { onNotesChanged?: (changedNoteIds: number[]) => void } = {}) {
  const messages = ref<ChatMessage[]>([]);
  const draft = ref('');
  const isSending = ref(false);
  const errorMessage = ref('');
  let nextMessageId = 2;

  const hasMessages = computed(() => messages.value.length > 0);

  function addSuggestion(text: string) {
    draft.value = text;
  }

  async function sendMessage() {
    const trimmed = draft.value.trim();
    if (!trimmed || isSending.value) {
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
    draft,
    isSending,
    errorMessage,
    hasMessages,
    addSuggestion,
    sendMessage
  };
}
