<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';

const props = withDefaults(
  defineProps<{
    modelValue: boolean;
    sessionName?: string | null;
    busy?: boolean;
    errorMessage?: string;
  }>(),
  {
    sessionName: '',
    busy: false,
    errorMessage: ''
  }
);

const emit = defineEmits<{
  (event: 'update:modelValue', value: boolean): void;
  (event: 'submit', value: string): void;
  (event: 'cancel'): void;
}>();

const draft = ref('');
const localError = ref('');
const inputEl = ref<HTMLInputElement | null>(null);

const isOpen = computed(() => props.modelValue);
const trimmedDraft = computed(() => draft.value.trim());

watch(
  () => props.modelValue,
  async (isVisible) => {
    if (!isVisible) {
      localError.value = '';
      return;
    }

    draft.value = props.sessionName ?? '';
    localError.value = '';
    await nextTick();
    inputEl.value?.focus();
    inputEl.value?.select();
  },
  { immediate: true }
);

watch(
  () => props.sessionName,
  (sessionName) => {
    if (props.modelValue) {
      draft.value = sessionName ?? '';
    }
  }
);

function close() {
  emit('update:modelValue', false);
  emit('cancel');
}

function submit() {
  const nextName = draft.value.trim();

  if (!nextName) {
    localError.value = 'A valid session name is required.';
    return;
  }

  localError.value = '';
  emit('submit', nextName);
}
</script>

<template>
  <div v-if="isOpen" class="rename-modal-backdrop">
    <section
      class="rename-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="rename-session-title"
    >
      <header class="rename-modal-header">
        <div>
          <p class="rename-eyebrow">session tools</p>
          <h3 id="rename-session-title">Rename session</h3>
        </div>
        <button type="button" class="close-button" :disabled="busy" @click="close">
          Close
        </button>
      </header>

      <form class="rename-form" @submit.prevent="submit">
        <label class="rename-field" for="session-rename-input">
          <span class="rename-label">Session name</span>
          <input
            id="session-rename-input"
            ref="inputEl"
            v-model="draft"
            type="text"
            maxlength="120"
            autocomplete="off"
            spellcheck="false"
            :disabled="busy"
            placeholder="Enter a session name"
          />
        </label>

        <p v-if="localError || errorMessage" class="rename-error" role="alert">
          {{ localError || errorMessage }}
        </p>

        <div class="rename-actions">
          <button type="button" class="secondary-button" :disabled="busy" @click="close">
            Cancel
          </button>
          <button type="submit" class="primary-button" :disabled="busy || trimmedDraft.length === 0">
            {{ busy ? 'Saving...' : 'Save' }}
          </button>
        </div>
      </form>
    </section>
  </div>
</template>

<style scoped>
.rename-modal-backdrop {
  position: fixed;
  inset: 0;
  z-index: 30;
  display: grid;
  place-items: center;
  padding: 20px;
  background: rgba(5, 10, 18, 0.68);
  backdrop-filter: blur(10px);
}

.rename-modal {
  width: min(100%, 520px);
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

.rename-modal-header {
  display: flex;
  align-items: start;
  justify-content: space-between;
  gap: 12px;
}

.rename-eyebrow,
.rename-label {
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

.rename-form {
  display: grid;
  gap: 14px;
}

.rename-field {
  display: grid;
  gap: 8px;
}

input {
  min-height: 40px;
  padding: 0 14px;
  border: 1px solid var(--border);
  border-radius: 14px;
  background: color-mix(in srgb, var(--panel-muted) 88%, transparent);
  color: var(--text-strong);
  outline: none;
}

input:focus {
  border-color: color-mix(in srgb, var(--accent) 60%, var(--border));
  box-shadow: 0 0 0 4px color-mix(in srgb, var(--accent) 16%, transparent);
}

.rename-error {
  margin: 0;
  color: #fecaca;
  font-family: var(--mono-font);
  line-height: 1.5;
}

.rename-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

.close-button:disabled,
.secondary-button:disabled,
.primary-button:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

@keyframes modal-in {
  from {
    opacity: 0;
    transform: translateY(10px) scale(0.98);
  }

  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

@media (max-width: 640px) {
  .rename-modal {
    padding: 16px;
  }

  .rename-actions {
    flex-direction: column-reverse;
  }

  .rename-actions > button {
    width: 100%;
  }
}
</style>
