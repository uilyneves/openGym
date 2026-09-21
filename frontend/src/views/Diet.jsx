import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import {
  getDiet,
  getDayLog,
  calcDayTotals,
  MEAL_TYPES,
} from '../lib/diet.js'
import { fmtNum, fmtDate, todayISO, isoOf } from '../lib/format.js'
import { t, dateLocale } from '../lib/i18n.js'
import {
  mealSheet,
  foodPickerSheet,
  dietTargetsSheet,
  aiDietSheet,
} from '../sheets.jsx'
import Icon from '../components/Icon.jsx'
import { Button } from '../components/ui.jsx'

export default function Diet() {
  const nav = useNavigate()
  const S = useStore(s => s.S)
  const update = useStore(s => s.update)

  const [dateIso, setDateIso] = useState(todayISO())
  const isToday = dateIso === todayISO()

  const diet = getDiet(S)
  const dayLog = getDayLog(S, dateIso)
  const totals = calcDayTotals(dayLog.meals)

  const changeDay = delta => {
    const d = new Date(dateIso + 'T12:00:00')
    d.setDate(d.getDate() + delta)
    setDateIso(isoOf(d))
  }

  // Macro calculations
  const calTarget = diet.calorieTarget || 2200
  const calPct = Math.min(100, Math.round((totals.calories / calTarget) * 100))
  const calRemaining = calTarget - totals.calories

  const protTarget = diet.proteinTarget || 140
  const protPct = Math.min(100, Math.round((totals.protein / protTarget) * 100))

  const carbsTarget = diet.carbsTarget || 250
  const carbsPct = Math.min(100, Math.round((totals.carbs / carbsTarget) * 100))

  const fatTarget = diet.fatTarget || 65
  const fatPct = Math.min(100, Math.round((totals.fat / fatTarget) * 100))

  const displayDate = () => {
    if (isToday) return t('Today')
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    if (dateIso === isoOf(yesterday)) return t('Yesterday')
    const d = new Date(dateIso + 'T12:00:00')
    return d.toLocaleDateString(dateLocale(), { weekday: 'short', day: 'numeric', month: 'short' })
  }

  return (
    <div className="narrow">
      {/* Header */}
      <div className="hdr">
        <div>
          <h1>{t('Alimentação & Dieta')}</h1>
          <div className="sub">{t('Controle de alimentos, calorias e macronutrientes')}</div>
        </div>
        <Button
          size="sm"
          variant="tinted"
          icon="target"
          onClick={dietTargetsSheet}
        >
          {t('Metas')}
        </Button>
        <Button
          size="sm"
          variant="primary"
          icon="sparkles"
          onClick={aiDietSheet}
        >
          {t('AI')}
        </Button>
      </div>

      {/* Date Switcher */}
      <div className="card" style={{ padding: '10px 14px', marginBottom: 12 }}>
        <div className="row between">
          <button
            className="iconbtn"
            style={{ width: 32, height: 32 }}
            onClick={() => changeDay(-1)}
            aria-label={t('Previous day')}
          >
            <Icon name="chevronLeft" />
          </button>
          <div style={{ textAlign: 'center', cursor: 'pointer' }} onClick={() => setDateIso(todayISO())}>
            <div style={{ fontWeight: 600, fontSize: 16 }}>{displayDate()}</div>
            <div className="small dim">{fmtDate(dateIso, true)}</div>
          </div>
          <button
            className="iconbtn"
            style={{ width: 32, height: 32 }}
            onClick={() => changeDay(1)}
            aria-label={t('Next day')}
          >
            <Icon name="chevronRight" />
          </button>
        </div>
      </div>

      {/* Calories & Macros Overview Card */}
      <div className="card">
        <div className="row between" style={{ marginBottom: 6 }}>
          <div className="row" style={{ gap: 8 }}>
            <span
              className="lrow-i"
              style={{
                background: 'color-mix(in srgb, var(--acc) 18%, transparent)',
                color: 'var(--acc)',
              }}
            >
              <Icon name="diet" />
            </span>
            <div>
              <h2 style={{ margin: 0 }}>{t('Calories & Macros')}</h2>
              <div className="small dim">
                {calRemaining >= 0
                  ? t('{0} kcal remaining to reach goal', fmtNum(calRemaining))
                  : t('{0} kcal over daily target', fmtNum(Math.abs(calRemaining)))}
              </div>
            </div>
          </div>
          <span
            className="tag"
            style={{
              background: calRemaining < 0 ? 'color-mix(in srgb, var(--orange) 20%, transparent)' : 'color-mix(in srgb, var(--acc) 20%, transparent)',
              color: calRemaining < 0 ? 'var(--orange)' : 'var(--acc)',
              fontWeight: 600,
            }}
          >
            {fmtNum(totals.calories)} / {fmtNum(calTarget)} kcal
          </span>
        </div>

        {/* Calories Progress Bar */}
        <div
          style={{
            height: 10,
            background: 'var(--surface-3)',
            borderRadius: 5,
            overflow: 'hidden',
            margin: '8px 0 14px',
          }}
        >
          <div
            style={{
              height: '100%',
              width: `${calPct}%`,
              background: calRemaining < 0 ? 'var(--orange)' : 'var(--acc)',
              borderRadius: 5,
              transition: 'width 0.25s ease-out',
            }}
          />
        </div>

        {/* 3 Macro Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, textAlign: 'center' }}>
          <div className="card" style={{ margin: 0, padding: 10, background: 'var(--surface-2)' }}>
            <div className="small" style={{ color: 'var(--acc)', fontWeight: 600 }}>{t('Protein')}</div>
            <div style={{ fontSize: 20, fontWeight: 700, margin: '2px 0' }}>
              {totals.protein} <span className="small dim" style={{ fontSize: 13, fontWeight: 400 }}>/ {protTarget}g</span>
            </div>
            <div style={{ height: 4, background: 'var(--surface-3)', borderRadius: 2, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${protPct}%`, background: 'var(--acc)' }} />
            </div>
          </div>

          <div className="card" style={{ margin: 0, padding: 10, background: 'var(--surface-2)' }}>
            <div className="small" style={{ color: 'var(--yellow)', fontWeight: 600 }}>{t('Carbs')}</div>
            <div style={{ fontSize: 20, fontWeight: 700, margin: '2px 0' }}>
              {totals.carbs} <span className="small dim" style={{ fontSize: 13, fontWeight: 400 }}>/ {carbsTarget}g</span>
            </div>
            <div style={{ height: 4, background: 'var(--surface-3)', borderRadius: 2, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${carbsPct}%`, background: 'var(--yellow)' }} />
            </div>
          </div>

          <div className="card" style={{ margin: 0, padding: 10, background: 'var(--surface-2)' }}>
            <div className="small" style={{ color: 'var(--red)', fontWeight: 600 }}>{t('Fat')}</div>
            <div style={{ fontSize: 20, fontWeight: 700, margin: '2px 0' }}>
              {totals.fat} <span className="small dim" style={{ fontSize: 13, fontWeight: 400 }}>/ {fatTarget}g</span>
            </div>
            <div style={{ height: 4, background: 'var(--surface-3)', borderRadius: 2, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${fatPct}%`, background: 'var(--red)' }} />
            </div>
          </div>
        </div>
      </div>

      {/* 3. Meals of the Day */}
      <div className="row between" style={{ margin: '14px 0 8px' }}>
        <h4 className="sec" style={{ margin: 0 }}>{t('Meals')}</h4>
        <Button
          size="sm"
          variant="primary"
          icon="plus"
          onClick={() => foodPickerSheet('lunch', dateIso)}
        >
          {t('Add food')}
        </Button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {MEAL_TYPES.map(mType => {
          const mealsInType = dayLog.meals.filter(m => m.type === mType.id)
          const mealTotals = calcDayTotals(mealsInType)

          return (
            <div key={mType.id} className="card" style={{ margin: 0 }}>
              <div className="row between" style={{ marginBottom: mealsInType.length ? 10 : 0 }}>
                <div className="row" style={{ gap: 8 }}>
                  <span
                    className="lrow-i"
                    style={{
                      width: 30,
                      height: 30,
                      fontSize: 14,
                      background: 'var(--surface-3)',
                    }}
                  >
                    <Icon name={mType.icon} />
                  </span>
                  <div>
                    <h3 style={{ margin: 0, fontSize: 16 }}>{t(mType.label)}</h3>
                    {mealsInType.length > 0 && (
                      <div className="small dim">
                        <b>{mealTotals.calories} kcal</b> · P: {mealTotals.protein}g · C: {mealTotals.carbs}g · F: {mealTotals.fat}g
                      </div>
                    )}
                  </div>
                </div>

                <Button
                  size="sm"
                  variant="tinted"
                  icon="plus"
                  onClick={() => foodPickerSheet(mType.id, dateIso)}
                >
                  {t('Add')}
                </Button>
              </div>

              {mealsInType.length > 0 && (
                <div className="list" style={{ marginTop: 6, gap: 4 }}>
                  {mealsInType.map(meal => (
                    <div
                      key={meal.id}
                      className="item"
                      style={{ padding: '8px 10px', background: 'var(--surface-2)', borderRadius: 10 }}
                      onClick={() => mealSheet(meal, mType.id, dateIso)}
                    >
                      <div className="grow">
                        <div className="row between">
                          <b style={{ fontSize: 14 }}>{meal.name}</b>
                          <span style={{ fontWeight: 600, color: 'var(--label-1)' }}>
                            {meal.calories} <span className="small dim">kcal</span>
                          </span>
                        </div>
                        <div className="row between small dim" style={{ marginTop: 2 }}>
                          <span>{meal.portion ? `${meal.portion} · ` : ''}{meal.time}</span>
                          <span>
                            <span style={{ color: 'var(--acc)' }}>P:{meal.protein}g</span> ·{' '}
                            <span style={{ color: 'var(--yellow)' }}>C:{meal.carbs}g</span> ·{' '}
                            <span style={{ color: 'var(--red)' }}>F:{meal.fat}g</span>
                          </span>
                        </div>
                      </div>
                      <Icon name="pencil" className="chev" style={{ opacity: 0.5, fontSize: 14 }} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>

      <div style={{ height: 24 }} />
    </div>
  )
}
