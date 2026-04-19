<script setup lang="ts">
import { onMounted } from 'vue';
import ToolCallList from '~/components/chat/ToolCallList.vue';
import { useChat } from '~/composables/useChat';
import type { ChatNotesActivity } from '~/types/chat';

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
  (event: 'note-opened', openedNoteIds: number[]): void;
  (event: 'notes-activity', activity: ChatNotesActivity): void;
}>();

const {
  messages,
  sessions,
  sessionId,
  selectedSessionId,
  draft,
  isSending,
  isLoadingSession,
  errorMessage,
  hasMessages,
  isNoteDumpLocked,
  loadSession,
  loadSessions,
  sendMessage,
  resetChat
} = useChat({
  onNotesActivity(activity) {
    emit('notes-activity', activity);
  }
});

function submitChatMessage() {
  void sendMessage({
    noteDumpLocked: isNoteDumpLocked.value
  });
}

function handleComposerKeydown(event: KeyboardEvent) {
  if (event.key !== 'Enter' || event.shiftKey || event.isComposing) {
    return;
  }

  event.preventDefault();
  submitChatMessage();
}

function handleSessionChange() {
  if (!selectedSessionId.value) {
    return;
  }

  void loadSession(selectedSessionId.value);
}

onMounted(() => {
  void loadSessions();
});
</script>

<template>
  <section class="chat-panel" :class="{ compact: props.compact }" :data-session-id="sessionId">
    <header class="panel-header">
      <div class="header-title">
        <span class="window-controls" aria-hidden="true">
          <span class="window-dot dot-red" />
          <span class="window-dot dot-yellow" />
          <span class="window-dot dot-green" />
        </span>
        <div class="header-copy">
          <p class="eyebrow">terminal chat</p>
          <h2>Chat log</h2>
        </div>
      </div>

      <div class="header-status" aria-label="Chat status">
        <span class="status-token">~/notes</span>
        <span class="status-pill">{{ hasMessages ? 'session active' : 'ready' }}</span>
        <button
          type="button"
          class="note-dump-indicator"
          :class="{ active: isNoteDumpLocked }"
          :aria-pressed="isNoteDumpLocked"
          :aria-label="isNoteDumpLocked ? 'Note dump mode on' : 'Note dump mode off'"
          aria-live="polite"
        >
          {{ isNoteDumpLocked ? 'note dump mode on' : 'note dump mode off' }}
        </button>
        <label class="session-picker">
          <span class="picker-label">Load session</span>
          <select
            v-model="selectedSessionId"
            :disabled="isSending || isLoadingSession || sessions.length === 0"
            @change="handleSessionChange"
          >
            <option value="">Select a session</option>
            <option v-for="session in sessions" :key="session.id" :value="session.id">
              {{ session.label }}
            </option>
          </select>
        </label>
        <button
          type="button"
          class="clear-button"
          :disabled="isSending || isLoadingSession"
          @click="resetChat"
        >
          Clear
        </button>
      </div>
    </header>

    <div class="chat-frame">
      <p v-if="errorMessage" class="terminal-alert">{{ errorMessage }}</p>

      <div class="message-stream" aria-live="polite">
        <p v-if="!hasMessages" class="empty-state">No log entries yet. Run a prompt below.</p>

        <article
          v-for="message in messages"
          :key="message.id"
          class="message"
          :class="message.role"
        >
          <div class="message-meta">
            <span class="message-prefix">{{ message.role === 'user' ? '$' : '>' }}</span>
            <span class="message-role">{{ message.role }}</span>
          </div>
          <p>{{ message.content }}</p>
          <ToolCallList
            v-if="message.role === 'assistant' && Array.isArray(message.toolCalls) && message.toolCalls.length > 0"
            :tool-calls="message.toolCalls"
          />
        </article>
      </div>

      <form v-if="!compact" class="composer" @submit.prevent="submitChatMessage">
        <label class="composer-label" for="chat-draft">
          <span class="composer-hint">prompt</span>
          <div class="composer-input">
            <span class="prompt-symbol" aria-hidden="true">$</span>
            <textarea
              id="chat-draft"
              v-model="draft"
              rows="4"
              placeholder="Ask the notes agent..."
              @keydown="handleComposerKeydown"
            />
          </div>
        </label>

        <div class="composer-actions">
          <p class="composer-hint">Enter to send, Shift+Enter for a new line.</p>
          <button class="send-button" type="submit" :disabled="isSending || draft.trim().length === 0">
            Run
          </button>
        </div>
      </form>

      <p v-else class="collapsed-copy">Chat collapsed for browsing.</p>
    </div>
  </section>
</template>

<style scoped>
.chat-panel {
  display: grid;
  gap: 12px;
  align-content: start;
  min-height: 100%;
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 0 2px;
}

.header-title {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}

.window-controls {
  display: inline-flex;
  gap: 6px;
  flex: none;
}

.window-dot {
  width: 10px;
  height: 10px;
  border-radius: 999px;
  background: var(--muted);
  opacity: 0.9;
}

.dot-red {
  background: #fb7185;
}

.dot-yellow {
  background: #facc15;
}

.dot-green {
  background: #34d399;
}

.header-copy {
  display: grid;
  gap: 4px;
}

.eyebrow {
  margin: 0;
  color: var(--muted-strong);
  font: 600 0.72rem/1 var(--mono-font);
  letter-spacing: 0.2em;
  text-transform: uppercase;
}

h2 {
  margin: 0;
  font-size: clamp(1.15rem, 1.4vw, 1.5rem);
  line-height: 1.1;
  letter-spacing: -0.04em;
}

.header-status {
  display: inline-flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  margin-left: auto;
}

.session-picker {
  display: inline-grid;
  gap: 4px;
}

.picker-label {
  color: var(--muted-strong);
  font: 600 0.64rem/1 var(--mono-font);
  letter-spacing: 0.16em;
  text-transform: uppercase;
}

.session-picker select {
  min-width: 220px;
  min-height: 30px;
  padding: 0 10px;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: color-mix(in srgb, var(--panel-muted) 88%, transparent);
  color: var(--text-strong);
  font: 600 0.75rem/1 var(--mono-font);
}

.status-token,
.status-pill,
.message-role,
.composer-hint,
.collapsed-copy,
.empty-state {
  font-family: var(--mono-font);
}

.status-token,
.status-pill {
  display: inline-flex;
  align-items: center;
  min-height: 30px;
  padding: 0 10px;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: color-mix(in srgb, var(--panel-muted) 88%, transparent);
  color: var(--text-strong);
  font-size: 0.75rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.status-token {
  color: var(--accent);
}

.note-dump-indicator {
  display: inline-flex;
  align-items: center;
  min-height: 30px;
  padding: 0 12px;
  border: 1px solid color-mix(in srgb, var(--accent) 38%, var(--border));
  border-radius: 999px;
  background: color-mix(in srgb, var(--panel-muted) 88%, transparent);
  color: var(--text-strong);
  font: 600 0.75rem/1 var(--mono-font);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  cursor: default;
  transition:
    border-color 160ms ease,
    background-color 160ms ease,
    color 160ms ease;
}

.note-dump-indicator.active {
  border-color: color-mix(in srgb, var(--accent) 68%, var(--border));
  background: linear-gradient(135deg, color-mix(in srgb, var(--accent-strong) 84%, #000), var(--accent));
  color: white;
}

.note-dump-indicator:focus-visible {
  outline: 2px solid color-mix(in srgb, var(--accent) 62%, white);
  outline-offset: 2px;
}

.clear-button {
  display: inline-flex;
  align-items: center;
  min-height: 30px;
  padding: 0 12px;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: color-mix(in srgb, var(--panel-muted) 88%, transparent);
  color: var(--text-strong);
  font: 600 0.75rem/1 var(--mono-font);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  cursor: pointer;
  transition:
    transform 160ms ease,
    opacity 160ms ease;
}

.clear-button:hover:not(:disabled),
.clear-button:focus-visible:not(:disabled) {
  transform: translateY(-1px);
}

.clear-button:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.chat-frame {
  display: grid;
  gap: 14px;
  align-content: start;
  padding: 18px;
  border-radius: 18px;
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--panel-elevated) 88%, transparent), var(--surface)),
    var(--surface);
  border: 1px solid var(--border);
  box-shadow: var(--shadow);
  min-height: 0;
}

.terminal-alert {
  margin: 0;
  padding: 12px 14px;
  border-left: 3px solid color-mix(in srgb, #ef4444 70%, var(--border));
  border-radius: 12px;
  background: color-mix(in srgb, #ef4444 12%, var(--panel-muted));
  color: #fecaca;
  font-family: var(--mono-font);
  line-height: 1.55;
}

.message-stream {
  display: grid;
  gap: 12px;
  max-height: 440px;
  overflow: auto;
  padding-right: 4px;
}

.empty-state {
  margin: 0;
  color: var(--muted-strong);
  font-size: 0.88rem;
  line-height: 1.6;
}

.message {
  display: grid;
  gap: 8px;
  max-width: 100%;
  padding: 12px 14px;
  border-radius: 14px;
  border: 1px solid var(--border);
  background: color-mix(in srgb, var(--panel-muted) 72%, transparent);
  animation: float-in 240ms ease;
}

.message-meta {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  color: var(--muted-strong);
  font-family: var(--mono-font);
  font-size: 0.72rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.message-prefix {
  color: var(--accent);
}

.message.user {
  justify-self: end;
  border-color: color-mix(in srgb, var(--accent) 30%, var(--border));
  background: color-mix(in srgb, var(--accent) 10%, var(--panel-muted));
}

.message.user .message-meta {
  justify-content: flex-end;
}

.message.user .message-prefix {
  color: var(--success);
}

.message p {
  margin: 0;
  line-height: 1.65;
  white-space: pre-wrap;
}

.composer {
  display: grid;
  gap: 12px;
  padding-top: 2px;
}

.composer-label {
  display: grid;
  gap: 8px;
}

.composer-hint {
  margin: 0;
  color: var(--muted-strong);
  font-size: 0.72rem;
  letter-spacing: 0.16em;
  text-transform: uppercase;
}

.composer-input {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 10px;
  align-items: start;
  padding: 12px 14px;
  border-radius: 14px;
  border: 1px solid var(--border);
  background: color-mix(in srgb, var(--panel-muted) 88%, transparent);
  transition:
    border-color 160ms ease,
    box-shadow 160ms ease,
    background-color 160ms ease;
}

.composer-input:focus-within {
  border-color: color-mix(in srgb, var(--accent) 62%, var(--border));
  box-shadow: 0 0 0 4px color-mix(in srgb, var(--accent) 16%, transparent);
}

.prompt-symbol {
  color: var(--accent);
  font: 600 0.95rem/1 var(--mono-font);
  padding-top: 4px;
}

textarea {
  width: 100%;
  box-sizing: border-box;
  resize: vertical;
  min-height: 112px;
  border: 0;
  padding: 0;
  background: transparent;
  color: var(--text);
  font: inherit;
  outline: none;
  line-height: 1.65;
}

.composer-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
}

.send-button {
  border: 1px solid color-mix(in srgb, var(--accent) 38%, var(--border));
  border-radius: 999px;
  padding: 10px 16px;
  background: color-mix(in srgb, var(--panel-elevated) 72%, transparent);
  color: var(--text-strong);
  font: 600 0.88rem/1 var(--mono-font);
  cursor: pointer;
  transition:
    transform 160ms ease,
    border-color 160ms ease,
    opacity 160ms ease,
    background-color 160ms ease;
}

.send-button:hover:not(:disabled),
.send-button:focus-visible:not(:disabled) {
  transform: translateY(-1px);
  border-color: color-mix(in srgb, var(--accent) 62%, var(--border));
  background: color-mix(in srgb, var(--panel-elevated) 88%, transparent);
}

.send-button:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.collapsed-copy {
  margin: 0;
  color: var(--muted);
  font-size: 0.86rem;
  line-height: 1.55;
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

  .header-status {
    justify-content: flex-start;
    margin-left: 0;
  }

  .message.user {
    justify-self: stretch;
  }
}

.chat-panel.compact .chat-frame {
  padding: 14px;
}

.chat-panel.compact .message-stream {
  max-height: 260px;
}

.chat-panel.compact .panel-header {
  gap: 10px;
}
</style>
