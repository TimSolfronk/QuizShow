import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// For development, the Vite dev server proxies /api requests
// to the FastAPI backend running on port 8000.
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': 'http://127.0.0.1:8000',
    },
  },
})
