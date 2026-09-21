import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { spawn } from 'node:child_process'
import net from 'node:net'

const backend = process.env.API_TARGET || 'http://127.0.0.1:3000'
const media = process.env.MEDIA_TARGET || 'http://127.0.0.1:8888'

function waitForApi(host, port, attempts = 100) {
  return new Promise((resolve, reject) => {
    let remaining = attempts
    const check = () => {
      const socket = net.createConnection({ host, port })
      socket.once('connect', () => {
        socket.destroy()
        resolve()
      })
      socket.once('error', () => {
        socket.destroy()
        remaining -= 1
        if (remaining <= 0) reject(new Error(`API did not become ready at ${host}:${port}`))
        else setTimeout(check, 100)
      })
    }
    check()
  })
}

function localApi() {
  let api
  const startApi = () => {
    if (process.env.API_TARGET || api) return
    api = spawn(process.execPath, ['server.js'], {
      cwd: new URL('../api/', import.meta.url),
      stdio: 'inherit'
    })
  }
  const waitForLocalApi = async (req, res, next) => {
    if (!req.url?.startsWith('/api')) return next()
    try {
      await waitForApi('127.0.0.1', 3000)
      next()
    } catch (error) {
      next(error)
    }
  }
  const stopApi = () => {
    if (api && !api.killed) api.kill()
  }
  return {
    name: 'local-api',
    enforce: 'pre',
    configureServer(server) {
      startApi()
      server.middlewares.use(waitForLocalApi)
      server.httpServer?.once('close', stopApi)
      process.once('exit', stopApi)
    },
    configurePreviewServer(server) {
      startApi()
      server.middlewares.use(waitForLocalApi)
      server.httpServer?.once('close', stopApi)
      process.once('exit', stopApi)
    }
  }
}

const proxy = {
  '/api': { target: backend, changeOrigin: true },
  '/img': { target: media, changeOrigin: true },
  '/gif': { target: media, changeOrigin: true }
}

export default defineConfig({
  plugins: [react(), localApi()],
  base: './',
  server: { proxy },
  preview: { proxy },
  build: { chunkSizeWarningLimit: 1500 }
})
