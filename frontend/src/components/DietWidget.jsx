import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import { getDiet, getDayLog, calcDayTotals } from '../lib/diet.js'
import { todayISO, fmtNum } from '../lib/format.js'
import { t } from '../lib/i18n.js'
import Icon from './Icon.jsx'
import { Button } from './ui.jsx'

export default function DietWidget() {
  const nav = useNavigate()
  const S = useStore(s => s.S)
  const today = todayISO()

  const diet = getDiet(S)
  const dayLog = getDayLog(S, today)
  const totals = calcDayTotals(dayLog.meals)

  const calTarget = diet.calorieTarget || 2200
  const calPct = Math.min(100, Math.round((totals.calories / calTarget) * 100))

  const protTarget = diet.proteinTarget || 140
  const protPct = Math.min(100, Math.round((totals.protein / protTarget) * 100))

  return (
    <div className="card">
      <div className="row between" style={{ marginBottom: 10 }}>
        <div
          className="row"
          style={{ gap: 8, cursor: 'pointer' }}
          onClick={() => nav('/diet')}
        >
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
            <div style={{ fontWeight: 600, fontSize: 16 }}>{t('Alimentação')}</div>
            <div className="small dim">
              {fmtNum(totals.calories)} / {fmtNum(calTarget)} kcal
            </div>
          </div>
        </div>
        <Button
          size="sm"
          variant="tinted"
          icon="plus"
          onClick={() => nav('/diet')}
        >
          {t('Registrar')}
        </Button>
      </div>

      {/* Calories Progress Bar */}
      <div
        style={{
          height: 6,
          background: 'var(--surface-3)',
          borderRadius: 3,
          overflow: 'hidden',
          marginBottom: 10,
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

      {/* Macros Preview */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
        <div style={{ background: 'var(--surface-2)', padding: '6px 10px', borderRadius: 8 }}>
          <div className="small dim">Proteína</div>
          <div style={{ fontWeight: 700, fontSize: 14 }}>
            {totals.protein}g <span className="small dim">/ {protTarget}g</span>
          </div>
        </div>
        <div style={{ background: 'var(--surface-2)', padding: '6px 10px', borderRadius: 8 }}>
          <div className="small dim">Carboidrato</div>
          <div style={{ fontWeight: 700, fontSize: 14 }}>
            {totals.carbs}g <span className="small dim">/ {diet.carbsTarget || 250}g</span>
          </div>
        </div>
        <div style={{ background: 'var(--surface-2)', padding: '6px 10px', borderRadius: 8 }}>
          <div className="small dim">Gordura</div>
          <div style={{ fontWeight: 700, fontSize: 14 }}>
            {totals.fat}g <span className="small dim">/ {diet.fatTarget || 65}g</span>
          </div>
        </div>
      </div>
    </div>
  )
}
