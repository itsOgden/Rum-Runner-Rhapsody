// https://nuxt.com/docs/api/configuration/nuxt-config

// Tauri Icons
// https://tauri.app/v1/guides/features/icons/

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
  vite: {
    // Better support for Tauri CLI output
    clearScreen: false,
    // Enable environment variables
    // Additional environment variables can be found at
    // https://tauri.app/2/reference/environment-variables/
    envPrefix: ['VITE_', 'TAURI_'],
    server: {
      // Tauri requires a consistent port
      strictPort: true,
      hmr: {
        // Use websocket for mobile hot reloading
        protocol: 'ws',
        // Make sure it's available on the network
        host: '0.0.0.0',
        // Use a specific port for hmr
        port: 5183,
      },
    },
  },
})
