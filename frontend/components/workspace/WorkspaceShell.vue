<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import ChatPanel from '~/components/chat/ChatPanel.vue';
import NotesPanel from '~/components/notes/NotesPanel.vue';
import NotesTree from '~/components/notes/NotesTree.vue';
import TaskBoard from '~/components/tasks/TaskBoard.vue';
import { useNotes } from '~/composables/useNotes';
import { useTasks } from '~/composables/useTasks';
import type { ChatNotesActivity } from '~/types/chat';
import type { Task } from '~/types/task';

const route = useRoute();
const {
  noteTree,
  selectedNoteId,
  selectedNote,
  loading: notesLoading,
  errorMessage: notesErrorMessage,
  loadNotes,
  selectNoteById,
  deleteNote,
  saving: notesSaving
} = useNotes();
const {
  groupedTasks,
  collapseState,
  loading: tasksLoading,
  saving: tasksSaving,
  errorMessage: tasksErrorMessage,
  statusMessage: tasksStatusMessage,
  isEditorOpen,
  draftName,
  draftStatus,
  tasks,
  selectedTaskId,
  loadTasks,
  openCreateTask,
  openTask,
  closeTaskEditor,
  saveTask,
  completeTask,
  toggleStatusSection
} = useTasks();

const hasLoadedNotes = ref(false);

const currentWorkspaceMode = computed<'chat-first' | 'explore-notes' | 'tasks'>(() => {
  const path = route.path.replace(/\/+$/, '') || '/';

  if (path === '/explore') {
    return 'explore-notes';
  }

  if (path === '/tasks') {
    return 'tasks';
  }

  return 'chat-first';
});

const workspaceLinks = [
  { label: 'Chat', path: '/chat' },
  { label: 'Explore', path: '/explore' },
  { label: 'Tasks', path: '/tasks' }
];

const isExploreMode = computed(() => currentWorkspaceMode.value === 'explore-notes');
const isTasksMode = computed(() => currentWorkspaceMode.value === 'tasks');

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

function handleCreateTask() {
  openCreateTask();
}

function handleSelectTask(task: Task) {
  openTask(task);
}

function handleCloseTaskEditor() {
  closeTaskEditor();
}

function handleSaveTask() {
  void saveTask();
}

function handleCompleteTask() {
  void completeTask();
}

watch(
  currentWorkspaceMode,
  (mode) => {
    if (mode === 'tasks') {
      closeTaskEditor();
      void loadTasks();
      return;
    }

    closeTaskEditor();

    if (!hasLoadedNotes.value) {
      void loadNotes();
      hasLoadedNotes.value = true;
    }
  },
  { immediate: true }
);

onMounted(() => {
  if (currentWorkspaceMode.value !== 'tasks') {
    hasLoadedNotes.value = true;
  }
});
</script>

<template>
  <main class="screen" :class="currentWorkspaceMode">
    <div class="backdrop" aria-hidden="true" />

    <section class="shell">
      <header class="workspace-bar">
        <div class="copy">
          <h1>Work Notes</h1>
          <p class="subtitle">
            Notes, chat, and tasks in one workspace.
          </p>
        </div>

        <nav class="toolbar" aria-label="Workspace navigation">
          <RouterLink
            v-for="link in workspaceLinks"
            :key="link.path"
            class="nav-link"
            :class="{ active: route.path.replace(/\/+$/, '') === link.path }"
            :to="link.path"
          >
            {{ link.label }}
          </RouterLink>
        </nav>
      </header>

      <div class="workspace" :class="{ tasks: isTasksMode }">
        <aside v-if="!isTasksMode" class="left-rail">
          <ChatPanel v-show="currentWorkspaceMode === 'chat-first'" @notes-activity="handleNotesActivity" />

          <NotesTree
            v-if="isExploreMode"
            :nodes="noteTree"
            :selected-note-id="selectedNoteId"
            @select="handleSelectNote"
          />
        </aside>

        <NotesPanel
          v-if="!isTasksMode"
          :note="selectedNote"
          :loading="notesLoading"
          :error-message="notesErrorMessage"
          :mutating="notesSaving"
          :can-delete="isExploreMode"
          @delete="handleDeleteNote"
        />

        <TaskBoard
          v-else
          :tasks="tasks"
          :grouped-tasks="groupedTasks"
          :collapse-state="collapseState"
          :loading="tasksLoading"
          :saving="tasksSaving"
          :error-message="tasksErrorMessage"
          :status-message="tasksStatusMessage"
          v-model:isEditorOpen="isEditorOpen"
          v-model:draftName="draftName"
          v-model:draftStatus="draftStatus"
          :is-editing="selectedTaskId !== null"
          @create="handleCreateTask"
          @select="handleSelectTask"
          @toggle="toggleStatusSection"
          @save="handleSaveTask"
          @complete="handleCompleteTask"
          @close="handleCloseTaskEditor"
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
  gap: 8px;
}

h1 {
  margin: 0;
  max-width: 16ch;
  font-size: clamp(2.1rem, 4.2vw, 4.6rem);
  line-height: 0.96;
  letter-spacing: -0.07em;
}

.subtitle {
  margin: 0;
  color: var(--muted);
  max-width: 42ch;
}

.toolbar {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 10px;
}

.nav-link {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid color-mix(in srgb, var(--accent) 28%, var(--border));
  border-radius: 999px;
  padding: 11px 16px;
  background: color-mix(in srgb, var(--panel-muted) 84%, transparent);
  color: var(--text-strong);
  text-decoration: none;
  transition:
    transform 160ms ease,
    opacity 160ms ease,
    border-color 160ms ease,
    background-color 160ms ease;
}

.nav-link:hover,
.nav-link:focus-visible {
  transform: translateY(-1px);
}

.nav-link.active {
  border-color: color-mix(in srgb, var(--accent) 38%, var(--border));
  background: linear-gradient(135deg, var(--accent-strong), var(--accent));
  color: white;
}

.workspace {
  display: grid;
  grid-template-columns: minmax(320px, 0.85fr) minmax(0, 1.15fr);
  gap: 18px;
  align-items: start;
}

.workspace.tasks {
  grid-template-columns: 1fr;
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
