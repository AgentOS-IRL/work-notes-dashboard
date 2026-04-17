function normalizeAppBaseURL(basePath: string | undefined) {
  const trimmed = (basePath ?? '').trim();

  if (trimmed === '' || trimmed === '/') {
    return '/';
  }

  return `/${trimmed.replace(/^\/+/, '').replace(/\/+$/, '')}/`;
}

export default defineNuxtConfig({
  ssr: false,
  typescript: {
    strict: true
  },
  app: {
    baseURL: normalizeAppBaseURL(
      process.env.NUXT_APP_BASE_URL ?? process.env.FRONTEND_BASE_PATH
    ),
    head: {
      title: 'Work Notes Dashboard',
      meta: [
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        { name: 'description', content: 'A simple Nuxt landing screen served by Express.' }
      ]
    }
  }
});
