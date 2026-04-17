<script setup lang="ts">
import { computed, nextTick, ref } from 'vue';

type ChatRole = 'assistant' | 'user';

interface ChatMessage {
  id: number;
  role: ChatRole;
  content: string;
}

const seedMessages: ChatMessage[] = [
  {
    id: 1,
    role: 'assistant',
    content: 'Local chat is ready. It is not connected to notes or any backend yet.'
  },
  {
    id: 2,
    role: 'user',
    content: 'I need a concise summary of today’s priorities.'
  },
  {
    id: 3,
    role: 'assistant',
    content: 'Use the notes pane on the right to capture actions, decisions, and follow-ups.'
  }
];

const messages = ref<ChatMessage[]>(seedMessages);
const draft = ref('');
const isSending = ref(false);

const hasConversation = computed(() => messages.value.length > 0);

function addSuggestion(text: string) {
  draft.value = text;
}

async function sendMessage() {
  const trimmed = draft.value.trim();
  if (!trimmed || isSending.value) {
    return;
  }

  isSending.value = true;
  const nextId = messages.value.length + 1;
  messages.value = [
    ...messages.value,
    { id: nextId, role: 'user', content: trimmed },
    {
      id: nextId + 1,
      role: 'assistant',
      content: 'This chat stays local for now. Notes remain isolated in the right pane.'
    }
  ];
  draft.value = '';
  await nextTick();
  isSending.value = false;
}
</script>

<template>
  <section class="chat-panel">
    <header class="panel-header">
      <div>
        <p class="eyebrow">Chat workspace</p>
        <h2>Talk things out locally.</h2>
      </div>
      <span class="status-pill">Local only</span>
    </header>

    <div class="chat-frame">
      <div class="chat-meta">
        <p class="meta-title">Conversation</p>
        <p class="meta-copy">
          A polished shell for chat is here, but it does not call any model or backend yet.
        </p>
      </div>

      <div class="message-stream" aria-live="polite">
        <article
          v-for="message in messages"
          :key="message.id"
          class="message"
          :class="message.role"
        >
          <span class="message-label">{{ message.role === 'assistant' ? 'Assistant' : 'You' }}</span>
          <p>{{ message.content }}</p>
        </article>
      </div>

      <div class="prompt-row">
        <button type="button" class="prompt-chip" @click="addSuggestion('Draft a weekly status update.')">
          Weekly update
        </button>
        <button type="button" class="prompt-chip" @click="addSuggestion('Summarize the next action items.')">
          Action items
        </button>
        <button type="button" class="prompt-chip" @click="addSuggestion('Turn this into a clean meeting note.')">
          Meeting note
        </button>
      </div>

      <form class="composer" @submit.prevent="sendMessage">
        <label class="composer-label" for="chat-draft">
          <span>Composer</span>
          <textarea
            id="chat-draft"
            v-model="draft"
            rows="4"
            placeholder="Write a message. It stays local to this panel."
          />
        </label>

        <div class="composer-actions">
          <p class="composer-hint">
            {{ hasConversation ? 'Conversation state is stored in this component only.' : 'Start a local conversation.' }}
          </p>
          <button class="send-button" type="submit" :disabled="isSending || draft.trim().length === 0">
            Send
          </button>
        </div>
      </form>
    </div>
  </section>
</template>

<style scoped>
.chat-panel {
  display: grid;
  gap: 18px;
  min-height: 100%;
}

.panel-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.eyebrow,
.meta-title {
  margin: 0 0 10px;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  font-size: 0.75rem;
  color: var(--muted-strong);
}

h2 {
  margin: 0;
  font-size: clamp(1.5rem, 2vw, 2rem);
  line-height: 1.05;
}

.status-pill {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  border-radius: 999px;
  padding: 10px 14px;
  background: color-mix(in srgb, var(--surface-strong) 84%, transparent);
  border: 1px solid var(--border);
  color: var(--text-strong);
  font-size: 0.9rem;
}

.chat-frame {
  display: grid;
  gap: 16px;
  padding: 22px;
  border-radius: 28px;
  background: linear-gradient(180deg, color-mix(in srgb, var(--surface-strong) 88%, transparent), var(--surface));
  border: 1px solid var(--border);
  box-shadow: var(--shadow);
  min-height: 0;
}

.chat-meta {
  display: grid;
  gap: 8px;
}

.meta-copy,
.composer-hint {
  margin: 0;
  color: var(--muted);
  line-height: 1.55;
}

.message-stream {
  display: grid;
  gap: 12px;
  max-height: 390px;
  overflow: auto;
  padding-right: 4px;
}

.message {
  display: grid;
  gap: 8px;
  max-width: 88%;
  padding: 14px 16px;
  border-radius: 20px;
  border: 1px solid var(--border);
  box-shadow: 0 12px 30px rgba(15, 23, 42, 0.08);
  animation: float-in 240ms ease;
}

.message.assistant {
  background: color-mix(in srgb, var(--surface) 82%, white);
  justify-self: start;
}

.message.user {
  background: linear-gradient(135deg, var(--accent), var(--accent-strong));
  color: #fff;
  justify-self: end;
  border-color: transparent;
}

.message-label {
  font-size: 0.72rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  opacity: 0.78;
}

.message p {
  margin: 0;
  line-height: 1.6;
}

.prompt-row {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.prompt-chip {
  border: 1px solid var(--border);
  border-radius: 999px;
  background: color-mix(in srgb, var(--surface-strong) 74%, transparent);
  color: var(--text);
  padding: 10px 14px;
  transition:
    transform 160ms ease,
    border-color 160ms ease,
    background-color 160ms ease;
}

.prompt-chip:hover,
.prompt-chip:focus-visible {
  transform: translateY(-1px);
  border-color: color-mix(in srgb, var(--accent) 45%, var(--border));
}

.composer {
  display: grid;
  gap: 14px;
  padding-top: 4px;
}

.composer-label {
  display: grid;
  gap: 8px;
}

.composer-label span {
  color: var(--muted-strong);
  font-size: 0.9rem;
}

textarea {
  width: 100%;
  box-sizing: border-box;
  resize: vertical;
  min-height: 118px;
  padding: 14px 16px;
  border-radius: 18px;
  border: 1px solid var(--border);
  background: color-mix(in srgb, var(--surface-strong) 80%, transparent);
  color: var(--text);
  font: inherit;
  outline: none;
  transition:
    border-color 160ms ease,
    box-shadow 160ms ease,
    transform 160ms ease;
}

textarea:focus-visible {
  border-color: color-mix(in srgb, var(--accent) 60%, var(--border));
  box-shadow: 0 0 0 4px color-mix(in srgb, var(--accent) 18%, transparent);
}

.composer-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
}

.send-button {
  border: 0;
  border-radius: 999px;
  padding: 12px 18px;
  background: linear-gradient(135deg, var(--accent-strong), var(--accent));
  color: white;
  font: inherit;
  cursor: pointer;
  transition:
    transform 160ms ease,
    opacity 160ms ease;
}

.send-button:hover:not(:disabled),
.send-button:focus-visible:not(:disabled) {
  transform: translateY(-1px);
}

.send-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

@keyframes float-in {
  from {
    opacity: 0;
    transform: translateY(8px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@media (max-width: 960px) {
  .panel-header,
  .composer-actions {
    flex-direction: column;
    align-items: stretch;
  }

  .message {
    max-width: 100%;
  }
}
</style>
