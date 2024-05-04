// https://nuxt.com/docs/api/configuration/nuxt-config

export default defineNuxtConfig({
  devtools: { enabled: true },
  ssr: false,
  css: ['vue-final-modal/style.css', '~/assets/css/main.scss'],
  postcss: {
    plugins: {
      tailwindcss: {},
    },
  },
  components: {
    global: true,
    dirs: [{
      path: '~/components',
      pathPrefix: true,
    }],
  },
  modules: [
    '@pinia/nuxt',
    '@pinia-plugin-persistedstate/nuxt',
  ],
})
