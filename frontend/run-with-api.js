import { spawn } from 'node:child_process'
import net from 'node:net'

const preview = process.argv[2] === '--vite-preview'
const viteArgs = process.argv.slice(preview ? 3 : 2)
let api
let vite
let stopping = false

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

function stop(code = 0) {
  if (stopping) return
  stopping = true
  if (vite && !vite.killed) vite.kill('SIGTERM')
  if (api && !api.killed) api.kill('SIGTERM')
  process.exitCode = code
}

api = spawn(process.execPath, ['server.js'], {
  cwd: new URL('../api/', import.meta.url),
  stdio: 'inherit'
})
api.once('error', () => stop(1))
api.once('exit', code => {
  if (!stopping && code !== 0) stop(code || 1)
})

try {
  await waitForApi('127.0.0.1', 3000)
  const args = ['node_modules/vite/bin/vite.js']
  if (preview) args.push('preview')
  args.push(...viteArgs)
  vite = spawn(process.execPath, args, { stdio: 'inherit' })
  vite.once('error', () => stop(1))
  vite.once('exit', code => stop(code || 0))
} catch (error) {
  console.error(error.message)
  stop(1)
}

process.once('SIGINT', () => stop(0))
process.once('SIGTERM', () => stop(0))
