import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    exclude: ['legacy_v1']
  },
  server: {
    watch: {
      ignored: ['**/legacy_v1/**']
    }
  },
  build: {
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      external: [/\/legacy_v1\//]
    }
  }
})
