<script setup lang="ts">
import { computed } from 'vue';
import { TASK_STATUS_ORDER, type TaskCollapseState, type TaskGroups } from '~/composables/useTasks';
import TaskEditorModal from '~/components/tasks/TaskEditorModal.vue';
import TaskStatusSection from '~/components/tasks/TaskStatusSection.vue';
import type { Task, TaskStatus } from '~/types/task';

const props = defineProps<{
  tasks: Task[];
  groupedTasks: TaskGroups;
  collapseState: TaskCollapseState;
  loading: boolean;
  saving: boolean;
  errorMessage: string;
  statusMessage: string;
  isEditorOpen: boolean;
  draftName: string;
  draftStatus: TaskStatus;
  isEditing: boolean;
}>();

const emit = defineEmits<{
  (event: 'create'): void;
  (event: 'select', task: Task): void;
  (event: 'toggle', status: TaskStatus): void;
  (event: 'update:isEditorOpen', value: boolean): void;
  (event: 'update:draftName', value: string): void;
  (event: 'update:draftStatus', value: TaskStatus): void;
  (event: 'save'): void;
  (event: 'complete'): void;
  (event: 'close'): void;
}>();

const hasTasks = computed(() => props.tasks.length > 0);

const statusLabels: Record<TaskStatus, string> = {
  todo: 'Todo',
  backlog: 'Backlog',
  'in progress': 'In progress',
  completed: 'Completed'
};
</script>

<template>
  <section class="task-board">
    <header class="board-header">
      <div class="board-copy">
        <p class="eyebrow">task manager</p>
        <h2>Tasks</h2>
        <p class="summary">
          {{ hasTasks ? `${tasks.length} tasks across ${TASK_STATUS_ORDER.length} groups.` : 'No tasks yet.' }}
        </p>
      </div>

      <div class="board-actions">
        <p v-if="statusMessage" class="status-message" role="status">{{ statusMessage }}</p>
        <button type="button" class="create-button" :disabled="loading || saving" @click="$emit('create')">
          New task
        </button>
      </div>
    </header>

    <p v-if="errorMessage" class="error-banner" role="alert">{{ errorMessage }}</p>
    <p v-if="loading" class="loading-state">Loading tasks...</p>
    <p v-else-if="!hasTasks" class="empty-state">Create a task to start filling the board.</p>

    <div v-else class="status-list">
      <TaskStatusSection
        v-for="status in TASK_STATUS_ORDER"
        :key="status"
        :title="statusLabels[status]"
        :status="status"
        :tasks="groupedTasks[status]"
        :collapsed="collapseState[status]"
        @toggle="$emit('toggle', status)"
        @select="$emit('select', $event)"
      />
    </div>

    <TaskEditorModal
      :model-value="isEditorOpen"
      :name="draftName"
      :status="draftStatus"
      :busy="saving"
      :error-message="errorMessage"
      :is-editing="isEditing"
      @update:modelValue="$emit('update:isEditorOpen', $event)"
      @update:name="$emit('update:draftName', $event)"
      @update:status="$emit('update:draftStatus', $event)"
      @save="$emit('save')"
      @complete="$emit('complete')"
      @cancel="$emit('close')"
    />
  </section>
</template>

<style scoped>
.task-board {
  display: grid;
  gap: 16px;
  align-content: start;
}

.board-header {
  display: flex;
  align-items: start;
  justify-content: space-between;
  gap: 16px;
  padding: 2px 2px 0;
}

.board-copy {
  display: grid;
  gap: 8px;
}

.eyebrow {
  margin: 0;
  color: var(--muted-strong);
  font: 600 0.72rem/1 var(--mono-font);
  letter-spacing: 0.18em;
  text-transform: uppercase;
}

h2 {
  margin: 0;
  font-size: clamp(1.8rem, 3vw, 3rem);
  line-height: 1;
  letter-spacing: -0.06em;
}

.summary,
.loading-state,
.empty-state {
  margin: 0;
  color: var(--muted);
}

.board-actions {
  display: grid;
  justify-items: end;
  gap: 10px;
}

.status-message {
  margin: 0;
  color: var(--success);
}

.create-button {
  min-height: 40px;
  padding: 0 16px;
  border: 1px solid color-mix(in srgb, var(--accent) 40%, var(--border));
  border-radius: 999px;
  background: linear-gradient(135deg, var(--accent-strong), var(--accent));
  color: white;
  cursor: pointer;
  transition:
    transform 160ms ease,
    opacity 160ms ease;
}

.create-button:hover:not(:disabled),
.create-button:focus-visible:not(:disabled) {
  transform: translateY(-1px);
}

.error-banner {
  margin: 0;
  padding: 12px 14px;
  border: 1px solid color-mix(in srgb, var(--danger) 38%, var(--border));
  border-radius: 16px;
  background: color-mix(in srgb, var(--danger) 10%, var(--surface));
  color: var(--danger);
}

.status-list {
  display: grid;
  gap: 10px;
}

@media (max-width: 900px) {
  .board-header {
    flex-direction: column;
  }

  .board-actions {
    justify-items: start;
  }
}
</style>
