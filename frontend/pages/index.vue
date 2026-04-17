<script setup lang="ts">
import ChatPanel from '~/components/chat/ChatPanel.vue';
import NotesPanel from '~/components/notes/NotesPanel.vue';
</script>

<template>
  <main class="screen">
    <div class="backdrop" aria-hidden="true" />
    <section class="shell">
      <header class="hero">
        <div class="hero-copy">
          <p class="eyebrow">Work Notes Dashboard</p>
          <h1>Split the conversation from the record.</h1>
          <p class="subtitle">
            Keep chat on the left as a local workspace and manage notes on the right through the
            existing API.
          </p>
        </div>
        <div class="hero-badges" aria-label="Workspace summary">
          <span>Chat: local only</span>
          <span>Notes: backed by /api/notes</span>
        </div>
      </header>

      <div class="dashboard">
        <ChatPanel />
        <NotesPanel />
      </div>
    </section>
  </main>
</template>

<style scoped>
.screen {
  position: relative;
  min-height: 100vh;
  padding: 28px;
  overflow: hidden;
}

.backdrop {
  position: absolute;
  inset: 0;
  background:
    radial-gradient(circle at 10% 10%, rgba(255, 177, 101, 0.2), transparent 32%),
    radial-gradient(circle at 90% 16%, rgba(83, 114, 255, 0.22), transparent 28%),
    radial-gradient(circle at 50% 100%, rgba(18, 28, 52, 0.08), transparent 24%),
    linear-gradient(180deg, var(--page-bg) 0%, var(--page-bg-alt) 100%);
}

.shell {
  position: relative;
  z-index: 1;
  width: min(1440px, 100%);
  margin: 0 auto;
  display: grid;
  gap: 22px;
}

.hero {
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: 20px;
  padding: 4px 4px 0;
}

.hero-copy {
  display: grid;
  gap: 12px;
}

.eyebrow {
  margin: 0;
  color: var(--muted-strong);
  font-size: 0.78rem;
  letter-spacing: 0.18em;
  text-transform: uppercase;
}

h1 {
  margin: 0;
  max-width: 12ch;
  font-size: clamp(2.6rem, 5vw, 5rem);
  line-height: 0.95;
  letter-spacing: -0.06em;
}

.subtitle {
  margin: 0;
  max-width: 60ch;
  color: var(--muted);
  font-size: 1.02rem;
  line-height: 1.7;
}

.hero-badges {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 10px;
}

.hero-badges span {
  padding: 10px 14px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--surface-strong) 80%, transparent);
  border: 1px solid var(--border);
  color: var(--text-strong);
  box-shadow: 0 12px 28px rgba(15, 23, 42, 0.08);
}

.dashboard {
  display: grid;
  grid-template-columns: minmax(0, 0.92fr) minmax(0, 1.08fr);
  gap: 20px;
  align-items: start;
}

@media (max-width: 1200px) {
  .dashboard {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 960px) {
  .screen {
    padding: 18px;
  }

  .hero {
    display: grid;
    align-items: start;
  }

  .hero-badges {
    justify-content: flex-start;
  }
}
</style>
