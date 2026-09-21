import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { spawn } from 'node:child_process'

const backend = process.env.API_TARGET || 'http://127.0.0.1:3000'
const media = process.env.MEDIA_TARGET || 'http://127.0.0.1:8888'

function localApi() {
  let api
  return {
    name: 'local-api',
    configureServer(server) {
      if (process.env.API_TARGET) return
      api = spawn(process.execPath, ['server.js'], {
        cwd: new URL('../api/', import.meta.url),
        stdio: 'inherit'
      })
      const stop = () => {
        if (api && !api.killed) api.kill()
      }
      server.httpServer?.once('close', stop)
      process.once('exit', stop)
    }
  }
}

export default defineConfig({
  plugins: [react(), localApi()],
  base: './',
  server: {
    proxy: {
      '/api': { target: backend, changeOrigin: true },
      '/img': { target: media, changeOrigin: true },
      '/gif': { target: media, changeOrigin: true }
    }
  },
  build: { chunkSizeWarningLimit: 1500 }
})
