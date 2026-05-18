import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// For local development (npm run dev), the proxy target must reach your backend.
// Default: http://localhost:8000  (running backend directly on your machine)
// In Docker: override with VITE_API_TARGET=http://backend:8000
const API_TARGET = process.env.VITE_API_TARGET || 'http://localhost:8000'

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    proxy: {
      '/api': { target: API_TARGET, changeOrigin: true },
      '/health': { target: API_TARGET, changeOrigin: true },
    }
  }
})
