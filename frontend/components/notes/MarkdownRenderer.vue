<script setup lang="ts">
import { computed } from 'vue';
import MarkdownIt from 'markdown-it';

const props = defineProps<{
  content: string;
}>();

const markdown = new MarkdownIt({
  html: false,
  breaks: true,
  linkify: true,
  typographer: true
});

const rendered = computed(() => markdown.render(props.content || ''));
</script>

<template>
  <div class="markdown-renderer">
    <div v-if="content.trim().length === 0" class="empty-state">
      <p>No content yet.</p>
    </div>
    <article v-else class="markdown-body" v-html="rendered" />
  </div>
</template>

<style scoped>
.markdown-renderer {
  display: grid;
  min-height: 0;
}

.empty-state {
  padding: 18px;
  border-radius: 18px;
  border: 1px dashed var(--border);
  color: var(--muted);
  background: color-mix(in srgb, var(--panel-muted) 68%, transparent);
}

.empty-state p {
  margin: 0;
}

.markdown-body {
  display: grid;
  gap: 1rem;
  color: var(--text);
  line-height: 1.7;
  overflow-wrap: anywhere;
}

.markdown-body :deep(h1),
.markdown-body :deep(h2),
.markdown-body :deep(h3),
.markdown-body :deep(h4),
.markdown-body :deep(h5),
.markdown-body :deep(h6),
.markdown-body :deep(p),
.markdown-body :deep(ul),
.markdown-body :deep(ol),
.markdown-body :deep(blockquote),
.markdown-body :deep(table),
.markdown-body :deep(pre) {
  margin: 0;
}

.markdown-body :deep(h1),
.markdown-body :deep(h2),
.markdown-body :deep(h3) {
  line-height: 1.15;
  letter-spacing: -0.04em;
  color: var(--text-strong);
}

.markdown-body :deep(h1) {
  font-size: clamp(1.7rem, 3vw, 2.4rem);
}

.markdown-body :deep(h2) {
  font-size: clamp(1.4rem, 2.4vw, 1.8rem);
}

.markdown-body :deep(h3) {
  font-size: clamp(1.15rem, 2vw, 1.4rem);
}

.markdown-body :deep(p) {
  color: var(--text);
}

.markdown-body :deep(ul),
.markdown-body :deep(ol) {
  padding-left: 1.4rem;
}

.markdown-body :deep(li + li) {
  margin-top: 0.35rem;
}

.markdown-body :deep(a) {
  color: var(--accent-strong);
  text-decoration-thickness: 1px;
  text-underline-offset: 0.18em;
}

.markdown-body :deep(blockquote) {
  padding: 0.1rem 0 0.1rem 1rem;
  border-left: 3px solid color-mix(in srgb, var(--accent) 50%, var(--border));
  color: var(--muted);
}

.markdown-body :deep(code) {
  padding: 0.15rem 0.35rem;
  border-radius: 0.4rem;
  background: color-mix(in srgb, var(--panel-muted) 88%, transparent);
  color: var(--accent-strong);
  font-family: var(--mono-font);
  font-size: 0.94em;
}

.markdown-body :deep(pre) {
  overflow: auto;
  padding: 1rem 1.1rem;
  border-radius: 18px;
  border: 1px solid var(--border);
  background: color-mix(in srgb, var(--panel-muted) 72%, transparent);
}

.markdown-body :deep(pre code) {
  padding: 0;
  background: transparent;
  color: var(--text);
  font-size: 0.92rem;
  line-height: 1.6;
}

.markdown-body :deep(table) {
  width: 100%;
  border-collapse: collapse;
  overflow: hidden;
  border: 1px solid var(--border);
  border-radius: 16px;
}

.markdown-body :deep(th),
.markdown-body :deep(td) {
  padding: 0.8rem 0.9rem;
  border-bottom: 1px solid var(--border);
  border-right: 1px solid var(--border);
  text-align: left;
  vertical-align: top;
}

.markdown-body :deep(th) {
  background: color-mix(in srgb, var(--panel-muted) 90%, transparent);
  color: var(--text-strong);
  font-weight: 600;
}

.markdown-body :deep(tr:last-child td) {
  border-bottom: 0;
}

.markdown-body :deep(th:last-child),
.markdown-body :deep(td:last-child) {
  border-right: 0;
}

.markdown-body :deep(hr) {
  border: 0;
  border-top: 1px solid var(--border);
}
</style>
