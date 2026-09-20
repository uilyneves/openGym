import { describe, it, expect } from 'vitest'
import { calcPlates, DEFAULT_PLATES } from './plates.js'

describe('calcPlates', () => {
  it('handles target equal to bar weight', () => {
    const res = calcPlates(20, 20, DEFAULT_PLATES.kg)
    expect(res.perSide).toEqual([])
    expect(res.totalOnBar).toBe(20)
    expect(res.remaining).toBe(0)
    expect(res.exact).toBe(true)
  })

  it('calculates 60kg correctly with 20kg bar', () => {
    // 60kg - 20kg = 40kg total plates -> 20kg per side (1 x 20kg)
    const res = calcPlates(60, 20, DEFAULT_PLATES.kg)
    expect(res.perSide).toEqual([{ plate: 20, count: 1 }])
    expect(res.totalOnBar).toBe(60)
    expect(res.remaining).toBe(0)
    expect(res.exact).toBe(true)
  })

  it('calculates 100kg with 20kg bar and standard plates', () => {
    // 100kg - 20kg = 80kg -> 40kg per side (1x25kg + 1x15kg)
    const res = calcPlates(100, 20, DEFAULT_PLATES.kg)
    expect(res.perSide).toEqual([
      { plate: 25, count: 1 },
      { plate: 15, count: 1 }
    ])
    expect(res.totalOnBar).toBe(100)
    expect(res.remaining).toBe(0)
  })

  it('calculates 135lb with 45lb bar (1 plate on each side)', () => {
    const res = calcPlates(135, 45, DEFAULT_PLATES.lb)
    expect(res.perSide).toEqual([{ plate: 45, count: 1 }])
    expect(res.totalOnBar).toBe(135)
    expect(res.exact).toBe(true)
  })

  it('reports remaining unmatchable weight when not exact', () => {
    // 61kg with plates down to 2.5kg only
    const res = calcPlates(61, 20, [20, 10, 5, 2.5])
    expect(res.exact).toBe(false)
    expect(res.totalOnBar).toBe(60)
    expect(res.remaining).toBe(1)
  })
})
