export default defineNuxtConfig({
  ssr: false,
  typescript: {
    strict: true
  },
  app: {
    head: {
      title: 'Work Notes Dashboard',
      meta: [
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        { name: 'description', content: 'A Nuxt notes UI backed by an Express and SQLite API.' }
      ]
    }
  }
});
