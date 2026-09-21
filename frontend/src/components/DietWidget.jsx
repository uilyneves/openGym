import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import { getDiet, getDayLog, calcDayTotals, addWater } from '../lib/diet.js'
import { fmtNum, todayISO } from '../lib/format.js'
import { t } from '../lib/i18n.js'
import Icon from './Icon.jsx'
import { Button } from './ui.jsx'

export default function DietWidget() {
  const nav = useNavigate()
  const S = useStore(s => s.S)
  const update = useStore(s => s.update)

  const today = todayISO()
  const diet = getDiet(S)
  const dayLog = getDayLog(S, today)
  const totals = calcDayTotals(dayLog.meals)

  const waterTarget = diet.waterTarget || 2500
  const waterPct = Math.min(100, Math.round((dayLog.water / waterTarget) * 100))

  const calTarget = diet.calorieTarget || 2200
  const calPct = Math.min(100, Math.round((totals.calories / calTarget) * 100))
  const protTarget = diet.proteinTarget || 140

  return (
    <div className="card">
      <div className="row between" style={{ marginBottom: 10 }}>
        <div className="row" style={{ gap: 8 }}>
          <span
            className="lrow-i"
            style={{
              background: 'color-mix(in srgb, var(--sky) 16%, transparent)',
              color: 'var(--sky)',
            }}
          >
            <Icon name="water" />
          </span>
          <div>
            <h2 style={{ margin: 0, fontSize: 17 }}>{t('Diet & Hydration')}</h2>
            <div className="small dim">{t('Today’s nutrition & water')}</div>
          </div>
        </div>
        <Button
          size="sm"
          variant="ghost"
          trailingIcon="chevronRight"
          onClick={() => nav('/diet')}
        >
          {t('Open')}
        </Button>
      </div>

      {/* Water Row with 1-tap buttons */}
      <div
        style={{
          background: 'var(--surface-2)',
          borderRadius: 12,
          padding: '10px 12px',
          marginBottom: 10,
        }}
      >
        <div className="row between" style={{ marginBottom: 6 }}>
          <div className="row" style={{ gap: 6 }}>
            <Icon name="water" style={{ color: 'var(--sky)', fontSize: 16 }} />
            <span style={{ fontWeight: 600, fontSize: 14 }}>{t('Water')}</span>
            <span className="small dim">
              <b>{fmtNum(dayLog.water)}</b> / {fmtNum(waterTarget)} ml
            </span>
          </div>
          <span
            className="tag"
            style={{
              background: 'color-mix(in srgb, var(--sky) 20%, transparent)',
              color: 'var(--sky)',
              fontWeight: 600,
              fontSize: 12,
            }}
          >
            {waterPct}%
          </span>
        </div>

        <div
          style={{
            height: 6,
            background: 'var(--surface-3)',
            borderRadius: 3,
            overflow: 'hidden',
            marginBottom: 8,
          }}
        >
          <div
            style={{
              height: '100%',
              width: `${waterPct}%`,
              background: 'var(--sky)',
              borderRadius: 3,
              transition: 'width 0.25s ease-out',
            }}
          />
        </div>

        <div className="row between" style={{ gap: 6 }}>
          <div className="row" style={{ gap: 6 }}>
            <Button
              size="sm"
              variant="tinted"
              icon="cup"
              style={{ fontSize: 13, padding: '4px 10px', height: 32 }}
              onClick={() => addWater(update, 250, today)}
            >
              +250ml
            </Button>
            <Button
              size="sm"
              variant="tinted"
              icon="water"
              style={{ fontSize: 13, padding: '4px 10px', height: 32 }}
              onClick={() => addWater(update, 500, today)}
            >
              +500ml
            </Button>
          </div>
          {dayLog.water > 0 && (
            <button
              className="iconbtn"
              style={{ width: 32, height: 32, color: 'var(--label-3)' }}
              onClick={() => addWater(update, -250, today)}
              title="-250ml"
              aria-label="-250ml"
            >
              <Icon name="minus" />
            </button>
          )}
        </div>
      </div>

      {/* Calories & Macros Row */}
      <div
        className="tappable"
        onClick={() => nav('/diet')}
        style={{
          background: 'var(--surface-2)',
          borderRadius: 12,
          padding: '10px 12px',
          cursor: 'pointer',
        }}
      >
        <div className="row between" style={{ marginBottom: 6 }}>
          <div className="row" style={{ gap: 6 }}>
            <Icon name="diet" style={{ color: 'var(--acc)', fontSize: 16 }} />
            <span style={{ fontWeight: 600, fontSize: 14 }}>{t('Calories')}</span>
            <span className="small dim">
              <b>{fmtNum(totals.calories)}</b> / {fmtNum(calTarget)} kcal
            </span>
          </div>
          <span className="small" style={{ color: 'var(--acc)', fontWeight: 600 }}>
            {totals.protein} / {protTarget}g {t('Protein')}
          </span>
        </div>

        <div
          style={{
            height: 6,
            background: 'var(--surface-3)',
            borderRadius: 3,
            overflow: 'hidden',
            marginBottom: 6,
          }}
        >
          <div
            style={{
              height: '100%',
              width: `${calPct}%`,
              background: 'var(--acc)',
              borderRadius: 3,
              transition: 'width 0.25s ease-out',
            }}
          />
        </div>

        <div className="row between small dim">
          <span>{dayLog.meals.length} {t(dayLog.meals.length === 1 ? 'food logged' : 'foods logged')}</span>
          <span style={{ color: 'var(--acc)', fontWeight: 500 }}>{t('View & log meals →')}</span>
        </div>
      </div>
    </div>
  )
}
