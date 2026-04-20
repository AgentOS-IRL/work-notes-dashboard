<script setup lang="ts">
import type { Task } from '~/types/task';

defineProps<{
  task: Task;
}>();

defineEmits<{
  (event: 'select', task: Task): void;
}>();
</script>

<template>
  <button type="button" class="task-card" @click="$emit('select', task)">
    <div class="task-card-head">
      <p class="task-name">{{ task.name }}</p>
      <span class="task-status">{{ task.status }}</span>
    </div>
    <p class="task-meta">Open to edit</p>
  </button>
</template>

<style scoped>
.task-card {
  display: grid;
  gap: 10px;
  width: 100%;
  min-height: 110px;
  padding: 16px;
  border: 1px solid var(--border);
  border-radius: 18px;
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--panel-elevated) 94%, transparent), var(--surface)),
    var(--surface);
  color: var(--text);
  text-align: left;
  cursor: pointer;
  transition:
    transform 160ms ease,
    border-color 160ms ease,
    box-shadow 160ms ease;
}

.task-card:hover,
.task-card:focus-visible {
  transform: translateY(-1px);
  border-color: color-mix(in srgb, var(--accent) 32%, var(--border));
  box-shadow: 0 18px 42px rgba(0, 0, 0, 0.2);
}

.task-card-head {
  display: flex;
  align-items: start;
  justify-content: space-between;
  gap: 12px;
}

.task-name {
  margin: 0;
  font-weight: 600;
  line-height: 1.35;
  letter-spacing: -0.03em;
}

.task-status {
  flex: none;
  padding: 4px 10px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--panel-muted) 84%, transparent);
  color: var(--muted-strong);
  font: 600 0.7rem/1 var(--mono-font);
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.task-meta {
  margin: 0;
  color: var(--muted);
  font-size: 0.9rem;
}
</style>
