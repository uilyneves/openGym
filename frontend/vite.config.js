import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const backend = process.env.API_TARGET || 'http://127.0.0.1:3000'
const media = process.env.MEDIA_TARGET || 'http://127.0.0.1:8888'

const proxy = {
  '/api': { target: backend, changeOrigin: true },
  '/img': { target: media, changeOrigin: true },
  '/gif': { target: media, changeOrigin: true }
}

export default defineConfig({
  plugins: [react()],
  base: './',
  server: { proxy },
  preview: { proxy },
  build: { chunkSizeWarningLimit: 1500 }
})
