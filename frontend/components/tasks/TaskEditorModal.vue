<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';
import type { TaskStatus } from '~/types/task';

const props = withDefaults(
  defineProps<{
    modelValue: boolean;
    name?: string;
    status?: TaskStatus;
    busy?: boolean;
    errorMessage?: string;
    isEditing?: boolean;
  }>(),
  {
    name: '',
    status: 'todo',
    busy: false,
    errorMessage: '',
    isEditing: false
  }
);

const emit = defineEmits<{
  (event: 'update:modelValue', value: boolean): void;
  (event: 'update:name', value: string): void;
  (event: 'update:status', value: TaskStatus): void;
  (event: 'save'): void;
  (event: 'complete'): void;
  (event: 'cancel'): void;
}>();

const localError = ref('');
const inputEl = ref<HTMLInputElement | null>(null);

const isOpen = computed(() => props.modelValue);
const trimmedName = computed(() => props.name.trim());

watch(
  () => props.modelValue,
  async (isVisible) => {
    if (!isVisible) {
      localError.value = '';
      return;
    }

    localError.value = '';
    await nextTick();
    inputEl.value?.focus();
    inputEl.value?.select();
  },
  { immediate: true }
);

function close() {
  emit('update:modelValue', false);
  emit('cancel');
}

function submit() {
  if (!trimmedName.value) {
    localError.value = 'A valid task name is required.';
    return;
  }

  localError.value = '';
  emit('save');
}

function updateName(event: Event) {
  emit('update:name', (event.target as HTMLInputElement).value);
}

function updateStatus(event: Event) {
  emit('update:status', (event.target as HTMLSelectElement).value as TaskStatus);
}
</script>

<template>
  <div v-if="isOpen" class="task-modal-backdrop">
    <section class="task-modal" role="dialog" aria-modal="true" aria-labelledby="task-editor-title">
      <header class="task-modal-header">
        <div>
          <p class="task-eyebrow">task board</p>
          <h3 id="task-editor-title">{{ isEditing ? 'Edit task' : 'New task' }}</h3>
        </div>
        <button type="button" class="close-button" :disabled="busy" @click="close">Close</button>
      </header>

      <form class="task-form" @submit.prevent="submit">
        <label class="task-field" for="task-name-input">
          <span class="task-label">Task name</span>
          <input
            id="task-name-input"
            ref="inputEl"
            :value="name"
            type="text"
            maxlength="160"
            autocomplete="off"
            spellcheck="false"
            :disabled="busy"
            placeholder="Enter a task name"
            @input="updateName"
          />
        </label>

        <label class="task-field" for="task-status-select">
          <span class="task-label">Status</span>
          <select
            id="task-status-select"
            :value="status"
            :disabled="busy"
            @change="updateStatus"
          >
            <option value="todo">Todo</option>
            <option value="backlog">Backlog</option>
            <option value="in progress">In progress</option>
            <option value="completed">Completed</option>
          </select>
        </label>

        <p v-if="localError || errorMessage" class="task-error" role="alert">
          {{ localError || errorMessage }}
        </p>

        <div class="task-actions">
          <button type="button" class="secondary-button" :disabled="busy" @click="close">
            Cancel
          </button>
          <button
            v-if="isEditing"
            type="button"
            class="secondary-button"
            :disabled="busy"
            @click="$emit('complete')"
          >
            Complete
          </button>
          <button type="submit" class="primary-button" :disabled="busy || trimmedName.length === 0">
            {{ busy ? 'Saving...' : 'Save task' }}
          </button>
        </div>
      </form>
    </section>
  </div>
</template>

<style scoped>
.task-modal-backdrop {
  position: fixed;
  inset: 0;
  z-index: 30;
  display: grid;
  place-items: center;
  padding: 20px;
  background: rgba(5, 10, 18, 0.68);
  backdrop-filter: blur(10px);
}

.task-modal {
  width: min(100%, 560px);
  display: grid;
  gap: 18px;
  padding: 20px;
  border: 1px solid var(--border);
  border-radius: 20px;
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--panel-elevated) 96%, transparent), var(--surface)),
    var(--surface);
  box-shadow: var(--shadow);
  animation: modal-in 180ms ease;
}

.task-modal-header {
  display: flex;
  align-items: start;
  justify-content: space-between;
  gap: 12px;
}

.task-eyebrow,
.task-label {
  margin: 0;
  color: var(--muted-strong);
  font: 600 0.7rem/1 var(--mono-font);
  letter-spacing: 0.18em;
  text-transform: uppercase;
}

h3 {
  margin: 6px 0 0;
  font-size: 1.2rem;
  line-height: 1.2;
  letter-spacing: -0.04em;
}

.close-button,
.secondary-button,
.primary-button {
  min-height: 34px;
  padding: 0 14px;
  border-radius: 999px;
  border: 1px solid var(--border);
  cursor: pointer;
  transition:
    transform 160ms ease,
    opacity 160ms ease,
    border-color 160ms ease,
    background-color 160ms ease;
}

.close-button,
.secondary-button {
  background: color-mix(in srgb, var(--panel-muted) 88%, transparent);
  color: var(--text-strong);
}

.primary-button {
  border-color: color-mix(in srgb, var(--accent) 45%, var(--border));
  background: linear-gradient(135deg, var(--accent-strong), var(--accent));
  color: white;
}

.close-button:hover:not(:disabled),
.close-button:focus-visible:not(:disabled),
.secondary-button:hover:not(:disabled),
.secondary-button:focus-visible:not(:disabled),
.primary-button:hover:not(:disabled),
.primary-button:focus-visible:not(:disabled) {
  transform: translateY(-1px);
}

.secondary-button:hover:not(:disabled),
.secondary-button:focus-visible:not(:disabled) {
  border-color: color-mix(in srgb, var(--accent) 38%, var(--border));
}

.task-form {
  display: grid;
  gap: 14px;
}

.task-field {
  display: grid;
  gap: 8px;
}

input,
select {
  min-height: 40px;
  padding: 0 14px;
  border: 1px solid var(--border);
  border-radius: 14px;
  background: color-mix(in srgb, var(--panel-muted) 88%, transparent);
  color: var(--text-strong);
  outline: none;
}

input:focus,
select:focus {
  border-color: color-mix(in srgb, var(--accent) 60%, var(--border));
  box-shadow: 0 0 0 4px color-mix(in srgb, var(--accent) 16%, transparent);
}

.task-error {
  margin: 0;
  color: var(--danger);
}

.task-actions {
  display: flex;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: 10px;
}

@keyframes modal-in {
  from {
    transform: translateY(10px) scale(0.98);
    opacity: 0;
  }

  to {
    transform: translateY(0) scale(1);
    opacity: 1;
  }
}

@media (max-width: 540px) {
  .task-modal {
    padding: 16px;
  }

  .task-actions {
    justify-content: stretch;
  }

  .task-actions > button {
    flex: 1 1 0;
  }
}
</style>
