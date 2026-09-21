// AI plan generators and body-evolution analysis for openGym.
// Pure logic lives here; views only render results and call the appliers.
// Every generator works in two modes:
//   · LIVE  — an OmniRoute key is configured → aiJSON returns a tailored plan;
//   · DEMO  — no key → a sensible local fallback so the feature never dead-ends.
import { EXDB } from './exercises.js'
import { uid, todayISO } from './format.js'
import { workoutVolume } from './history.js'
import { COMMON_FOODS, calcSmartTargets, getDiet } from './diet.js'
import { aiJSON, isAIConnected } from './ai.js'
import { supabase } from '../integrations/supabase/client.js'
import { useStore } from '../store/useStore.js'

/* ============================ athlete profile & context ============================ */

export function getFitnessProfile() {
  try { return JSON.parse(localStorage.getItem('user_fitness_profile') || '{}') } catch { return {} }
}

// The four fields the AI genuinely needs to personalize anything. Returns the
// missing ones so the generator sheets can ask for exactly those inline.
export function profileMissing(p = getFitnessProfile()) {
  const missing = []
  if (!p.weightKg || !(Number(p.weightKg) > 0)) missing.push('weightKg')
  if (!p.heightCm || !(Number(p.heightCm) > 0)) missing.push('heightCm')
  if (!p.age || !(Number(p.age) > 0)) missing.push('age')
  if (!p.fitnessGoal) missing.push('fitnessGoal')
  return missing
}

// Merge partial profile data into the anamnesis (local first, cloud best-effort)
// and log the weight so the AI always works with a fresh bodyweight series.
export async function saveFitnessProfile(patch) {
  const next = { ...getFitnessProfile(), ...patch, updatedAt: new Date().toISOString() }
  localStorage.setItem('user_fitness_profile', JSON.stringify(next))
  if (patch.weightKg && Number(patch.weightKg) > 0) {
    try { useStore.getState().logBW(Number(patch.weightKg), todayISO()) } catch { /* store not ready */ }
  }
  try {
    await supabase.from('profiles').insert([{
      name: next.name || null,
      age: next.age ? Number(next.age) : null,
      gender: next.gender || null,
      height_cm: next.heightCm ? Number(next.heightCm) : null,
      weight_kg: next.weightKg ? Number(next.weightKg) : null,
      fitness_goal: next.fitnessGoal || null,
      updated_at: new Date().toISOString()
    }])
  } catch { /* offline — local copy is enough */ }
  return next
}

// Everything the AI should know about the athlete: anamnesis + live openGym data.
export function buildBodyContext(S) {
  const p = getFitnessProfile()
  const bw = [...(S.bodyweight || [])].sort((a, b) => (a.d < b.d ? -1 : 1))
  const last = bw.length ? bw[bw.length - 1].w : null
  const first = bw.length ? bw[0].w : null
  const days = bw.length > 1 ? Math.max(1, (new Date(bw[bw.length - 1].d) - new Date(bw[0].d)) / 86400000) : 0
  const totalDelta = last != null && first != null ? +(last - first).toFixed(1) : null
  const weeklyRate = totalDelta != null && days >= 7 ? +((totalDelta / days) * 7).toFixed(2) : null

  const since = new Date(); since.setDate(since.getDate() - 28)
  const recent = (S.workouts || []).filter(w => new Date(w.d) >= since)
  const vol = recent.reduce((a, w) => a + workoutVolume(w), 0)

  const diet = getDiet(S)
  const logs7 = Object.entries(diet.logs || {}).sort((a, b) => (a[0] < b[0] ? -1 : 1)).slice(-7)
  let kcalAvg = null, waterAvg = null
  if (logs7.length) {
    const days2 = logs7.filter(([, l]) => (l.meals || []).length)
    if (days2.length) kcalAvg = Math.round(days2.reduce((a, [, l]) => a + (l.meals || []).reduce((x, m) => x + (m.calories || 0), 0), 0) / days2.length)
    waterAvg = Math.round(logs7.reduce((a, [, l]) => a + (l.water || 0), 0) / logs7.length)
  }

  return [
    'PERFIL DO ATLETA (ANAMNESE):',
    `- Nome: ${p.name || 'Atleta'} | Idade: ${p.age || '?'} | Gênero: ${p.gender || '?'}`,
    `- Altura: ${p.heightCm ? p.heightCm + ' cm' : '?'} | Peso atual: ${last ?? p.weightKg ?? '?'} kg | % Gordura: ${p.bodyFat || '?'}`,
    `- Objetivo: ${p.fitnessGoal || 'hipertrofia'} | Experiência: ${p.experience || 'intermediário'} | Disponibilidade: ${p.daysPerWeek || '?'}x/semana`,
    `- Nível de atividade: ${p.activityLevel || 'moderado'} | Lesões: ${p.injuries || 'nenhuma'} | Restrições alimentares: ${p.restrictions || 'nenhuma'}`,
    `HISTÓRICO NO APP:`,
    `- Pesagens: ${bw.length} registros | Variação total: ${totalDelta != null ? totalDelta + ' kg' : '?'} | Ritmo atual: ${weeklyRate != null ? weeklyRate + ' kg/semana' : '?'}`,
    `- Meta de peso: ${S.targetW ? S.targetW + ' kg' : 'não definida'}`,
    `- Treinos últimos 28 dias: ${recent.length} | Volume total: ${Math.round(vol)} kg | Rotinas: ${(S.routines || []).map(r => r.name).join(', ') || 'nenhuma'}`,
    `- Metas atuais: ${diet.calorieTarget} kcal · P ${diet.proteinTarget}g · C ${diet.carbsTarget}g · G ${diet.fatTarget}g · Água ${diet.waterTarget}ml`,
    kcalAvg != null ? `- Média consumida (7d): ${kcalAvg} kcal/dia | Água média: ${waterAvg ?? 0} ml/dia` : '- Nenhum registro alimentar recente.'
  ].join('\n')
}

/* ============================ exercise mapping ============================ */

// Curated catalogue (id → canonical name) the AI must choose from. Real ids from
// the openGym dataset mean generated plans render with GIFs, instructions and
// progression exactly like hand-built ones.
const CATALOG = [
  ['0025', 'barbell bench press', 'peito'], ['0047', 'barbell incline bench press', 'peito'],
  ['0289', 'dumbbell bench press', 'peito'], ['0314', 'dumbbell incline bench press', 'peito'],
  ['0308', 'dumbbell fly', 'peito'], ['0155', 'cable cross-over variation', 'peito'],
  ['0662', 'push-up', 'peito'], ['0251', 'chest dip', 'peito'], ['0375', 'dumbbell pullover', 'peito'],
  ['0027', 'barbell bent over row', 'costas'], ['0032', 'barbell deadlift', 'costas'],
  ['2330', 'cable lat pulldown full range of motion', 'costas'], ['0198', 'cable pulldown', 'costas'],
  ['0861', 'cable seated row', 'costas'], ['0652', 'pull-up', 'costas'], ['1326', 'chin-up', 'costas'],
  ['0095', 'barbell shrug', 'costas'], ['0406', 'dumbbell shrug', 'costas'], ['0489', 'hyperextension', 'costas'],
  ['0091', 'barbell seated overhead press', 'ombros'], ['0405', 'dumbbell seated shoulder press', 'ombros'],
  ['0334', 'dumbbell lateral raise', 'ombros'], ['0310', 'dumbbell front raise', 'ombros'],
  ['2292', 'dumbbell rear delt raise', 'ombros'], ['0120', 'barbell upright row', 'ombros'],
  ['0178', 'cable lateral raise', 'ombros'],
  ['0043', 'barbell full squat', 'pernas'], ['0042', 'barbell front squat', 'pernas'],
  ['1760', 'dumbbell goblet squat', 'pernas'], ['0085', 'barbell romanian deadlift', 'pernas'],
  ['0739', 'sled 45° leg press', 'pernas'], ['0054', 'barbell lunge', 'pernas'],
  ['0336', 'dumbbell lunge', 'pernas'], ['0534', 'kettlebell goblet squat', 'pernas'],
  ['0549', 'kettlebell swing', 'pernas'], ['0044', 'barbell good morning', 'pernas'],
  ['1373', 'bodyweight standing calf raise', 'panturrilha'], ['1372', 'barbell standing calf raise', 'panturrilha'],
  ['1379', 'dumbbell seated calf raise', 'panturrilha'],
  ['0031', 'barbell curl', 'bíceps'], ['0294', 'dumbbell biceps curl', 'bíceps'],
  ['0313', 'dumbbell hammer curl', 'bíceps'], ['0868', 'cable curl', 'bíceps'],
  ['0030', 'barbell close-grip bench press', 'tríceps'], ['0201', 'cable pushdown', 'tríceps'],
  ['0194', 'cable overhead triceps extension', 'tríceps'], ['0814', 'triceps dip', 'tríceps'],
  ['0351', 'dumbbell lying triceps extension', 'tríceps'],
  ['0274', 'crunch floor', 'abdômen'], ['0735', 'sit-up v. 2', 'abdômen'],
  ['0687', 'russian twist', 'abdômen'], ['0484', 'hip raise (bent knee)', 'abdômen'],
  ['0276', 'dead bug', 'abdômen'], ['1467', 'push-up on lower arms (prancha)', 'abdômen'],
  ['0003', 'air bike', 'abdômen'], ['0459', 'flutter kicks', 'abdômen'],
  ['1160', 'burpee', 'cardio'], ['0630', 'mountain climber', 'cardio'],
  ['2612', 'jump rope', 'cardio'], ['2138', 'stationary bike run v. 3', 'cardio']
]
const norm = s => (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim()

// AI answers with catalogue names, but may drift ("supino reto", "bench press").
// Strategy: exact catalogue hit → token-overlap against every EXDB name → null.
export function mapExercise(name) {
  const q = norm(name)
  if (!q) return null
  const exact = CATALOG.find(([, n]) => norm(n) === q || norm(n.split(' (')[0]) === q)
  if (exact) return exact[0]
  const qt = q.split(' ')
  let best = null, bestScore = 0
  for (const ex of EXDB) {
    const nt = norm(ex.n).split(' ')
    const hits = qt.filter(t => nt.includes(t)).length
    const score = hits / Math.max(qt.length, nt.length)
    if (score > bestScore) { bestScore = score; best = ex.id }
  }
  return bestScore >= 0.6 ? best : null
}

const PT_TYPES = { 'cafe': 'breakfast', 'café': 'breakfast', 'desjejum': 'breakfast', 'breakfast': 'breakfast', 'almoco': 'lunch', 'almoço': 'lunch', 'lunch': 'lunch', 'jantar': 'dinner', 'dinner': 'dinner', 'lanche': 'snack', 'snack': 'snack', 'pre': 'preworkout', 'pré': 'preworkout', 'pre-treino': 'preworkout', 'preworkout': 'preworkout' }
export function mapMealType(t) {
  const k = norm(t).split(' ')[0]
  return PT_TYPES[k] || 'snack'
}

/* ============================ workout plan ============================ */

const clampInt = (v, lo, hi, dflt) => { const n = Math.round(Number(v)); return isFinite(n) ? Math.max(lo, Math.min(hi, n)) : dflt }

function sanitizeWorkout(raw) {
  const out = []
  for (const r of (raw.routines || raw.dias || raw.days || [])) {
    const exs = []
    for (const e of (r.exercises || r.exercicios || [])) {
      const id = e.id && !isNaN(e.id) && String(e.id).length === 4 ? String(e.id) : mapExercise(e.name || e.exercicio || e.nome || '')
      if (!id) continue
      exs.push({ id, sets: clampInt(e.sets || e.series, 1, 6, 3), reps: clampInt(e.reps || e.repeticoes, 1, 50, 10), weight: 0 })
    }
    if (!exs.length) continue
    const days = [...new Set((r.days || r.dias || []).map(d => clampInt(d, 0, 6, 1)))].slice(0, 2)
    out.push({ name: String(r.name || r.nome || 'Treino').slice(0, 40), emoji: r.emoji || 'barbell', days: days.length ? days : [], ex: exs.slice(0, 9) })
  }
  return out
}

const GOAL_PT = { cutting: 'emagrecimento (cutting)', bulk: 'ganho de massa (bulking)', maintain: 'manutenção e recomposição', strength: 'força', endurance: 'condicionamento e resistência' }

export async function generateWorkoutPlan(S, prefs = {}) {
  const goal = GOAL_PT[prefs.goal] ? prefs.goal : 'maintain'
  const days = clampInt(prefs.days, 2, 6, 4)
  const equip = prefs.equipment || 'academia'
  const equipTxt = equip === 'home' ? 'PESO DO CORPO (treino em casa, sem equipamentos)' : equip === 'dumbbells' ? 'SÓ HALTERES E BANCO (home office gym)' : 'ACADEMIA COMPLETA (barra, halteres, máquinas e polias)'
  if (isAIConnected()) {
    const sys = 'Você é um personal trainer de elite. Responda EXCLUSIVAMENTE com um JSON válido, sem texto fora do JSON. Use EXATAMENTE a estrutura pedida e escolha exercícios APENAS do catálogo fornecido (use o nome em inglês exatamente como listado). Responda em Português do Brasil nos campos de texto.'
    const user = `${buildBodyContext(S)}

CATÁLOGO DE EXERCÍCIOS DISPONÍVEIS (id: nome):
${CATALOG.map(([id, n, bp]) => `${id}: ${n} [${bp}]`).join('\n')}

MONTE UM PLANO DE TREINO SEMANAL:
- Objetivo: ${GOAL_PT[goal]}
- Frequência: ${days} treinos por semana
- Equipamento: ${equipTxt}
- Lesões/limitações: ${getFitnessProfile().injuries || 'nenhuma'}${prefs.notes ? `\n- Observações: ${prefs.notes}` : ''}

FORMATO DE RESPOSTA (JSON):
{"routines":[{"name":"nome curto do treino","emoji":"barbell|dumbbell|legs|abs|pullup|figureRun|heart|flame|bolt|shield","days":[1],"exercises":[{"name":"nome exato do catálogo","sets":4,"reps":8}]}]}
Regras: distribua os ${days} treinos em dias da semana (1=segunda … 6=sábado, 0=domingo) SEM repetir dia; 4 a 7 exercícios por treino; séries 3-5; reps coerentes com o objetivo; respeite lesões; para emagrecimento inclua finalizadores metabólicos/abdominais.`
    const raw = await aiJSON(sys, user, { temperature: 0.5 })
    const plan = sanitizeWorkout(raw)
    if (plan.length) return { plan, source: 'ai' }
  }
  return { plan: demoWorkoutPlan(goal, days, equip), source: 'demo' }
}

// Local PPL/UL fallback split — always available, respects days & equipment.
function demoWorkoutPlan(goal, days, equip) {
  const pick = (names, sets, reps) => names.map(n => ({ id: mapExercise(n), sets, reps, weight: 0 })).filter(e => e.id)
  const gym = equip !== 'home'
  const blocks = {
    push: pick(gym ? ['barbell bench press', 'barbell incline bench press', 'dumbbell lateral raise', 'cable pushdown', 'crunch floor'] : ['push-up', 'push-up', 'triceps dip', 'push-up on lower arms (prancha)'], 4, goal === 'strength' ? 5 : 10),
    pull: pick(gym ? ['cable lat pulldown full range of motion', 'barbell bent over row', 'dumbbell biceps curl', 'hyperextension'] : ['pull-up', 'chin-up', 'push-up on lower arms (prancha)', 'flutter kicks'], 4, goal === 'strength' ? 6 : 10),
    legs: pick(gym ? ['barbell full squat', 'barbell romanian deadlift', 'sled 45° leg press', 'barbell standing calf raise'] : ['kettlebell swing', 'bodyweight standing calf raise', 'air bike', 'mountain climber'], 4, goal === 'strength' ? 6 : 12),
    full: pick(gym ? ['barbell deadlift', 'barbell seated overhead press', 'barbell bent over row', 'barbell bench press'] : ['burpee', 'push-up', 'mountain climber', 'jump rope'], 3, 12),
    meta: pick(gym ? ['sled 45° leg press', 'cable seated row', 'dumbbell hammer curl', 'russian twist'] : ['jump rope', 'air bike', 'russian twist', 'flutter kicks'], 3, 15)
  }
  const splits = {
    2: [['Corpo Todo A', 'full', [1]], ['Corpo Todo B', 'meta', [4]]],
    3: [['Push', 'push', [1]], ['Pull', 'pull', [3]], ['Legs', 'legs', [5]]],
    4: [['Push', 'push', [1]], ['Pull', 'pull', [2]], ['Legs', 'legs', [4]], ['Metabólico', 'meta', [5]]],
    5: [['Push', 'push', [1]], ['Pull', 'pull', [2]], ['Legs', 'legs', [4]], ['Upper', 'full', [5]], ['Core+Cardio', 'meta', [6]]],
    6: [['Push', 'push', [1]], ['Pull', 'pull', [2]], ['Legs', 'legs', [3]], ['Upper', 'full', [4]], ['Lower', 'legs', [5]], ['Core+Cardio', 'meta', [6]]]
  }
  return splits[days].map(([name, key, d]) => ({ name, emoji: key === 'legs' ? 'legs' : key === 'pull' ? 'pullup' : key === 'meta' ? 'flame' : 'barbell', days: d, ex: blocks[key] }))
}

// One click: create the routines and lock them into the weekly schedule.
export function applyWorkoutPlan(plan) {
  const ids = []
  useStore.getState().update(s => {
    for (const r of plan) {
      const routine = { id: uid(), name: r.name, emoji: r.emoji || 'barbell', ex: r.ex.map(e => ({ id: e.id, sets: e.sets, reps: e.reps, weight: 0 })) }
      s.routines.push(routine)
      ids.push(routine.id)
      ;(r.days || []).forEach(d => { s.week[d] = routine.id })
    }
  })
  return ids
}

/* ============================ diet plan ============================ */

function sanitizeDiet(raw, S) {
  const t = raw.targets || raw
  const targets = {
    calorieTarget: clampInt(t.calorieTarget ?? t.calorias, 1200, 5000, 2200),
    proteinTarget: clampInt(t.proteinTarget ?? t.proteinas, 60, 300, 150),
    carbsTarget: clampInt(t.carbsTarget ?? t.carboidratos, 50, 600, 250),
    fatTarget: clampInt(t.fatTarget ?? t.gorduras, 30, 150, 65),
    waterTarget: clampInt(t.waterTarget ?? t.agua, 1500, 6000, 3000)
  }
  const meals = (raw.meals || raw.refeicoes || []).slice(0, 8).map(m => ({
    type: mapMealType(m.type || m.tipo),
    time: String(m.time || m.hora || '').slice(0, 5),
    name: String(m.name || m.nome || m.descricao || 'Refeição').slice(0, 80),
    portion: String(m.portion || m.porcao || '').slice(0, 60),
    calories: clampInt(m.calories ?? m.calorias, 40, 2000, 400),
    protein: clampInt(m.protein ?? m.proteinas, 0, 200, 25),
    carbs: clampInt(m.carbs ?? m.carboidratos, 0, 300, 40),
    fat: clampInt(m.fat ?? m.gorduras, 0, 120, 10)
  }))
  const kcal = meals.reduce((a, m) => a + m.calories, 0)
  return { targets, meals, notes: String(raw.notes || raw.observacoes || '').slice(0, 400), kcalSum: kcal }
}

export async function generateDietPlan(S, prefs = {}) {
  const goal = GOAL_PT[prefs.goal] ? prefs.goal : 'maintain'
  const nMeals = clampInt(prefs.meals, 3, 6, 4)
  const p = getFitnessProfile()
  if (isAIConnected()) {
    const sys = 'Você é um nutricionista esportivo de elite. Responda EXCLUSIVAMENTE com um JSON válido, sem texto fora dele. Campos de texto em Português do Brasil. Use alimentos brasileiros acessíveis (arroz, feijão, frango, ovos, etc.).'
    const user = `${buildBodyContext(S)}

MONTE UM PLANO ALIMENTAR:
- Objetivo: ${GOAL_PT[goal]}
- Refeições por dia: ${nMeals}
- Restrições/alergias: ${p.restrictions || 'nenhuma'}${prefs.notes ? `\n- Preferências: ${prefs.notes}` : ''}

FORMATO (JSON):
{"targets":{"calorieTarget":2200,"proteinTarget":150,"carbsTarget":230,"fatTarget":65,"waterTarget":3000},
"meals":[{"type":"breakfast|lunch|snack|dinner|preworkout","time":"07:30","name":"nome da refeição","portion":"descrição das porções (ex: 150g frango + 4 col arroz)","calories":450,"protein":40,"carbs":50,"fat":12}],
"notes":"orientações curtas"}
Regras: a soma das refeições deve ficar a ±5% das calorias do target; proteína ≥1.8g/kg se houver peso conhecido; distribua carboidratos ao redor do treino.`
    const raw = await aiJSON(sys, user, { temperature: 0.5 })
    const plan = sanitizeDiet(raw, S)
    if (plan.meals.length >= 2) return { plan, source: 'ai' }
  }
  return { plan: demoDietPlan(S, goal, nMeals), source: 'demo' }
}

const food = id => COMMON_FOODS.find(f => f.id === id)
function scaled(ing, factor) {
  const kcal = Math.round(ing.reduce((a, f) => a + f.calories, 0) * factor)
  const mk = (f) => ({ ...f, calories: Math.round(f.calories * factor), protein: +(f.protein * factor).toFixed(1), carbs: +(f.carbs * factor).toFixed(1), fat: +(f.fat * factor).toFixed(1) })
  const portion = ing.map(mk).map(f => `${f.serving.includes('unid') || f.serving.includes('fatia') || f.serving.includes('pote') || f.serving.includes('colher') || f.serving.includes('scoop') ? `${+(factor * 1).toFixed(1)}x ${f.name}` : `${Math.round(f.servingSize * factor)}g ${f.name}`}`).join(' + ')
  return {
    kcal, portion,
    protein: Math.round(ing.reduce((a, f) => a + f.protein, 0) * factor),
    carbs: Math.round(ing.reduce((a, f) => a + f.carbs, 0) * factor),
    fat: Math.round(ing.reduce((a, f) => a + f.fat, 0) * factor)
  }
}

// Balanced local template scaled to the smart targets — demo mode only.
function demoDietPlan(S, goal, nMeals) {
  const w = Number(getFitnessProfile().weightKg) || (S.bodyweight.length ? S.bodyweight[S.bodyweight.length - 1].w : 75)
  const targets = calcSmartTargets(w, goal === 'cutting' ? 'cut' : goal === 'bulk' ? 'bulk' : 'maintain')
  const templates = [
    { type: 'breakfast', time: '07:30', name: 'Café da manhã proteico', ing: [food('oats'), food('whey'), food('banana')] },
    { type: 'snack', time: '10:30', name: 'Lanche da manhã', ing: [food('yogurt'), food('apple')] },
    { type: 'lunch', time: '12:30', name: 'Almoço equilibrado', ing: [food('chicken'), food('rice'), food('beans'), food('oliveoil')] },
    { type: 'preworkout', time: '16:00', name: 'Pré-treino', ing: [food('bread'), food('peanutbutter')] },
    { type: 'dinner', time: '20:00', name: 'Jantar leve', ing: [food('groundbeef'), food('sweetpotato')] },
    { type: 'snack', time: '22:00', name: 'Ceia proteica', ing: [food('cottage'), food('egg')] }
  ]
  const order = nMeals <= 4 ? [0, 2, 3, 4] : nMeals === 5 ? [0, 2, 3, 4, 5] : [0, 1, 2, 3, 4, 5]
  const chosen = order.slice(0, nMeals).map(i => templates[i])
  const baseKcal = chosen.reduce((a, t) => a + t.ing.reduce((x, f) => x + f.calories, 0), 0)
  const factor = targets.calorieTarget / baseKcal
  const meals = chosen.map(t => {
    const s = scaled(t.ing, factor)
    return { type: t.type, time: t.time, name: t.name, portion: s.portion, calories: s.kcal, protein: s.protein, carbs: s.carbs, fat: s.fat }
  })
  return { targets, meals, notes: 'Plano demonstração gerado localmente com base nas suas metas inteligentes. Conecte sua chave OmniRoute para receber um plano 100% personalizado pela IA.', kcalSum: meals.reduce((a, m) => a + m.calories, 0) }
}

// One click: overwrite the macro targets (optionally water) and, if asked,
// register the plan's meals as today's food log.
export function applyDietPlan(plan, { applyMealsToday = false } = {}) {
  const { targets, meals } = plan
  useStore.getState().update(s => {
    s.diet = { ...s.diet, ...targets }
    if (applyMealsToday) {
      const iso = todayISO()
      if (!s.diet.logs) s.diet.logs = {}
      if (!s.diet.logs[iso]) s.diet.logs[iso] = { water: 0, meals: [] }
      s.diet.logs[iso].meals = meals.map((m, i) => ({
        id: 'ai_' + Date.now() + '_' + i,
        time: m.time || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        name: m.name, type: m.type, calories: m.calories, protein: m.protein, carbs: m.carbs, fat: m.fat,
        portion: m.portion, notes: 'Plano IA'
      }))
    }
  })
}

/* ============================ weight-loss evaluation ============================ */

// Pure local metrics — the eval screen renders these even with no AI at all.
export function evaluateWeightLoss(S) {
  const bw = [...(S.bodyweight || [])].sort((a, b) => (a.d < b.d ? -1 : 1))
  const p = getFitnessProfile()
  const diet = getDiet(S)
  const last = bw.length ? bw[bw.length - 1].w : null
  const first = bw.length ? bw[0].w : null
  const spanDays = bw.length > 1 ? Math.max(1, Math.round((new Date(bw[bw.length - 1].d) - new Date(bw[0].d)) / 86400000)) : 0
  const totalLost = first != null && last != null ? +(first - last).toFixed(1) : null
  const pctLost = totalLost != null && first ? +((totalLost / first) * 100).toFixed(1) : null

  // Recent trend: least-squares slope (kg/week) over the last 14 weigh-ins.
  const recent = bw.slice(-14)
  let trend = null
  if (recent.length >= 3) {
    const t0 = new Date(recent[0].d).getTime()
    const pts = recent.map(b => ({ x: (new Date(b.d).getTime() - t0) / 86400000, y: b.w }))
    const n = pts.length
    const mx = pts.reduce((a, q) => a + q.x, 0) / n, my = pts.reduce((a, q) => a + q.y, 0) / n
    const den = pts.reduce((a, q) => a + (q.x - mx) ** 2, 0)
    if (den > 0) trend = +((pts.reduce((a, q) => a + (q.x - mx) * (q.y - my), 0) / den) * 7).toFixed(2)
  }

  const avgRate = totalLost != null && spanDays >= 7 ? +((totalLost / spanDays) * 7).toFixed(2) : null
  const remaining = S.targetW && last != null ? +(last - S.targetW).toFixed(1) : null
  const etaWeeks = remaining != null && trend != null && trend < -0.05 ? Math.ceil(remaining / -trend) : null

  const h = Number(p.heightCm)
  const bmi = last != null && h > 100 ? +(last / (h / 100) ** 2).toFixed(1) : null

  // Adherence: workouts done vs planned in the last 28 days; kcal logs vs target.
  const sinceD = new Date(); sinceD.setDate(sinceD.getDate() - 28)
  const w28 = (S.workouts || []).filter(w => new Date(w.d) >= sinceD)
  const plannedPerWeek = Math.max(1, Object.values(S.week || {}).filter(Boolean).length || Number(p.daysPerWeek) || 3)
  const workoutAdherence = Math.min(100, Math.round((w28.length / (plannedPerWeek * 4)) * 100))
  const logs = Object.entries(diet.logs || {}).sort((a, b) => (a[0] < b[0] ? -1 : 1)).slice(-7)
  const logged = logs.filter(([, l]) => (l.meals || []).length)
  const kcalAvg = logged.length ? Math.round(logged.reduce((a, [, l]) => a + (l.meals || []).reduce((x, m) => x + (m.calories || 0), 0), 0) / logged.length) : null
  const kcalOff = kcalAvg != null ? Math.abs(kcalAvg - diet.calorieTarget) : null
  const dietAdherence = kcalOff != null ? Math.max(0, Math.round(100 - (kcalOff / diet.calorieTarget) * 100)) : null

  // Overall status from the average rate: 0.25–1.0 kg/week is the healthy band.
  const rate = avgRate ?? trend
  let status = 'sem-dados'
  if (rate != null) {
    if (rate <= -0.25 && rate >= -1.0) status = 'otimo'
    else if (rate > -0.25 && rate <= 0) status = 'bom'
    else if (rate < -1.0 && rate >= -1.5) status = 'atencao'
    else status = rate < -1.5 ? 'critico' : 'estagnado'
  }

  return { last, first, totalLost, pctLost, spanDays, avgRate, trend, remaining, etaWeeks, bmi, workoutAdherence, dietAdherence, kcalAvg, weighIns: bw.length, status, weeklyTarget: plannedPerWeek, workouts28: w28.length }
}

// Rule-based verdict for demo mode (no API key).
function demoVerdict(m) {
  const strengths = [], warnings = [], actions = []
  if (m.totalLost > 0) strengths.push(`Você já eliminou ${Math.abs(m.totalLost)} kg desde o primeiro registro — ${Math.abs(m.pctLost)}% do peso inicial.`)
  if (m.workoutAdherence >= 75) strengths.push(`Adesão aos treinos em ${m.workoutAdherence}% — consistência é o que transforma o corpo.`)
  if (m.trend != null && m.trend < 0) strengths.push('A tendência das últimas pesagens está em queda.')
  const rate = m.avgRate ?? m.trend
  if (rate == null) warnings.push('Poucas pesagens registradas para calcular seu ritmo. Pese-se 2-3x por semana, em jejum.')
  else if (rate > 0) warnings.push('O peso está subindo. Revise calorias ingeridas vs. gastas antes de ajustar o treino.')
  else if (rate > -0.25) warnings.push('Ritmo abaixo do ideal (<0,25 kg/semana). Um déficit de 200-300 kcal/dia costuma destravar.')
  else if (rate < -1.0) warnings.push('Ritmo acima de 1 kg/semana pode sacrificar massa muscular. Considere suavizar o déficit.')
  if (m.dietAdherence != null && m.dietAdherence < 70) warnings.push('As calorias registradas estão distantes da meta — o registro consciente acelera resultados.')
  actions.push('Mantenha proteína entre 1,8–2,2 g/kg e treinos de força 3-4x/semana para preservar músculo no déficit.')
  actions.push('Registre todas as refeições por 7 dias seguidos: consciência alimentar é o nº1 preditor de emagrecimento.')
  if (m.remaining > 0) actions.push(`Faltam ${m.remaining} kg para sua meta. Foque no processo semanal, não no número final.`)
  const score = Math.max(20, Math.min(95, Math.round((m.workoutAdherence + (m.dietAdherence ?? 60)) / 2 + (rate != null && rate <= 0 && rate >= -1 ? 20 : rate != null && rate < 0 ? 8 : -10))))
  return { score, status: m.status === 'otimo' ? 'excelente' : m.status === 'bom' ? 'bom' : m.status === 'sem-dados' ? 'bom' : m.status === 'estagnado' ? 'atencao' : m.status, title: 'Diagnóstico local (modo demonstração)', summary: 'Análise gerada offline pelas suas métricas do openGym. Conecte o OmniRoute na aba IA Coach para análises profundas e personalizadas.', strengths, warnings, actions }
}

export async function aiEvaluateWeightLoss(S) {
  const m = evaluateWeightLoss(S)
  if (isAIConnected()) {
    try {
      const sys = 'Você é um fisiologista do exercício e nutricionista esportivo avaliando o processo de emagrecimento de um atleta. Responda EXCLUSIVAMENTE com JSON válido, textos em Português do Brasil. Seja empático, direto e baseado em evidências. Nunca prescreva dietas extremas (abaixo de 1200 kcal) ou demonize alimentos.'
      const user = `${buildBodyContext(S)}

MÉTRICAS CALCULADAS DO PROCESSO DE EMAGRECIMENTO:
- Peso atual: ${m.last ?? '?'} kg | Inicial: ${m.first ?? '?'} kg | Perda total: ${m.totalLost ?? '?'} kg (${m.pctLost ?? '?'}%)
- Ritmo médio: ${m.avgRate ?? '?'} kg/semana em ${m.spanDays} dias | Tendência recente: ${m.trend ?? '?'} kg/semana
- Meta: ${S.targetW ?? 'não definida'} kg | Faltam: ${m.remaining ?? '?'} kg | Projeção: ${m.etaWeeks ? m.etaWeeks + ' semanas' : 'indeterminada'}
- IMC: ${m.bmi ?? '?'} | Adesão treinos: ${m.workoutAdherence}% | Aderência dieta: ${m.dietAdherence != null ? m.dietAdherence + '%' : 'sem registros'}
- Média calórica registrada (7d): ${m.kcalAvg ?? 'sem registros'} kcal

AVALIE O PROCESSO E RETORNE (JSON):
{"score":0,"status":"excelente|bom|atencao|critico","title":"título curto","summary":"análise de 2-3 frases","strengths":["..."],"warnings":["..."],"actions":["ação concreta 1","ação concreta 2","ação concreta 3"],"suggestedCalories":2200}
score = 0-100 (100 = processo perfeito); máximo 3 itens por lista; suggestedCalories = ajuste sugerido para o alvo diário.`
      const v = await aiJSON(sys, user, { temperature: 0.4 })
      return {
        score: clampInt(v.score, 0, 100, 70),
        status: ['excelente', 'bom', 'atencao', 'critico'].includes(v.status) ? v.status : 'bom',
        title: String(v.title || 'Análise da IA').slice(0, 60),
        summary: String(v.summary || '').slice(0, 500),
        strengths: (v.strengths || []).slice(0, 3).map(x => String(x).slice(0, 200)),
        warnings: (v.warnings || []).slice(0, 3).map(x => String(x).slice(0, 200)),
        actions: (v.actions || []).slice(0, 3).map(x => String(x).slice(0, 200)),
        suggestedCalories: clampInt(v.suggestedCalories, 1200, 5000, 0),
        source: 'ai'
      }
    } catch (e) {
      return { ...demoVerdict(m), source: 'demo', error: e.message }
    }
  }
  return { ...demoVerdict(m), source: 'demo' }
}
