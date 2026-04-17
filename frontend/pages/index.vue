<script setup lang="ts">
type Note = {
  id: number;
  title: string;
  content: string;
};

type NotesResponse = {
  notes: Note[];
};

type NoteResponse = {
  note: Note;
};

const notes = ref<Note[]>([]);
const selectedNoteId = ref<number | null>(null);
const title = ref('');
const content = ref('');
const loading = ref(true);
const saving = ref(false);
const errorMessage = ref('');
const statusMessage = ref('');

const selectedNote = computed(() => notes.value.find((note) => note.id === selectedNoteId.value) ?? null);

function resetForm() {
  selectedNoteId.value = null;
  title.value = '';
  content.value = '';
}

function loadNoteIntoForm(note: Note) {
  selectedNoteId.value = note.id;
  title.value = note.title;
  content.value = note.content;
}

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {})
    },
    ...init
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => null) as { error?: string } | null;
    throw new Error(payload?.error ?? `Request failed with status ${response.status}`);
  }

  return response.status === 204 ? (undefined as T) : (response.json() as Promise<T>);
}

async function loadNotes() {
  loading.value = true;
  errorMessage.value = '';

  try {
    const data = await requestJson<NotesResponse>('/api/notes', { method: 'GET' });
    notes.value = data.notes;

    if (selectedNoteId.value !== null) {
      const nextSelected = data.notes.find((note) => note.id === selectedNoteId.value);
      if (nextSelected) {
        loadNoteIntoForm(nextSelected);
      }
    } else if (data.notes.length > 0) {
      loadNoteIntoForm(data.notes[0]);
    }
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Failed to load notes.';
  } finally {
    loading.value = false;
  }
}

async function saveNote() {
  saving.value = true;
  errorMessage.value = '';
  statusMessage.value = '';

  const payload = {
    title: title.value,
    content: content.value
  };

  try {
    const response = selectedNoteId.value === null
      ? await requestJson<NoteResponse>('/api/notes', {
          method: 'POST',
          body: JSON.stringify(payload)
        })
      : await requestJson<NoteResponse>(`/api/notes/${selectedNoteId.value}`, {
          method: 'PUT',
          body: JSON.stringify(payload)
        });

    statusMessage.value = selectedNoteId.value === null ? 'Note created.' : 'Note updated.';
    await loadNotes();
    loadNoteIntoForm(response.note);
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Failed to save note.';
  } finally {
    saving.value = false;
  }
}

async function deleteNote(noteId: number) {
  saving.value = true;
  errorMessage.value = '';
  statusMessage.value = '';

  try {
    await requestJson<void>(`/api/notes/${noteId}`, { method: 'DELETE' });
    statusMessage.value = 'Note deleted.';
    resetForm();
    await loadNotes();
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Failed to delete note.';
  } finally {
    saving.value = false;
  }
}

onMounted(loadNotes);
</script>

<template>
  <main class="screen">
    <div class="backdrop" />
    <section class="shell">
      <header class="hero">
        <div>
          <p class="eyebrow">Work Notes Dashboard</p>
          <h1>Notes backed by SQLite.</h1>
          <p class="subtitle">
            Create, edit, and delete notes through the backend API. The content is stored as
            plain text, so markdown stays exactly as you wrote it.
          </p>
        </div>
        <button class="primary" type="button" @click="resetForm">New note</button>
      </header>

      <div class="grid">
        <aside class="panel list-panel">
          <div class="panel-head">
            <h2>Saved notes</h2>
            <span>{{ notes.length }}</span>
          </div>

          <p v-if="loading" class="muted">Loading notes…</p>
          <p v-else-if="notes.length === 0" class="muted">No notes yet. Create the first one.</p>

          <ul v-else class="note-list">
            <li v-for="note in notes" :key="note.id">
              <button
                class="note-card"
                :class="{ active: note.id === selectedNoteId }"
                type="button"
                @click="loadNoteIntoForm(note)"
              >
                <strong>{{ note.title }}</strong>
                <pre>{{ note.content }}</pre>
              </button>
            </li>
          </ul>
        </aside>

        <section class="panel editor-panel">
          <div class="panel-head">
            <h2>{{ selectedNote ? 'Edit note' : 'Create note' }}</h2>
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
  </main>
</template>

<style scoped>
.screen {
  position: relative;
  min-height: 100vh;
  padding: 32px;
  overflow: hidden;
}

.backdrop {
  position: absolute;
  inset: 0;
  background:
    radial-gradient(circle at top left, rgba(255, 183, 77, 0.24), transparent 36%),
    radial-gradient(circle at 80% 20%, rgba(80, 109, 255, 0.22), transparent 28%),
    linear-gradient(180deg, #f8f3ea 0%, #edf2ff 100%);
}

.shell {
  position: relative;
  z-index: 1;
  width: min(1200px, 100%);
  margin: 0 auto;
}

.hero {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 20px;
  margin-bottom: 24px;
}

.eyebrow {
  margin: 0 0 12px;
  font-size: 0.78rem;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: #5e6a80;
}

h1,
h2,
p {
  margin: 0;
}

h1 {
  font-size: clamp(2.5rem, 5vw, 4.8rem);
  line-height: 0.95;
  letter-spacing: -0.05em;
  max-width: 10ch;
}

.subtitle {
  max-width: 62ch;
  margin-top: 16px;
  font-size: 1.05rem;
  line-height: 1.7;
  color: #44546f;
}

.grid {
  display: grid;
  grid-template-columns: 360px minmax(0, 1fr);
  gap: 20px;
}

.panel {
  border: 1px solid rgba(16, 32, 58, 0.08);
  border-radius: 26px;
  background: rgba(255, 255, 255, 0.76);
  box-shadow: 0 24px 80px rgba(38, 56, 112, 0.14);
  backdrop-filter: blur(16px);
}

.list-panel {
  padding: 20px;
}

.editor-panel {
  padding: 24px;
}

.panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 16px;
}

.panel-head span {
  color: #5e6a80;
  font-size: 0.95rem;
}

.note-list {
  list-style: none;
  display: grid;
  gap: 12px;
  padding: 0;
  margin: 0;
}

.note-card {
  width: 100%;
  display: grid;
  gap: 8px;
  padding: 16px;
  border: 1px solid rgba(16, 32, 58, 0.08);
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.88);
  color: #10203a;
  text-align: left;
  cursor: pointer;
  transition:
    transform 160ms ease,
    border-color 160ms ease,
    box-shadow 160ms ease;
}

.note-card:hover,
.note-card.active {
  transform: translateY(-1px);
  border-color: rgba(80, 109, 255, 0.32);
  box-shadow: 0 12px 30px rgba(38, 56, 112, 0.12);
}

.note-card strong {
  font-size: 1rem;
}

.note-card pre {
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
  color: #5e6a80;
  font-family: inherit;
  font-size: 0.92rem;
  line-height: 1.5;
}

.muted {
  color: #5e6a80;
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
  color: #4b5972;
}

input,
textarea {
  width: 100%;
  box-sizing: border-box;
  border: 1px solid rgba(16, 32, 58, 0.14);
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.94);
  color: #10203a;
  padding: 14px 16px;
  font: inherit;
  outline: none;
  transition: border-color 160ms ease, box-shadow 160ms ease;
}

textarea {
  resize: vertical;
  min-height: 280px;
}

input:focus,
textarea:focus {
  border-color: rgba(80, 109, 255, 0.55);
  box-shadow: 0 0 0 4px rgba(80, 109, 255, 0.12);
}

.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

button {
  border: 0;
  border-radius: 999px;
  font: inherit;
  cursor: pointer;
}

.primary,
.secondary,
.danger {
  padding: 12px 18px;
  transition:
    transform 160ms ease,
    opacity 160ms ease,
    background-color 160ms ease;
}

.primary {
  background: #10203a;
  color: #fff;
}

.secondary {
  background: rgba(16, 32, 58, 0.08);
  color: #10203a;
}

.danger {
  background: rgba(199, 61, 61, 0.12);
  color: #9c2222;
}

.primary:hover,
.secondary:hover,
.danger:hover {
  transform: translateY(-1px);
}

.primary:disabled,
.secondary:disabled,
.danger:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
}

.message {
  padding: 12px 14px;
  border-radius: 14px;
}

.message.success {
  background: rgba(66, 153, 80, 0.12);
  color: #24512d;
}

.message.error {
  background: rgba(199, 61, 61, 0.12);
  color: #9c2222;
}

@media (max-width: 960px) {
  .hero,
  .grid {
    grid-template-columns: 1fr;
    display: grid;
  }

  .hero {
    gap: 16px;
  }

  .screen {
    padding: 20px;
  }
}
</style>
