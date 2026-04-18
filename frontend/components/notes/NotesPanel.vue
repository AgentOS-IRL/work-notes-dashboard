<script setup lang="ts">
import type { Note } from '~/types/note';
import MarkdownRenderer from '~/components/notes/MarkdownRenderer.vue';

const props = withDefaults(
  defineProps<{
    note: Note | null;
    loading: boolean;
    errorMessage: string;
    mutating?: boolean;
    canDelete?: boolean;
  }>(),
  {
    mutating: false,
    canDelete: false
  }
);

const emit = defineEmits<{
  (event: 'delete'): void;
}>();
</script>

<template>
  <section class="notes-panel">
    <header class="panel-header">
      <h2>Note</h2>
    </header>

    <div class="viewer-frame">
      <p v-if="props.loading" class="state-text">Loading...</p>
      <p v-else-if="props.errorMessage" class="state-text error">{{ props.errorMessage }}</p>
      <div v-else-if="props.note" class="note-view">
        <div class="note-meta">
          <div class="note-meta-row">
            <h3>{{ props.note.title }}</h3>

            <button
              v-if="props.canDelete"
              type="button"
              class="delete-button"
              :disabled="props.mutating"
              aria-label="Delete note"
              @click="emit('delete')"
            >
              {{ props.mutating ? 'Deleting...' : 'Delete note' }}
            </button>
          </div>
        </div>

        <MarkdownRenderer :content="props.note.content" />
      </div>
      <div v-else class="empty-state">
        <p>No note</p>
      </div>
    </div>
  </section>
</template>

<style scoped>
.notes-panel {
  display: grid;
  align-content: start;
  gap: 14px;
  min-height: 100%;
}

.panel-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.eyebrow {
  margin: 0 0 10px;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  font-size: 0.72rem;
  color: var(--muted-strong);
}

h2 {
  margin: 0;
  font-size: clamp(1.25rem, 1.8vw, 1.8rem);
  line-height: 1.1;
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

.viewer-frame {
  display: grid;
  gap: 16px;
  min-height: 0;
  padding: 22px;
  border-radius: 24px;
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--panel-elevated) 96%, transparent), var(--surface)),
    var(--surface);
  border: 1px solid var(--border);
  box-shadow: var(--shadow);
}

.state-text {
  margin: 0;
  color: var(--muted);
  line-height: 1.6;
}

.state-text.error {
  color: #fca5a5;
}

.note-view {
  display: grid;
  gap: 18px;
  min-height: 0;
}

.note-meta {
  display: grid;
  gap: 8px;
}

.note-meta-row {
  display: flex;
  align-items: start;
  justify-content: space-between;
  gap: 16px;
}

.note-kicker {
  margin: 0;
  color: var(--muted-strong);
  text-transform: uppercase;
  letter-spacing: 0.18em;
  font-size: 0.72rem;
}

.note-meta h3 {
  margin: 0;
  font-size: clamp(1.4rem, 2vw, 2rem);
  line-height: 1.1;
  letter-spacing: -0.05em;
  color: var(--text-strong);
}

.delete-button {
  flex: none;
  border: 1px solid color-mix(in srgb, #ef4444 48%, var(--border));
  border-radius: 999px;
  padding: 9px 14px;
  background: color-mix(in srgb, #ef4444 14%, var(--panel-muted));
  color: #fecaca;
  cursor: pointer;
  transition:
    transform 160ms ease,
    opacity 160ms ease,
    border-color 160ms ease;
}

.delete-button:hover:not(:disabled),
.delete-button:focus-visible:not(:disabled) {
  transform: translateY(-1px);
  border-color: color-mix(in srgb, #ef4444 70%, var(--border));
}

.delete-button:disabled {
  cursor: not-allowed;
  opacity: 0.65;
  transform: none;
}

.note-summary {
  margin: 0;
  color: var(--muted);
  font-size: 0.92rem;
}

.empty-state {
  display: grid;
  place-items: center;
  min-height: 320px;
  border: 1px dashed var(--border);
  border-radius: 18px;
  color: var(--muted);
  background: color-mix(in srgb, var(--panel-muted) 68%, transparent);
}

.empty-state p {
  margin: 0;
}

@media (max-width: 960px) {
  .panel-header {
    flex-direction: column;
    align-items: stretch;
  }

  .note-meta-row {
    flex-direction: column;
    align-items: stretch;
  }

  .viewer-frame {
    padding: 18px;
  }
}
</style>
