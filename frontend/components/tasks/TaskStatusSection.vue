<script setup lang="ts">
import type { Task } from '~/types/task';
import type { TaskStatus } from '~/types/task';
import TaskCard from '~/components/tasks/TaskCard.vue';

defineProps<{
  title: string;
  status: TaskStatus;
  tasks: Task[];
  collapsed: boolean;
}>();

defineEmits<{
  (event: 'toggle', status: TaskStatus): void;
  (event: 'select', task: Task): void;
}>();
</script>

<template>
  <section class="status-section">
    <button
      type="button"
      class="status-divider"
      :aria-expanded="String(!collapsed)"
      @click="$emit('toggle', status)"
    >
      <span class="status-title">{{ title }}</span>
      <span class="status-count">{{ tasks.length }}</span>
      <span class="status-action">{{ collapsed ? 'Expand' : 'Collapse' }}</span>
    </button>

    <div v-if="!collapsed" class="status-grid">
      <TaskCard v-for="task in tasks" :key="task.id" :task="task" @select="$emit('select', task)" />
    </div>

    <p v-else class="status-collapsed-copy">Section collapsed.</p>
  </section>
</template>

<style scoped>
.status-section {
  display: grid;
  gap: 12px;
}

.status-divider {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 12px 0;
  border: 0;
  border-top: 1px solid var(--border);
  background: transparent;
  color: var(--text-strong);
  text-align: left;
  cursor: pointer;
}

.status-title {
  font: 700 0.85rem/1 var(--mono-font);
  letter-spacing: 0.16em;
  text-transform: uppercase;
}

.status-count,
.status-action {
  color: var(--muted-strong);
  font: 600 0.72rem/1 var(--mono-font);
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.status-action {
  margin-left: auto;
}

.status-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 12px;
}

.status-collapsed-copy {
  margin: 0;
  color: var(--muted);
  font-size: 0.92rem;
}
</style>
