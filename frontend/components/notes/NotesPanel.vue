<script setup lang="ts">
import { onMounted, watch } from 'vue';
import { useNotes } from '~/composables/useNotes';

const props = defineProps<{
  refreshKey: number;
}>();

const {
  notes,
  selectedNoteId,
  selectedNote,
  title,
  content,
  loading,
  saving,
  errorMessage,
  statusMessage,
  resetForm,
  selectNote,
  loadNotes,
  saveNote,
  deleteNote
} = useNotes();

onMounted(loadNotes);

watch(
  () => props.refreshKey,
  () => {
    loadNotes({ preserveEditorFields: true });
  }
);
</script>

<template>
  <section class="notes-panel">
    <header class="panel-header">
      <div>
        <p class="eyebrow">Notes workspace</p>
        <h2>Capture the source of truth.</h2>
      </div>
      <button class="new-note-button" type="button" @click="resetForm">New note</button>
    </header>

    <div class="workspace">
      <aside class="note-list-panel">
        <div class="panel-subhead">
          <h3>Saved notes</h3>
          <span>{{ notes.length }}</span>
        </div>

        <p v-if="loading" class="state-text">Loading notes…</p>
        <p v-else-if="notes.length === 0" class="state-text">No notes yet. Create the first one.</p>

        <ul v-else class="note-list">
          <li v-for="note in notes" :key="note.id">
            <button
              class="note-card"
              :class="{ active: note.id === selectedNoteId }"
              type="button"
              @click="selectNote(note)"
            >
              <strong>{{ note.title }}</strong>
              <pre>{{ note.content }}</pre>
            </button>
          </li>
        </ul>
      </aside>

      <section class="editor-panel">
        <div class="panel-subhead">
          <h3>{{ selectedNote ? 'Edit note' : 'Create note' }}</h3>
          <span v-if="selectedNote">#{{ selectedNote.id }}</span>
        </div>

        <p v-if="statusMessage" class="message success">{{ statusMessage }}</p>
        <p v-if="errorMessage" class="message error">{{ errorMessage }}</p>

        <form class="editor" @submit.prevent="saveNote">
          <label>
            <span>Title</span>
            <input v-model="title" type="text" placeholder="Project kickoff" />
          </label>

          <label>
            <span>Content</span>
            <textarea
              v-model="content"
              rows="14"
              placeholder="Capture the note body here. Markdown is stored as plain text."
            />
          </label>

          <div class="actions">
            <button class="primary" type="submit" :disabled="saving">
              {{ selectedNoteId === null ? 'Create note' : 'Save changes' }}
            </button>
            <button class="secondary" type="button" :disabled="saving" @click="resetForm">
              Clear
            </button>
            <button
              v-if="selectedNoteId !== null"
              class="danger"
              type="button"
              :disabled="saving"
              @click="deleteNote(selectedNoteId)"
            >
              Delete
            </button>
          </div>
        </form>
      </section>
    </div>
  </section>
</template>

<style scoped>
.notes-panel {
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
.panel-subhead h3 {
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

.new-note-button,
.primary,
.secondary,
.danger {
  border: 0;
  border-radius: 999px;
  font: inherit;
  cursor: pointer;
  transition:
    transform 160ms ease,
    opacity 160ms ease,
    background-color 160ms ease,
    border-color 160ms ease;
}

.new-note-button {
  padding: 12px 18px;
  background: linear-gradient(135deg, var(--accent-strong), var(--accent));
  color: white;
  box-shadow: 0 18px 30px rgba(37, 73, 204, 0.22);
}

.workspace {
  display: grid;
  grid-template-columns: 320px minmax(0, 1fr);
  gap: 18px;
  min-height: 0;
}

.note-list-panel,
.editor-panel {
  display: grid;
  gap: 16px;
  padding: 20px;
  border-radius: 28px;
  background: linear-gradient(180deg, color-mix(in srgb, var(--surface-strong) 90%, transparent), var(--surface));
  border: 1px solid var(--border);
  box-shadow: var(--shadow);
  min-height: 0;
}

.panel-subhead {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.panel-subhead span {
  color: var(--muted);
  font-size: 0.92rem;
}

.state-text {
  margin: 0;
  color: var(--muted);
  line-height: 1.6;
}

.note-list {
  list-style: none;
  display: grid;
  gap: 12px;
  padding: 0;
  margin: 0;
  overflow: auto;
}

.note-card {
  width: 100%;
  display: grid;
  gap: 8px;
  padding: 16px;
  border: 1px solid var(--border);
  border-radius: 18px;
  background: color-mix(in srgb, var(--surface-strong) 78%, transparent);
  color: var(--text);
  text-align: left;
}

.note-card:hover,
.note-card:focus-visible,
.note-card.active {
  transform: translateY(-1px);
  border-color: color-mix(in srgb, var(--accent) 42%, var(--border));
  box-shadow: 0 14px 30px rgba(15, 23, 42, 0.12);
}

.note-card strong {
  font-size: 1rem;
}

.note-card pre {
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
  color: var(--muted);
  font-family: inherit;
  font-size: 0.92rem;
  line-height: 1.5;
}

.editor {
  display: grid;
  gap: 16px;
}

label {
  display: grid;
  gap: 8px;
}

label span {
  font-size: 0.9rem;
  color: var(--muted-strong);
}

input,
textarea {
  width: 100%;
  box-sizing: border-box;
  border: 1px solid var(--border);
  border-radius: 18px;
  background: color-mix(in srgb, var(--surface-strong) 78%, transparent);
  color: var(--text);
  padding: 14px 16px;
  font: inherit;
  outline: none;
  transition:
    border-color 160ms ease,
    box-shadow 160ms ease;
}

textarea {
  resize: vertical;
  min-height: 290px;
}

input:focus-visible,
textarea:focus-visible {
  border-color: color-mix(in srgb, var(--accent) 58%, var(--border));
  box-shadow: 0 0 0 4px color-mix(in srgb, var(--accent) 18%, transparent);
}

.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.primary,
.secondary,
.danger {
  padding: 12px 18px;
}

.primary {
  background: linear-gradient(135deg, var(--accent-strong), var(--accent));
  color: white;
}

.secondary {
  background: color-mix(in srgb, var(--surface-strong) 84%, transparent);
  color: var(--text);
}

.danger {
  background: color-mix(in srgb, var(--danger) 14%, transparent);
  color: var(--danger);
}

.primary:hover:not(:disabled),
.secondary:hover:not(:disabled),
.danger:hover:not(:disabled),
.new-note-button:hover {
  transform: translateY(-1px);
}

.primary:disabled,
.secondary:disabled,
.danger:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

.message {
  margin: 0;
  padding: 12px 14px;
  border-radius: 14px;
}

.message.success {
  background: color-mix(in srgb, var(--success) 14%, transparent);
  color: var(--success);
}

.message.error {
  background: color-mix(in srgb, var(--danger) 14%, transparent);
  color: var(--danger);
}

@media (max-width: 1100px) {
  .workspace {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 960px) {
  .panel-header {
    flex-direction: column;
    align-items: stretch;
  }
}
</style>
