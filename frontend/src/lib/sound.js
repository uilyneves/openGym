// WebAudio beeps + haptics (optimized for clear workout cues).
let audioCtx = null

export function getAudioContext() {
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)()
    if (audioCtx.state === 'suspended') {
      audioCtx.resume().catch(() => {})
    }
    return audioCtx
  } catch (e) {
    return null
  }
}

export function beep(enabled, freq, dur, when, type = 'sine', gain = 0.35) {
  if (!enabled) return
  try {
    const ctx = getAudioContext()
    if (!ctx) return
    const o = ctx.createOscillator(), g = ctx.createGain()
    o.connect(g); g.connect(ctx.destination)
    o.frequency.value = freq || 880; o.type = type
    const t0 = ctx.currentTime + (when || 0)
    g.gain.setValueAtTime(0.001, t0)
    g.gain.exponentialRampToValueAtTime(gain, t0 + 0.02)
    g.gain.exponentialRampToValueAtTime(0.001, t0 + (dur || 0.18))
    o.start(t0); o.stop(t0 + (dur || 0.18) + 0.05)
  } catch (e) { /* */ }
}

export function beepRestDone(enabled) {
  if (!enabled) return
  // 3-tone ascending chime
  beep(enabled, 880, 0.14, 0, 'sine', 0.4)
  beep(enabled, 1100, 0.14, 0.16, 'sine', 0.4)
  beep(enabled, 1320, 0.35, 0.32, 'triangle', 0.45)
}

export function beepTick(enabled) {
  if (!enabled) return
  beep(enabled, 660, 0.08, 0, 'sine', 0.25)
}

export function beepWorkDone(enabled) {
  if (!enabled) return
  beep(enabled, 880, 0.15, 0, 'sine', 0.4)
  beep(enabled, 880, 0.15, 0.22, 'sine', 0.4)
  beep(enabled, 1320, 0.4, 0.45, 'triangle', 0.45)
}

export function vibrate(p) { try { navigator.vibrate && navigator.vibrate(p) } catch (e) { /* */ } }
