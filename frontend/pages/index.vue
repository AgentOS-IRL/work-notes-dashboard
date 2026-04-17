<template>
  <main class="screen">
    <section class="card">
      <p class="eyebrow">Work Notes Dashboard</p>
      <h1>Frontend is ready.</h1>
      <p class="subtitle">
        This Nuxt screen is generated into a static build directory and served by the backend.
      </p>
      <div class="status">
        <span class="dot" />
        <span>Backend serves the frontend dist and falls back to index.html.</span>
      </div>
    </section>
  </main>
</template>

<style scoped>
.screen {
  min-height: 100vh;
  display: grid;
  place-items: center;
  padding: 24px;
}

.card {
  width: min(100%, 720px);
  padding: 40px;
  border: 1px solid rgba(16, 32, 58, 0.08);
  border-radius: 28px;
  background: rgba(255, 255, 255, 0.78);
  box-shadow: 0 24px 80px rgba(38, 56, 112, 0.14);
  backdrop-filter: blur(16px);
}

.eyebrow {
  margin: 0 0 12px;
  font-size: 0.78rem;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: #5a6b8a;
}

h1 {
  margin: 0;
  font-size: clamp(2.5rem, 6vw, 4.5rem);
  line-height: 0.95;
}

.subtitle {
  max-width: 56ch;
  margin: 18px 0 0;
  font-size: 1.05rem;
  line-height: 1.7;
  color: #44546f;
}

.status {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 24px;
  padding: 14px 16px;
  border-radius: 16px;
  background: rgba(80, 109, 255, 0.08);
  color: #22304e;
}

.dot {
  width: 10px;
  height: 10px;
  border-radius: 999px;
  background: #506dff;
  box-shadow: 0 0 0 6px rgba(80, 109, 255, 0.15);
  flex: 0 0 auto;
}
</style>
