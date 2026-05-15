import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import electron from 'vite-plugin-electron/simple'
import svgLoader from 'vite-svg-loader'
import iconsPlugin from './scripts/vite-plugin-icons'
import { resolve } from 'path'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
  plugins: [
    vue(),
    svgLoader(),
    iconsPlugin(),
    tailwindcss(),
    electron({
      main: {
        entry: 'electron/main.js',
        vite: {
          define: {
            'process.env.OPEN_DEVTOOLS': JSON.stringify(env.OPEN_DEVTOOLS ?? 'true'),
          },
          build: {
            outDir: 'dist-electron',
            rollupOptions: { external: ['electron'] },
          },
        },
      },
      preload: {
        input: 'electron/preload.js',
        vite: {
          build: {
            outDir: 'dist-electron',
            rollupOptions: { external: ['electron'] },
          },
        },
      },
    }),
  ],
  resolve: {
    alias: { '@': resolve(__dirname, 'src') },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  }
})
