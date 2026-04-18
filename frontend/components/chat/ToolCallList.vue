<script setup lang="ts">
import type { ChatToolCall } from '~/types/chat';

const props = withDefaults(
  defineProps<{
    toolCalls?: ChatToolCall[];
  }>(),
  {
    toolCalls: () => []
  }
);

function summarizeToolCall(toolCall: ChatToolCall, index: number) {
  if (!toolCall || typeof toolCall !== 'object') {
    return `tool call ${index + 1}`;
  }

  const record = toolCall as Record<string, unknown>;
  const candidateNames: unknown[] = [
    record.name,
    record.type,
    record.function && typeof record.function === 'object'
      ? (record.function as Record<string, unknown>).name
      : null
  ];

  const label = candidateNames.find(
    (value): value is string => typeof value === 'string' && value.trim().length > 0
  );

  return label ? label : `tool call ${index + 1}`;
}

function formatToolCall(toolCall: ChatToolCall) {
  try {
    return JSON.stringify(toolCall, null, 2);
  } catch {
    return String(toolCall);
  }
}
</script>

<template>
  <section class="tool-call-list" aria-label="Tool calls">
    <article v-for="(toolCall, index) in props.toolCalls" :key="index" class="tool-call">
      <div class="tool-call-meta">
        <span class="tool-call-prefix">tool</span>
        <span class="tool-call-label">{{ summarizeToolCall(toolCall, index) }}</span>
      </div>
      <pre>{{ formatToolCall(toolCall) }}</pre>
    </article>
  </section>
</template>

<style scoped>
.tool-call-list {
  display: grid;
  gap: 10px;
  margin-top: 2px;
}

.tool-call {
  display: grid;
  gap: 8px;
  padding: 12px 14px;
  border-radius: 12px;
  border: 1px solid color-mix(in srgb, var(--accent) 24%, var(--border));
  background: color-mix(in srgb, var(--panel-elevated) 74%, transparent);
}

.tool-call-meta {
  display: inline-flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  color: var(--muted-strong);
  font-family: var(--mono-font);
  font-size: 0.68rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.tool-call-prefix {
  color: var(--accent);
}

.tool-call-label {
  color: var(--text-strong);
}

pre {
  margin: 0;
  overflow: auto;
  padding: 10px 12px;
  border-radius: 10px;
  background: color-mix(in srgb, var(--surface) 82%, transparent);
  color: var(--text);
  font: 500 0.78rem/1.55 var(--mono-font);
  white-space: pre-wrap;
  word-break: break-word;
}
</style>
