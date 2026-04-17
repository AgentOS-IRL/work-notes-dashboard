<template>
  <NuxtPage />
</template>

<style>
:root {
  color-scheme: light;
  font-family:
    'Avenir Next', 'Segoe UI Variable', 'Segoe UI', ui-sans-serif, sans-serif;
  --page-bg: #eef2ff;
  --page-bg-alt: #f7f4ef;
  --surface: rgba(255, 255, 255, 0.7);
  --surface-strong: rgba(255, 255, 255, 0.92);
  --border: rgba(15, 23, 42, 0.1);
  --text: #0f172a;
  --text-strong: #09111f;
  --muted: #526077;
  --muted-strong: #67748b;
  --accent: #5b74ff;
  --accent-strong: #1f3fb7;
  --danger: #b42318;
  --success: #166534;
  --shadow: 0 24px 80px rgba(15, 23, 42, 0.12);
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
  background: color-mix(in srgb, var(--accent) 24%, white);
  color: var(--text);
}

a {
  color: inherit;
}
</style>
