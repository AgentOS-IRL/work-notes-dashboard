<script setup lang="ts">
import { computed } from 'vue';
import { useChat } from '~/composables/useChat';

const props = withDefaults(
  defineProps<{
    compact?: boolean;
  }>(),
  {
    compact: false
  }
);

const emit = defineEmits<{
  (event: 'notes-changed', changedNoteIds: number[]): void;
}>();

const {
  messages,
  draft,
  isSending,
  errorMessage,
  hasMessages,
  addSuggestion,
  sendMessage
} = useChat({
  onNotesChanged(changedNoteIds) {
    emit('notes-changed', changedNoteIds);
  }
});

const statusLabel = computed(() => (props.compact ? 'Collapsed' : 'Connected'));
</script>

<template>
  <section class="chat-panel" :class="{ compact }">
    <header class="panel-header">
      <div>
        <p class="eyebrow">Chat workspace</p>
        <h2>
          {{ compact ? 'Chat collapsed for browsing.' : 'Talk things out with the notes model.' }}
        </h2>
      </div>
      <span class="status-pill">{{ statusLabel }}</span>
    </header>

    <div class="chat-frame">
      <div class="chat-meta">
        <p class="meta-title">Conversation</p>
        <p class="meta-copy">
          Messages go to the backend, which can inspect notes and update them with LangChain tool
          calls.
        </p>
      </div>

      <p v-if="errorMessage" class="message error-banner">{{ errorMessage }}</p>

      <div class="message-stream" :class="{ compact }" aria-live="polite">
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

      <div v-if="!compact" class="prompt-row">
        <button
          type="button"
          class="prompt-chip"
          @click="addSuggestion('Draft a weekly status update.')"
        >
          Weekly update
        </button>
        <button
          type="button"
          class="prompt-chip"
          @click="addSuggestion('Summarize the next action items.')"
        >
          Action items
        </button>
        <button
          type="button"
          class="prompt-chip"
          @click="addSuggestion('Turn this into a clean meeting note.')"
        >
          Meeting note
        </button>
      </div>

      <form v-if="!compact" class="composer" @submit.prevent="sendMessage">
        <label class="composer-label" for="chat-draft">
          <span>Composer</span>
          <textarea
            id="chat-draft"
            v-model="draft"
            rows="4"
            placeholder="Ask the assistant to improve or capture notes."
          />
        </label>

        <div class="composer-actions">
          <p class="composer-hint">
            {{
              isSending
                ? 'Sending message to the LLM...'
                : hasMessages
                  ? 'Conversation history is maintained locally and sent with each turn.'
                  : 'Start a conversation.'
            }}
          </p>
          <button class="send-button" type="submit" :disabled="isSending || draft.trim().length === 0">
            {{ isSending ? 'Sending...' : 'Send' }}
          </button>
        </div>
      </form>

      <p v-else class="collapsed-copy">
        Chat input is hidden while the note tree is open. The message history remains visible.
      </p>
    </div>
  </section>
</template>

<style scoped>
.chat-panel {
  display: grid;
  gap: 14px;
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
  font-size: 0.72rem;
  color: var(--muted-strong);
}

h2 {
  margin: 0;
  max-width: 22ch;
  font-size: clamp(1.2rem, 1.6vw, 1.7rem);
  line-height: 1.15;
  letter-spacing: -0.04em;
}

.status-pill {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  border-radius: 999px;
  padding: 9px 14px;
  background: color-mix(in srgb, var(--panel-muted) 92%, transparent);
  border: 1px solid var(--border);
  color: var(--text-strong);
  font-size: 0.9rem;
}

.chat-frame {
  display: grid;
  gap: 14px;
  padding: 20px;
  border-radius: 24px;
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--panel-elevated) 95%, transparent), var(--surface)),
    var(--surface);
  border: 1px solid var(--border);
  box-shadow: var(--shadow);
  min-height: 0;
}

.chat-meta {
  display: grid;
  gap: 8px;
}

.meta-copy,
.composer-hint,
.collapsed-copy {
  margin: 0;
  color: var(--muted);
  line-height: 1.55;
}

.message-stream {
  display: grid;
  gap: 12px;
  max-height: 440px;
  overflow: auto;
  padding-right: 4px;
}

.message-stream.compact {
  max-height: 220px;
}

.message {
  display: grid;
  gap: 8px;
  max-width: 88%;
  padding: 12px 14px;
  border-radius: 16px;
  border: 1px solid var(--border);
  box-shadow: 0 12px 28px rgba(8, 12, 20, 0.28);
  animation: float-in 240ms ease;
}

.message.assistant {
  background: color-mix(in srgb, var(--surface) 76%, var(--panel-muted));
  justify-self: start;
}

.message.user {
  background: linear-gradient(135deg, var(--accent), var(--accent-strong));
  color: #fff;
  justify-self: end;
  border-color: transparent;
}

.error-banner {
  max-width: 100%;
  margin: 0;
  background: color-mix(in srgb, #dc2626 10%, var(--surface));
  border-color: color-mix(in srgb, #dc2626 30%, var(--border));
  color: #fca5a5;
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
  background: color-mix(in srgb, var(--panel-muted) 82%, transparent);
  color: var(--text);
  padding: 10px 14px;
  font-size: 0.92rem;
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
  min-height: 112px;
  padding: 14px 16px;
  border-radius: 16px;
  border: 1px solid var(--border);
  background: color-mix(in srgb, var(--panel-muted) 86%, transparent);
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

.chat-panel.compact .chat-frame {
  padding: 16px;
}
</style>
