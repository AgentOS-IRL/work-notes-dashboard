<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import ChatPanel from '~/components/chat/ChatPanel.vue';
import NotesPanel from '~/components/notes/NotesPanel.vue';
import NotesTree from '~/components/notes/NotesTree.vue';
import { useNotes } from '~/composables/useNotes';
import type { ChatNotesActivity } from '~/types/chat';

const route = useRoute();
const {
  noteTree,
  selectedNoteId,
  selectedNote,
  loading,
  errorMessage,
  loadNotes,
  selectNoteById,
  deleteNote,
  saving
} = useNotes();

const currentWorkspaceMode = computed<'chat-first' | 'explore-notes'>(() => {
  const path = route.path.replace(/\/+$/, '') || '/';

  return path === '/explore' ? 'explore-notes' : 'chat-first';
});

const workspaceToggleLabel = computed(() =>
  currentWorkspaceMode.value === 'chat-first' ? 'Explore' : 'Chat'
);

const workspaceToggleTarget = computed(() =>
  currentWorkspaceMode.value === 'chat-first' ? '/explore' : '/chat'
);

const isExploreMode = computed(() => currentWorkspaceMode.value === 'explore-notes');

onMounted(() => {
  void loadNotes();
});

function handleNotesActivity(activity: ChatNotesActivity) {
  void loadNotes({
    focusNoteIds: [...activity.createdNoteIds, ...activity.changedNoteIds, ...activity.openedNoteIds]
  });
}

function handleSelectNote(noteId: number) {
  selectNoteById(noteId);
}

async function handleDeleteNote() {
  const note = selectedNote.value;

  if (!note || !window.confirm(`Delete "${note.title}"?`)) {
    return;
  }

  await deleteNote(note.id);
}
</script>

<template>
  <main class="screen" :class="currentWorkspaceMode">
    <div class="backdrop" aria-hidden="true" />

    <section class="shell">
      <header class="workspace-bar">
        <div class="copy">
          <h1>Work Notes</h1>
        </div>

        <div class="toolbar" aria-label="Workspace controls">
          <RouterLink class="toggle-button" :to="workspaceToggleTarget">
            {{ workspaceToggleLabel }}
          </RouterLink>
        </div>
      </header>

      <div class="workspace">
        <aside class="left-rail">
          <ChatPanel v-show="currentWorkspaceMode === 'chat-first'" @notes-activity="handleNotesActivity" />

          <NotesTree
            v-if="isExploreMode"
            :nodes="noteTree"
            :selected-note-id="selectedNoteId"
            @select="handleSelectNote"
          />
        </aside>

        <NotesPanel
          :note="selectedNote"
          :loading="loading"
          :error-message="errorMessage"
          :mutating="saving"
          :can-delete="isExploreMode"
          @delete="handleDeleteNote"
        />
      </div>
    </section>
  </main>
</template>

<style scoped>
.screen {
  position: relative;
  min-height: 100vh;
  padding: 24px;
  overflow: hidden;
}

.backdrop {
  position: absolute;
  inset: 0;
  background:
    radial-gradient(circle at 12% 12%, rgba(62, 140, 255, 0.18), transparent 26%),
    radial-gradient(circle at 88% 14%, rgba(38, 208, 132, 0.12), transparent 28%),
    radial-gradient(circle at 50% 96%, rgba(7, 10, 18, 0.94), transparent 30%),
    linear-gradient(180deg, var(--page-bg) 0%, var(--page-bg-alt) 100%);
}

.shell {
  position: relative;
  z-index: 1;
  width: min(1520px, 100%);
  margin: 0 auto;
  display: grid;
  gap: 18px;
}

.workspace-bar {
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: 18px;
  padding: 4px 2px 0;
}

.copy {
  display: grid;
  gap: 10px;
}

h1 {
  margin: 0;
  max-width: 16ch;
  font-size: clamp(2.1rem, 4.2vw, 4.6rem);
  line-height: 0.96;
  letter-spacing: -0.07em;
}

.toolbar {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 10px;
}

.toggle-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid color-mix(in srgb, var(--accent) 38%, var(--border));
  border-radius: 999px;
  padding: 11px 16px;
  background: linear-gradient(135deg, var(--accent-strong), var(--accent));
  color: white;
  cursor: pointer;
  text-decoration: none;
  transition:
    transform 160ms ease,
    opacity 160ms ease;
}

.toggle-button:hover,
.toggle-button:focus-visible {
  transform: translateY(-1px);
}

.workspace {
  display: grid;
  grid-template-columns: minmax(320px, 0.85fr) minmax(0, 1.15fr);
  gap: 18px;
  align-items: start;
}

.left-rail {
  display: grid;
  gap: 16px;
  min-height: 0;
}

@media (max-width: 1240px) {
  .workspace {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 960px) {
  .screen {
    padding: 16px;
  }

  .workspace-bar {
    flex-direction: column;
    align-items: stretch;
  }

  .toolbar {
    justify-content: flex-start;
  }
}
</style>
