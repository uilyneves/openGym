import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import { getDiet, getDayLog } from '../lib/diet.js'
import { todayISO, fmtNum } from '../lib/format.js'
import { t } from '../lib/i18n.js'
import Icon from './Icon.jsx'
import { Button } from './ui.jsx'

export default function HydrationWidget() {
  const nav = useNavigate()
  const S = useStore(s => s.S)
  const addWater = useStore(s => s.addWater)
  const update = useStore(s => s.update)
  const today = todayISO()

  const diet = getDiet(S)
  const dayLog = getDayLog(S, today)
  const waterTarget = diet.waterTarget || 2500
  const waterPct = Math.min(100, Math.round((dayLog.water / waterTarget) * 100))

  return (
    <div className="card">
      <div className="row between" style={{ marginBottom: 8 }}>
        <div
          className="row"
          style={{ gap: 8, cursor: 'pointer' }}
          onClick={() => nav('/water')}
        >
          <span
            className="lrow-i"
            style={{
              background: 'color-mix(in srgb, var(--sky) 18%, transparent)',
              color: 'var(--sky)',
            }}
          >
            <Icon name="water" />
          </span>
          <div>
            <div style={{ fontWeight: 600, fontSize: 16 }}>{t('Hidratação')}</div>
            <div className="small dim">
              {fmtNum(dayLog.water)} / {fmtNum(waterTarget)} ml
            </div>
          </div>
        </div>
        <span
          className="tag"
          style={{
            background: 'color-mix(in srgb, var(--sky) 20%, transparent)',
            color: 'var(--sky)',
            fontWeight: 600,
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
          marginBottom: 10,
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
        <Button
          size="sm"
          variant="ghost"
          style={{ fontSize: 13, height: 32 }}
          onClick={() => nav('/water')}
        >
          {t('Ver tudo')}
        </Button>
      </div>
    </div>
  )
}
