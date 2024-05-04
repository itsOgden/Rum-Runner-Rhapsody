// https://nuxt.com/docs/api/configuration/nuxt-config

// eslint-disable-next-line node/prefer-global/process
const review = !!process.env.REVIEW

if (review)
  console.log('-- GENERATING REVIEW BUILD --')

export default defineNuxtConfig({
  devtools: { enabled: true },
  ssr: true,
  nitro: {
    // https://nitro.unjs.io/config#output
    output: {
      dir: review ? '.review' : '.output',
      publicDir: review ? '.review/public' : '.output/public',
    },
  },
  css: ['vue-final-modal/style.css', '~/assets/css/main.scss'],
  postcss: {
    plugins: {
      tailwindcss: {},
      autoprefixer: {},
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
    'nuxt-svgo',
    'nuxt-seo-experiments',
    '@pinia/nuxt',
    '@pinia-plugin-persistedstate/nuxt',
  ],
  site: {
    // production URL
    url: 'https://pdog1.com',
    trailingSlash: true,
  },
  svgo: {
    global: false,
  },
})
