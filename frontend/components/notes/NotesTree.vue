<script setup lang="ts">
import type { NoteTreeNode } from '~/composables/useNotes';

defineOptions({
  name: 'NotesTree'
});

const props = withDefaults(
  defineProps<{
    nodes: NoteTreeNode[];
    selectedNoteId: number | null;
    depth?: number;
  }>(),
  {
    depth: 0
  }
);

const emit = defineEmits<{
  (event: 'select', noteId: number): void;
}>();

function handleSelect(node: NoteTreeNode) {
  if (node.noteId !== undefined) {
    emit('select', node.noteId);
  }
}
</script>

<template>
  <section class="notes-tree" :class="{ nested: depth > 0 }">
    <header v-if="depth === 0" class="tree-header">
      <h2>Notes</h2>
    </header>

    <ul class="tree-list">
      <li
        v-for="node in nodes"
        :key="node.id"
        class="tree-node"
        :class="{
          active: node.noteId !== undefined && node.noteId === selectedNoteId,
          branch: depth > 0
        }"
      >
        <button
          v-if="node.noteId !== undefined"
          class="tree-item"
          type="button"
          @click="handleSelect(node)"
        >
          <span class="marker" aria-hidden="true">▸</span>
          <span class="label">{{ node.label }}</span>
        </button>
        <div v-else class="tree-folder">
          <span class="marker" aria-hidden="true">▾</span>
          <span class="label">{{ node.label }}</span>
        </div>

        <NotesTree
          v-if="node.children?.length"
          :nodes="node.children"
          :selected-note-id="selectedNoteId"
          :depth="depth + 1"
          @select="emit('select', $event)"
        />
      </li>
    </ul>
  </section>
</template>

<style scoped>
.notes-tree {
  display: grid;
  gap: 12px;
  min-height: 0;
}

.tree-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.eyebrow {
  margin: 0 0 8px;
  text-transform: uppercase;
  letter-spacing: 0.18em;
  font-size: 0.72rem;
  color: var(--muted-strong);
}

h2 {
  margin: 0;
  font-size: 1rem;
  color: var(--text-strong);
}

.tree-count {
  align-self: start;
  border-radius: 999px;
  padding: 6px 10px;
  border: 1px solid var(--border);
  background: color-mix(in srgb, var(--panel-muted) 86%, transparent);
  color: var(--muted);
  font-size: 0.85rem;
}

.tree-list {
  list-style: none;
  display: grid;
  gap: 8px;
  margin: 0;
  padding: 0;
}

.tree-node {
  display: grid;
  gap: 8px;
}

.tree-item,
.tree-folder {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 10px 12px;
  border-radius: 14px;
  border: 1px solid transparent;
  background: transparent;
  color: var(--text);
  text-align: left;
}

.tree-item {
  cursor: pointer;
  background: color-mix(in srgb, var(--panel-muted) 82%, transparent);
  border-color: var(--border);
}

.tree-node.active > .tree-item {
  border-color: color-mix(in srgb, var(--accent) 50%, var(--border));
  background: color-mix(in srgb, var(--accent) 12%, var(--panel-muted));
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--accent) 14%, transparent);
}

.tree-item:hover,
.tree-item:focus-visible {
  border-color: color-mix(in srgb, var(--accent) 40%, var(--border));
}

.tree-folder {
  color: var(--text-strong);
}

.marker {
  width: 1ch;
  color: var(--accent);
  font-family: var(--mono-font);
  font-size: 0.92rem;
}

.label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.nested {
  padding-left: 1rem;
  border-left: 1px solid color-mix(in srgb, var(--border) 90%, transparent);
}

.branch {
  margin-left: 0.2rem;
}

@media (max-width: 960px) {
  .tree-header {
    flex-direction: column;
    align-items: stretch;
  }
}
</style>
