import { describe, it, expect } from 'vitest'
import {
  calcDayTotals,
  calcSmartTargets,
  getDiet,
  getDayLog,
  COMMON_FOODS
} from './diet.js'

describe('diet domain logic', () => {
  it('calculates totals correctly from meals', () => {
    const meals = [
      { calories: 350, protein: 35, carbs: 40, fat: 5 },
      { calories: 500, protein: 40, carbs: 60, fat: 10 },
    ]
    const totals = calcDayTotals(meals)
    expect(totals.calories).toBe(850)
    expect(totals.protein).toBe(75)
    expect(totals.carbs).toBe(100)
    expect(totals.fat).toBe(15)
  })

  it('calculates smart targets for cut, bulk and maintain', () => {
    const maintain = calcSmartTargets(80, 'maintain')
    expect(maintain.waterTarget).toBe(2800)
    expect(maintain.proteinTarget).toBe(160)
    expect(maintain.calorieTarget).toBeGreaterThan(2000)

    const cut = calcSmartTargets(80, 'cut')
    expect(cut.calorieTarget).toBeLessThan(maintain.calorieTarget)
    expect(cut.proteinTarget).toBeGreaterThanOrEqual(maintain.proteinTarget)

    const bulk = calcSmartTargets(80, 'bulk')
    expect(bulk.calorieTarget).toBeGreaterThan(maintain.calorieTarget)
  })

  it('provides safe fallbacks when state is empty', () => {
    const emptyState = {}
    const diet = getDiet(emptyState)
    expect(diet.calorieTarget).toBe(2200)
    expect(diet.waterTarget).toBe(2500)

    const log = getDayLog(emptyState, '2026-09-20')
    expect(log.water).toBe(0)
    expect(log.meals).toEqual([])
  })

  it('contains common bodybuilding staple foods with positive macros', () => {
    expect(COMMON_FOODS.length).toBeGreaterThan(10)
    COMMON_FOODS.forEach(f => {
      expect(f.name).toBeTruthy()
      expect(f.calories).toBeGreaterThan(0)
      expect(f.protein).toBeGreaterThanOrEqual(0)
    })
  })
})
