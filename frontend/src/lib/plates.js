// Plate calculator logic: calculates plates needed on each side of a barbell.

export const DEFAULT_PLATES = {
  kg: [25, 20, 15, 10, 5, 2.5, 1.25],
  lb: [45, 35, 25, 10, 5, 2.5],
}

export const BAR_WEIGHTS = {
  kg: [
    { label: 'Olympic (20 kg)', w: 20 },
    { label: 'Technique (15 kg)', w: 15 },
    { label: 'EZ Curl (10 kg)', w: 10 },
    { label: 'None / Smith (0 kg)', w: 0 },
  ],
  lb: [
    { label: 'Olympic (45 lb)', w: 45 },
    { label: 'Technique (35 lb)', w: 35 },
    { label: 'EZ Curl (25 lb)', w: 25 },
    { label: 'None / Smith (0 lb)', w: 0 },
  ],
}

export const PLATE_COLORS = {
  // kg
  25: { bg: '#e11d48', text: '#ffffff', border: '#be123c' },
  20: { bg: '#2563eb', text: '#ffffff', border: '#1d4ed8' },
  15: { bg: '#eab308', text: '#000000', border: '#ca8a04' },
  10: { bg: '#16a34a', text: '#ffffff', border: '#15803d' },
  5: { bg: '#94a3b8', text: '#0f172a', border: '#64748b' },
  2.5: { bg: '#475569', text: '#ffffff', border: '#334155' },
  1.25: { bg: '#cbd5e1', text: '#0f172a', border: '#94a3b8' },
  0.5: { bg: '#64748b', text: '#ffffff', border: '#475569' },
  // lb
  45: { bg: '#2563eb', text: '#ffffff', border: '#1d4ed8' },
  35: { bg: '#eab308', text: '#000000', border: '#ca8a04' },
  // 25 lb is green
  // 10 lb is black/dark
  // 5 lb is white/grey
  // 2.5 lb is silver
}

export function plateStyle(p) {
  if (PLATE_COLORS[p]) return PLATE_COLORS[p]
  if (p >= 25) return { bg: '#e11d48', text: '#ffffff', border: '#be123c' }
  if (p >= 20) return { bg: '#2563eb', text: '#ffffff', border: '#1d4ed8' }
  if (p >= 15) return { bg: '#eab308', text: '#000000', border: '#ca8a04' }
  if (p >= 10) return { bg: '#16a34a', text: '#ffffff', border: '#15803d' }
  if (p >= 5) return { bg: '#94a3b8', text: '#0f172a', border: '#64748b' }
  return { bg: '#475569', text: '#ffffff', border: '#334155' }
}

export function calcPlates(targetWeight, barWeight, availablePlates) {
  const target = Number(targetWeight) || 0
  const bar = Number(barWeight) || 0
  const sorted = [...(availablePlates || [])].filter(p => p > 0).sort((a, b) => b - a)

  if (target <= bar) {
    return {
      perSide: [],
      totalOnBar: bar,
      remaining: 0,
      weightPerSide: 0,
      exact: target === bar,
    }
  }

  const weightPerSide = Math.round(((target - bar) / 2) * 100) / 100
  let rem = weightPerSide
  const perSide = []

  for (const plate of sorted) {
    if (plate <= 0) continue
    const count = Math.floor((rem + 0.0001) / plate)
    if (count > 0) {
      perSide.push({ plate, count })
      rem = Math.round((rem - count * plate) * 1000) / 1000
    }
  }

  const platesTotal = perSide.reduce((sum, item) => sum + item.plate * item.count * 2, 0)
  const totalOnBar = Math.round((bar + platesTotal) * 100) / 100
  const remaining = Math.round(rem * 2 * 100) / 100

  return {
    perSide,
    totalOnBar,
    remaining,
    weightPerSide,
    exact: remaining === 0,
  }
}
