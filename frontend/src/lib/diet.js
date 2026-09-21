// Pure helpers and domain logic for Diet, Nutrition, and Hydration tracking
import { todayISO } from './format.js'

export const DEFAULT_TARGETS = {
  calorieTarget: 2200,
  waterTarget: 2500, // in ml
  proteinTarget: 140, // in g
  carbsTarget: 250,   // in g
  fatTarget: 65,      // in g
}

export const MEAL_TYPES = [
  { id: 'breakfast', label: 'Breakfast', icon: 'sun' },
  { id: 'lunch', label: 'Lunch', icon: 'utensils' },
  { id: 'snack', label: 'Snack', icon: 'apple' },
  { id: 'dinner', label: 'Dinner', icon: 'moon' },
  { id: 'preworkout', label: 'Workout Nutrition', icon: 'flame' },
]

export const COMMON_FOODS = [
  { id: 'chicken', name: 'Peito de frango grelhado', serving: '100g', unit: 'g', servingSize: 100, calories: 165, protein: 31, carbs: 0, fat: 3.6 },
  { id: 'egg', name: 'Ovo cozido inteiro', serving: '1 unid (50g)', unit: 'unid', servingSize: 1, calories: 74, protein: 6.3, carbs: 0.4, fat: 5 },
  { id: 'eggwhite', name: 'Clara de ovo', serving: '100g (~3 claras)', unit: 'g', servingSize: 100, calories: 52, protein: 11, carbs: 0.7, fat: 0.2 },
  { id: 'rice', name: 'Arroz branco cozido', serving: '100g', unit: 'g', servingSize: 100, calories: 130, protein: 2.7, carbs: 28, fat: 0.3 },
  { id: 'beans', name: 'Feijão carioca/preto cozido', serving: '100g', unit: 'g', servingSize: 100, calories: 76, protein: 4.8, carbs: 14, fat: 0.5 },
  { id: 'groundbeef', name: 'Carne bovina moída magra (Patinho)', serving: '100g', unit: 'g', servingSize: 100, calories: 170, protein: 26, carbs: 0, fat: 7 },
  { id: 'whey', name: 'Whey Protein (1 scoop)', serving: '30g', unit: 'scoop', servingSize: 1, calories: 120, protein: 24, carbs: 3, fat: 1.5 },
  { id: 'oats', name: 'Aveia em flocos', serving: '40g', unit: 'g', servingSize: 40, calories: 153, protein: 5.5, carbs: 26, fat: 3 },
  { id: 'banana', name: 'Banana prata/nanica', serving: '1 unid média (100g)', unit: 'unid', servingSize: 1, calories: 89, protein: 1.1, carbs: 23, fat: 0.3 },
  { id: 'peanutbutter', name: 'Pasta de amendoim integral', serving: '1 colher (20g)', unit: 'g', servingSize: 20, calories: 118, protein: 5, carbs: 4, fat: 10 },
  { id: 'yogurt', name: 'Iogurte natural desnatado / Grego', serving: '1 pote (150g)', unit: 'g', servingSize: 150, calories: 85, protein: 15, carbs: 6, fat: 0 },
  { id: 'sweetpotato', name: 'Batata doce cozida', serving: '100g', unit: 'g', servingSize: 100, calories: 86, protein: 1.6, carbs: 20, fat: 0.1 },
  { id: 'bread', name: 'Pão 100% integral', serving: '1 fatia (25g)', unit: 'fatia', servingSize: 1, calories: 65, protein: 2.5, carbs: 12, fat: 0.8 },
  { id: 'oliveoil', name: 'Azeite de oliva extravirgem', serving: '1 colher sopa (13ml)', unit: 'colher', servingSize: 1, calories: 119, protein: 0, carbs: 0, fat: 13.5 },
  { id: 'tuna', name: 'Atum sólido em água', serving: '100g', unit: 'g', servingSize: 100, calories: 116, protein: 26, carbs: 0, fat: 1 },
  { id: 'apple', name: 'Maçã', serving: '1 unid média (120g)', unit: 'unid', servingSize: 1, calories: 62, protein: 0.3, carbs: 16, fat: 0.2 },
  { id: 'cottage', name: 'Queijo cottage', serving: '100g', unit: 'g', servingSize: 100, calories: 98, protein: 11, carbs: 3.4, fat: 4.3 },
]

export function getDiet(S) {
  const d = S?.diet || {}
  return {
    calorieTarget: Number(d.calorieTarget) || DEFAULT_TARGETS.calorieTarget,
    waterTarget: Number(d.waterTarget) || DEFAULT_TARGETS.waterTarget,
    proteinTarget: Number(d.proteinTarget) || DEFAULT_TARGETS.proteinTarget,
    carbsTarget: Number(d.carbsTarget) || DEFAULT_TARGETS.carbsTarget,
    fatTarget: Number(d.fatTarget) || DEFAULT_TARGETS.fatTarget,
    logs: d.logs || {},
    quickFoods: d.quickFoods || [],
  }
}

export function getDayLog(S, iso = todayISO()) {
  const diet = getDiet(S)
  const log = diet.logs[iso] || { water: 0, meals: [] }
  return {
    water: Number(log.water) || 0,
    meals: Array.isArray(log.meals) ? log.meals : [],
  }
}

export function calcDayTotals(meals = []) {
  return meals.reduce(
    (acc, m) => {
      acc.calories += Math.round(Number(m.calories) || 0)
      acc.protein += Math.round(Number(m.protein) || 0)
      acc.carbs += Math.round(Number(m.carbs) || 0)
      acc.fat += Math.round(Number(m.fat) || 0)
      return acc
    },
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  )
}

export function calcSmartTargets(weightKg = 70, goal = 'maintain') {
  const w = Math.max(40, Math.min(200, Number(weightKg) || 70))
  // Water: ~35ml/kg
  const waterTarget = Math.round((w * 35) / 50) * 50

  // Estimated maintenance calories: ~32 kcal / kg
  const baseCal = Math.round(w * 32)
  let calorieTarget = baseCal
  let proteinMultiplier = 2.0

  if (goal === 'cut') {
    calorieTarget = Math.round(baseCal * 0.8) // -20% deficit
    proteinMultiplier = 2.2 // higher protein to preserve muscle
  } else if (goal === 'bulk') {
    calorieTarget = Math.round(baseCal * 1.12) // +12% clean surplus
    proteinMultiplier = 2.0
  }

  const proteinTarget = Math.round(w * proteinMultiplier)
  const fatTarget = Math.round(w * 0.9)
  // Remainder in carbs: (Calories - (Protein * 4 + Fat * 9)) / 4
  const carbCal = Math.max(0, calorieTarget - (proteinTarget * 4 + fatTarget * 9))
  const carbsTarget = Math.round(carbCal / 4)

  return {
    calorieTarget,
    waterTarget,
    proteinTarget,
    carbsTarget,
    fatTarget,
  }
}

export function mutateDayLog(s, iso, fn) {
  if (!s.diet) s.diet = { ...DEFAULT_TARGETS, logs: {}, quickFoods: [] }
  if (!s.diet.logs) s.diet.logs = {}
  if (!s.diet.logs[iso]) s.diet.logs[iso] = { water: 0, meals: [] }
  fn(s.diet.logs[iso])
}

export function addWater(update, deltaMl, iso = todayISO()) {
  update(s => {
    mutateDayLog(s, iso, log => {
      log.water = Math.max(0, (log.water || 0) + deltaMl)
    })
  })
}

export function setWater(update, totalMl, iso = todayISO()) {
  update(s => {
    mutateDayLog(s, iso, log => {
      log.water = Math.max(0, totalMl)
    })
  })
}

export function addMeal(update, meal, iso = todayISO()) {
  const newMeal = {
    id: 'm_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
    time: meal.time || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    name: (meal.name || '').trim() || 'Alimento',
    type: meal.type || 'lunch',
    calories: Math.round(Number(meal.calories) || 0),
    protein: Math.round(Number(meal.protein) || 0),
    carbs: Math.round(Number(meal.carbs) || 0),
    fat: Math.round(Number(meal.fat) || 0),
    portion: meal.portion || '',
    notes: (meal.notes || '').trim(),
  }

  update(s => {
    mutateDayLog(s, iso, log => {
      log.meals = [...(log.meals || []), newMeal]
    })
  })
  return newMeal
}

export function updateMeal(update, mealId, patch, iso = todayISO()) {
  update(s => {
    mutateDayLog(s, iso, log => {
      log.meals = (log.meals || []).map(m => {
        if (m.id !== mealId) return m
        return {
          ...m,
          ...patch,
          calories: Math.round(Number(patch.calories ?? m.calories) || 0),
          protein: Math.round(Number(patch.protein ?? m.protein) || 0),
          carbs: Math.round(Number(patch.carbs ?? m.carbs) || 0),
          fat: Math.round(Number(patch.fat ?? m.fat) || 0),
        }
      })
    })
  })
}

export function deleteMeal(update, mealId, iso = todayISO()) {
  update(s => {
    mutateDayLog(s, iso, log => {
      log.meals = (log.meals || []).filter(m => m.id !== mealId)
    })
  })
}

export function saveDietTargets(update, targets) {
  update(s => {
    if (!s.diet) s.diet = { ...DEFAULT_TARGETS, logs: {}, quickFoods: [] }
    if (targets.calorieTarget !== undefined) s.diet.calorieTarget = Math.round(targets.calorieTarget)
    if (targets.waterTarget !== undefined) s.diet.waterTarget = Math.round(targets.waterTarget)
    if (targets.proteinTarget !== undefined) s.diet.proteinTarget = Math.round(targets.proteinTarget)
    if (targets.carbsTarget !== undefined) s.diet.carbsTarget = Math.round(targets.carbsTarget)
    if (targets.fatTarget !== undefined) s.diet.fatTarget = Math.round(targets.fatTarget)
  })
}
