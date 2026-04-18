import { computed, ref } from 'vue';
import type { Note, NoteInput, NoteResponse, NotesResponse } from '~/types/note';

export interface NoteTreeNode {
  id: string;
  label: string;
  noteId?: number;
  children?: NoteTreeNode[];
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
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(payload?.error ?? `Request failed with status ${response.status}`);
  }

  return response.status === 204 ? (undefined as T) : (response.json() as Promise<T>);
}

export function useNotes() {
  const notes = ref<Note[]>([]);
  const selectedNoteId = ref<number | null>(null);
  const title = ref('');
  const content = ref('');
  const loading = ref(true);
  const saving = ref(false);
  const errorMessage = ref('');
  const statusMessage = ref('');
  const selectedNoteSnapshot = ref<Note | null>(null);

  const selectedNote = computed(
    () => notes.value.find((note) => note.id === selectedNoteId.value) ?? null
  );
  const noteTree = computed<NoteTreeNode[]>(() =>
    notes.value.map((note) => ({
      id: `note-${note.id}`,
      label: note.title,
      noteId: note.id,
      children: []
    }))
  );
  const isEditorDirty = computed(() => {
    if (selectedNoteSnapshot.value) {
      return (
        title.value !== selectedNoteSnapshot.value.title ||
        content.value !== selectedNoteSnapshot.value.content
      );
    }

    return title.value.trim().length > 0 || content.value.trim().length > 0;
  });

  function resetForm() {
    selectedNoteId.value = null;
    title.value = '';
    content.value = '';
    selectedNoteSnapshot.value = null;
  }

  function selectNote(note: Note) {
    selectedNoteId.value = note.id;
    title.value = note.title;
    content.value = note.content;
    selectedNoteSnapshot.value = note;
  }

  function selectNoteById(noteId: number) {
    const note = notes.value.find((entry) => entry.id === noteId);
    if (note) {
      selectNote(note);
    }
  }

  async function loadNotes(options: { preserveEditorFields?: boolean } = {}) {
    loading.value = true;
    errorMessage.value = '';

    try {
      const data = await requestJson<NotesResponse>('/api/notes', { method: 'GET' });
      notes.value = data.notes;

      if (options.preserveEditorFields && isEditorDirty.value) {
        return;
      }

      if (selectedNoteId.value !== null) {
        const nextSelected = data.notes.find((note) => note.id === selectedNoteId.value);
        if (nextSelected) {
          selectNote(nextSelected);
        }
      } else if (data.notes.length > 0) {
        selectNote(data.notes[0]);
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

    const payload: NoteInput = {
      title: title.value,
      content: content.value
    };

    try {
      const response =
        selectedNoteId.value === null
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
      selectNote(response.note);
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

  return {
    notes,
    selectedNoteId,
    selectedNote,
    noteTree,
    isEditorDirty,
    title,
    content,
    loading,
    saving,
    errorMessage,
    statusMessage,
    resetForm,
    selectNote,
    selectNoteById,
    loadNotes,
    saveNote,
    deleteNote
  };
}
