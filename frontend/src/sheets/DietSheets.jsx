import { useState } from 'react'
import { useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import {
  getDiet,
  getDayLog,
  calcSmartTargets,
  addWater,
  setWater,
  addMeal,
  updateMeal,
  deleteMeal,
  saveDietTargets,
  COMMON_FOODS,
  MEAL_TYPES,
} from '../lib/diet.js'
import { lastBW } from '../lib/history.js'
import { fmtNum, todayISO } from '../lib/format.js'
import { t } from '../lib/i18n.js'
import Icon from '../components/Icon.jsx'
import { Button, NumberField, TextField, Segmented } from '../components/ui.jsx'

/* =========================================================================
   1. Meal Form Sheet (Add or Edit Food/Meal Entry)
   ========================================================================= */
export function MealFormSheet({ initialMeal = null, defaultType = 'lunch', iso = todayISO(), close }) {
  const update = useStore(s => s.update)
  const toast = useUI(s => s.toast)

  const [name, setName] = useState(initialMeal?.name || '')
  const [type, setType] = useState(initialMeal?.type || defaultType)
  const [portion, setPortion] = useState(initialMeal?.portion || '')
  const [calories, setCalories] = useState(initialMeal?.calories ?? 300)
  const [protein, setProtein] = useState(initialMeal?.protein ?? 25)
  const [carbs, setCarbs] = useState(initialMeal?.carbs ?? 30)
  const [fat, setFat] = useState(initialMeal?.fat ?? 8)
  const [notes, setNotes] = useState(initialMeal?.notes || '')

  const isEdit = !!initialMeal?.id

  const save = () => {
    const mealName = name.trim() || t('Meal')
    if (isEdit) {
      updateMeal(
        update,
        initialMeal.id,
        { name: mealName, type, portion, calories, protein, carbs, fat, notes },
        iso
      )
      toast(t('Meal updated'))
    } else {
      addMeal(
        update,
        { name: mealName, type, portion, calories, protein, carbs, fat, notes },
        iso
      )
      toast(t('Meal logged'))
    }
    close()
  }

  const remove = () => {
    if (isEdit) {
      deleteMeal(update, initialMeal.id, iso)
      toast(t('Meal deleted'))
    }
    close()
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div className="row between">
        <h3 style={{ margin: 0 }}>{isEdit ? t('Edit meal') : t('Log meal')}</h3>
        {isEdit && (
          <Button size="sm" variant="ghost" icon="trash" style={{ color: 'var(--red)' }} onClick={remove}>
            {t('Delete')}
          </Button>
        )}
      </div>

      <div>
        <div className="sub" style={{ marginBottom: 4 }}>{t('Food / Meal name')}</div>
        <TextField
          placeholder={t('e.g. Chicken breast with sweet potato')}
          value={name}
          onChange={e => setName(e.target.value)}
          autoFocus={!isEdit}
        />
      </div>

      <div>
        <div className="sub" style={{ marginBottom: 4 }}>{t('Meal category')}</div>
        <Segmented
          value={type}
          onChange={setType}
          options={MEAL_TYPES.map(m => ({ value: m.id, label: t(m.label) }))}
        />
      </div>

      <div className="grid2">
        <div>
          <div className="sub" style={{ marginBottom: 4 }}>{t('Portion (optional)')}</div>
          <TextField
            placeholder={t('e.g. 150g or 1 cup')}
            value={portion}
            onChange={e => setPortion(e.target.value)}
          />
        </div>
        <div>
          <div className="sub" style={{ marginBottom: 4 }}>{t('Calories (kcal)')}</div>
          <NumberField decimal={false} value={calories} onChange={v => setCalories(Math.max(0, v || 0))} />
        </div>
      </div>

      <div>
        <div className="sub" style={{ marginBottom: 6 }}>{t('Macronutrients (grams)')}</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
          <div>
            <div className="small muted" style={{ marginBottom: 3, color: 'var(--acc)' }}>{t('Protein')}</div>
            <NumberField decimal={false} value={protein} onChange={v => setProtein(Math.max(0, v || 0))} />
          </div>
          <div>
            <div className="small muted" style={{ marginBottom: 3, color: 'var(--yellow)' }}>{t('Carbs')}</div>
            <NumberField decimal={false} value={carbs} onChange={v => setCarbs(Math.max(0, v || 0))} />
          </div>
          <div>
            <div className="small muted" style={{ marginBottom: 3, color: 'var(--red)' }}>{t('Fat')}</div>
            <NumberField decimal={false} value={fat} onChange={v => setFat(Math.max(0, v || 0))} />
          </div>
        </div>
      </div>

      <div>
        <div className="sub" style={{ marginBottom: 4 }}>{t('Notes (optional)')}</div>
        <TextField
          placeholder={t('Add details, brands, or recipes…')}
          value={notes}
          onChange={e => setNotes(e.target.value)}
        />
      </div>

      <Button variant="primary" onClick={save}>
        {isEdit ? t('Save changes') : t('Add to {0}', t(MEAL_TYPES.find(m => m.id === type)?.label || 'Meal'))}
      </Button>
    </div>
  )
}

/* =========================================================================
   2. Food Picker Sheet (Instant staple foods + Custom Meal)
   ========================================================================= */
export function FoodPickerSheet({ defaultType = 'lunch', iso = todayISO(), openMealForm, close }) {
  const update = useStore(s => s.update)
  const toast = useUI(s => s.toast)
  const [q, setQ] = useState('')
  const [selFood, setSelFood] = useState(null)
  const [portionMult, setPortionMult] = useState(1)

  const ql = q.toLowerCase().trim()
  const foods = COMMON_FOODS.filter(f => !ql || f.name.toLowerCase().includes(ql) || f.serving.toLowerCase().includes(ql))

  const addSelectedFood = food => {
    const mult = portionMult || 1
    const finalPortion = mult === 1 ? food.serving : `${Math.round(food.servingSize * mult)}${food.unit}`
    addMeal(
      update,
      {
        name: food.name,
        type: defaultType,
        portion: finalPortion,
        calories: Math.round(food.calories * mult),
        protein: Math.round(food.protein * mult),
        carbs: Math.round(food.carbs * mult),
        fat: Math.round(food.fat * mult),
      },
      iso
    )
    toast(t('Added {0}', food.name))
    close()
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div className="row between">
        <h3 style={{ margin: 0 }}>{t('Add food')}</h3>
        <Button
          size="sm"
          variant="tinted"
          icon="plus"
          onClick={() => {
            close()
            openMealForm()
          }}
        >
          {t('Custom food')}
        </Button>
      </div>

      <div className="search" style={{ position: 'relative' }}>
        <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></svg>
        <input
          className="input"
          placeholder={t('Search staple fitness foods…')}
          value={q}
          onChange={e => setQ(e.target.value)}
          autoFocus
        />
        {q && (
          <button
            className="iconbtn"
            onClick={() => setQ('')}
            aria-label={t('Clear search')}
            style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', width: 28, height: 28 }}
          >
            <Icon name="xmark" />
          </button>
        )}
      </div>

      {selFood && (
        <div className="card" style={{ margin: '4px 0', background: 'var(--surface-2)', padding: 14 }}>
          <div className="row between" style={{ marginBottom: 6 }}>
            <div>
              <b style={{ fontSize: 16 }}>{selFood.name}</b>
              <div className="small dim">{t('Base serving: {0}', selFood.serving)}</div>
            </div>
            <button className="iconbtn" onClick={() => setSelFood(null)} aria-label={t('Cancel')}>
              <Icon name="xmark" />
            </button>
          </div>

          <div className="sub" style={{ margin: '8px 0 4px' }}>{t('Portion multiplier')}</div>
          <Segmented
            value={portionMult}
            onChange={setPortionMult}
            options={[
              { value: 0.5, label: '0.5x' },
              { value: 1, label: '1x' },
              { value: 1.5, label: '1.5x' },
              { value: 2, label: '2x' },
              { value: 3, label: '3x' },
            ]}
          />

          <div className="row between small" style={{ margin: '12px 0 10px', background: 'var(--surface)', padding: 8, borderRadius: 8 }}>
            <span><b>{Math.round(selFood.calories * portionMult)}</b> kcal</span>
            <span style={{ color: 'var(--acc)' }}><b>{Math.round(selFood.protein * portionMult)}g</b> {t('Protein')}</span>
            <span style={{ color: 'var(--yellow)' }}><b>{Math.round(selFood.carbs * portionMult)}g</b> {t('Carbs')}</span>
            <span style={{ color: 'var(--red)' }}><b>{Math.round(selFood.fat * portionMult)}g</b> {t('Fat')}</span>
          </div>

          <Button variant="primary" icon="check" onClick={() => addSelectedFood(selFood)}>
            {t('Confirm & add to {0}', t(MEAL_TYPES.find(m => m.id === defaultType)?.label || 'Meal'))}
          </Button>
        </div>
      )}

      <div className="list" style={{ maxHeight: '50vh', overflowY: 'auto' }}>
        <div
          className="item"
          onClick={() => {
            close()
            openMealForm()
          }}
        >
          <div className="thumb thumb-x"><Icon name="sparkles" /></div>
          <div className="grow">
            <div className="tt">{t('Custom item / meal')}</div>
            <div className="ss">{t('Type custom food name and custom macros')}</div>
          </div>
          <Icon name="plus" className="chev" />
        </div>

        {foods.map(food => (
          <div
            key={food.id}
            className="item"
            onClick={() => {
              setSelFood(food)
              setPortionMult(1)
            }}
          >
            <div className="thumb thumb-x" style={{ background: 'color-mix(in srgb, var(--acc) 12%, transparent)', color: 'var(--acc)' }}>
              <Icon name="apple" />
            </div>
            <div className="grow">
              <div className="tt">{food.name}</div>
              <div className="ss">
                {food.serving} · <b style={{ color: 'var(--label-1)' }}>{food.calories} kcal</b> · P: {food.protein}g · C: {food.carbs}g · F: {food.fat}g
              </div>
            </div>
            <Button
              size="sm"
              variant="tinted"
              icon="plus"
              onClick={e => {
                e.stopPropagation()
                setSelFood(food)
                setPortionMult(1)
              }}
            >
              {t('Add')}
            </Button>
          </div>
        ))}
      </div>
    </div>
  )
}

/* =========================================================================
   3. Diet Targets & Smart Calculator Sheet
   ========================================================================= */
export function DietTargetsSheet({ close }) {
  const S = useStore(s => s.S)
  const update = useStore(s => s.update)
  const toast = useUI(s => s.toast)
  const currentDiet = getDiet(S)
  const bw = lastBW(S)?.w || 70

  const [tab, setTab] = useState('smart') // 'smart' | 'manual'
  // Smart calc fields
  const [weight, setWeight] = useState(bw)
  const [goal, setGoal] = useState('maintain') // 'cut' | 'maintain' | 'bulk'

  // Manual fields
  const [cal, setCal] = useState(currentDiet.calorieTarget)
  const [water, setWaterTarget] = useState(currentDiet.waterTarget)
  const [p, setP] = useState(currentDiet.proteinTarget)
  const [c, setC] = useState(currentDiet.carbsTarget)
  const [f, setF] = useState(currentDiet.fatTarget)

  const smart = calcSmartTargets(weight, goal)

  const applySmart = () => {
    saveDietTargets(update, smart)
    toast(t('Diet targets applied!'))
    close()
  }

  const applyManual = () => {
    saveDietTargets(update, {
      calorieTarget: cal,
      waterTarget: water,
      proteinTarget: p,
      carbsTarget: c,
      fatTarget: f,
    })
    toast(t('Diet targets saved!'))
    close()
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div className="row between">
        <h3 style={{ margin: 0 }}>{t('Diet & Hydration targets')}</h3>
      </div>

      <Segmented
        value={tab}
        onChange={setTab}
        options={[
          { value: 'smart', label: t('Smart Calculator') },
          { value: 'manual', label: t('Custom targets') },
        ]}
      />

      {tab === 'smart' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="muted small">
            {t('Calculates optimal calories, macronutrients, and daily water based on your goal and body weight.')}
          </div>

          <div className="sub" style={{ marginBottom: -4 }}>{t('Your fitness goal')}</div>
          <Segmented
            value={goal}
            onChange={setGoal}
            options={[
              { value: 'cut', label: t('Fat loss (Cut)') },
              { value: 'maintain', label: t('Maintenance') },
              { value: 'bulk', label: t('Muscle gain (Bulk)') },
            ]}
          />

          <div>
            <div className="sub" style={{ marginBottom: 4 }}>{t('Current body weight ({0})', S.unit || 'kg')}</div>
            <NumberField decimal value={weight} onChange={v => setWeight(Math.max(30, v || 70))} />
          </div>

          <div className="card" style={{ margin: '4px 0', background: 'var(--surface-2)', padding: 14 }}>
            <div className="row between" style={{ marginBottom: 8 }}>
              <span className="small muted">{t('Recommended daily targets')}</span>
              <span className="tag acc">{t(goal === 'cut' ? 'Deficit -20%' : goal === 'bulk' ? 'Surplus +12%' : 'Equilibrium')}</span>
            </div>

            <div className="row between" style={{ alignItems: 'baseline', marginBottom: 10 }}>
              <div>
                <div className="stat-v" style={{ fontSize: 32, fontWeight: 700, color: 'var(--label-1)' }}>
                  {fmtNum(smart.calorieTarget)} <span style={{ fontSize: 16, fontWeight: 500, color: 'var(--label-3)' }}>kcal</span>
                </div>
                <div className="small dim">{t('Daily energy intake')}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div className="stat-v" style={{ fontSize: 26, fontWeight: 700, color: 'var(--sky)' }}>
                  {fmtNum(smart.waterTarget)} <span style={{ fontSize: 15, fontWeight: 500, color: 'var(--label-3)' }}>ml</span>
                </div>
                <div className="small dim">{t('Water (~35ml/kg)')}</div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, textAlign: 'center' }}>
              <div className="card" style={{ margin: 0, padding: '8px 4px', background: 'var(--surface)' }}>
                <div className="small dim">{t('Protein')}</div>
                <div style={{ fontWeight: 700, fontSize: 18, color: 'var(--acc)', margin: '2px 0' }}>{smart.proteinTarget}g</div>
                <div className="small dim">{fmtNum(smart.proteinTarget * 4)} kcal</div>
              </div>
              <div className="card" style={{ margin: 0, padding: '8px 4px', background: 'var(--surface)' }}>
                <div className="small dim">{t('Carbs')}</div>
                <div style={{ fontWeight: 700, fontSize: 18, color: 'var(--yellow)', margin: '2px 0' }}>{smart.carbsTarget}g</div>
                <div className="small dim">{fmtNum(smart.carbsTarget * 4)} kcal</div>
              </div>
              <div className="card" style={{ margin: 0, padding: '8px 4px', background: 'var(--surface)' }}>
                <div className="small dim">{t('Fat')}</div>
                <div style={{ fontWeight: 700, fontSize: 18, color: 'var(--red)', margin: '2px 0' }}>{smart.fatTarget}g</div>
                <div className="small dim">{fmtNum(smart.fatTarget * 9)} kcal</div>
              </div>
            </div>
          </div>

          <Button variant="primary" icon="check" onClick={applySmart}>
            {t('Apply recommended targets')}
          </Button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="grid2">
            <div>
              <div className="sub" style={{ marginBottom: 4 }}>{t('Daily calories (kcal)')}</div>
              <NumberField decimal={false} value={cal} onChange={v => setCal(Math.max(500, v || 0))} />
            </div>
            <div>
              <div className="sub" style={{ marginBottom: 4 }}>{t('Daily water (ml)')}</div>
              <NumberField decimal={false} value={water} onChange={v => setWaterTarget(Math.max(500, v || 0))} />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
            <div>
              <div className="sub" style={{ marginBottom: 4 }}>{t('Protein (g)')}</div>
              <NumberField decimal={false} value={p} onChange={v => setP(Math.max(0, v || 0))} />
            </div>
            <div>
              <div className="sub" style={{ marginBottom: 4 }}>{t('Carbs (g)')}</div>
              <NumberField decimal={false} value={c} onChange={v => setC(Math.max(0, v || 0))} />
            </div>
            <div>
              <div className="sub" style={{ marginBottom: 4 }}>{t('Fat (g)')}</div>
              <NumberField decimal={false} value={f} onChange={v => setF(Math.max(0, v || 0))} />
            </div>
          </div>

          <div className="small dim">
            {t('Total macro calories:')} <b>{fmtNum(p * 4 + c * 4 + f * 9)} kcal</b>
          </div>

          <Button variant="primary" onClick={applyManual}>{t('Save targets')}</Button>
        </div>
      )}
    </div>
  )
}

/* =========================================================================
   4. Water Custom Adjustment Sheet
   ========================================================================= */
export function WaterAdjustSheet({ currentMl = 0, iso = todayISO(), close }) {
  const update = useStore(s => s.update)
  const toast = useUI(s => s.toast)
  const [val, setVal] = useState(currentMl)

  const save = () => {
    setWater(update, Math.max(0, val || 0), iso)
    toast(t('Water intake updated'))
    close()
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div className="row between">
        <h3 style={{ margin: 0 }}>{t('Adjust water intake')}</h3>
      </div>
      <div>
        <div className="sub" style={{ marginBottom: 4 }}>{t('Total consumed today (ml)')}</div>
        <NumberField decimal={false} value={val} onChange={v => setVal(Math.max(0, v || 0))} />
      </div>

      <div className="chips" style={{ margin: '4px 0' }}>
        <button className="chip" onClick={() => setVal(v => Math.max(0, v - 250))}>-250 ml</button>
        <button className="chip" onClick={() => setVal(v => v + 250)}>+250 ml</button>
        <button className="chip" onClick={() => setVal(v => v + 500)}>+500 ml</button>
        <button className="chip" onClick={() => setVal(v => v + 1000)}>+1000 ml</button>
      </div>

      <Button variant="primary" onClick={save}>{t('Save water intake')}</Button>
    </div>
  )
}
