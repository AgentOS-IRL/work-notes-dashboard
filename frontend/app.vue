<template>
  <NuxtPage />
</template>

<style>
:root {
  color-scheme: dark;
  font-family:
    'IBM Plex Sans', 'Inter', 'Segoe UI Variable', 'Segoe UI', ui-sans-serif, system-ui, sans-serif;
  --page-bg: #0a0f19;
  --page-bg-alt: #11182a;
  --surface: rgba(13, 19, 31, 0.72);
  --panel-muted: #131b2b;
  --panel-elevated: #182033;
  --border: rgba(148, 163, 184, 0.18);
  --text: #d7deea;
  --text-strong: #f4f7fb;
  --muted: #8e9ab0;
  --muted-strong: #aeb8cb;
  --accent: #62d0ff;
  --accent-strong: #3c8cff;
  --danger: #fda4af;
  --success: #86efac;
  --shadow: 0 28px 90px rgba(0, 0, 0, 0.46);
  --mono-font:
    'SFMono-Regular', 'SF Mono', 'Cascadia Code', 'JetBrains Mono', 'IBM Plex Mono', 'Menlo',
    'Monaco', 'Consolas', monospace;
}

html,
body,
#__nuxt {
  min-height: 100%;
  margin: 0;
}

body {
  margin: 0;
  background: var(--page-bg);
  color: var(--text);
  text-rendering: optimizeLegibility;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

*,
*::before,
*::after {
  box-sizing: border-box;
}

button,
input,
textarea {
  font: inherit;
}

::selection {
  background: color-mix(in srgb, var(--accent) 28%, transparent);
  color: var(--text-strong);
}

a {
  color: inherit;
}

pre,
code,
kbd,
samp {
  font-family: var(--mono-font);
}

code {
  padding: 0.12rem 0.35rem;
  border-radius: 0.4rem;
  background: color-mix(in srgb, var(--panel-muted) 90%, transparent);
  color: var(--accent);
}

pre {
  overflow: auto;
}

table {
  border-collapse: collapse;
}

th,
td {
  border: 1px solid var(--border);
}

::-webkit-scrollbar {
  width: 12px;
  height: 12px;
}

::-webkit-scrollbar-track {
  background: transparent;
}

::-webkit-scrollbar-thumb {
  border: 3px solid transparent;
  border-radius: 999px;
  background: color-mix(in srgb, var(--muted) 55%, transparent);
  background-clip: content-box;
}
</style>
