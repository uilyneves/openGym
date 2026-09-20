import { useState } from 'react'
import { useStore } from '../store/useStore.js'
import { estimate1RM, FORMULAS } from '../lib/onerm.js'
import { fmtNum } from '../lib/format.js'
import { t } from '../lib/i18n.js'
import { NumberField, Button } from './ui.jsx'

const PERCENTAGES = [
  { pct: 95, reps: '~2 reps' },
  { pct: 90, reps: '~4 reps' },
  { pct: 85, reps: '~6 reps' },
  { pct: 80, reps: '~8 reps' },
  { pct: 75, reps: '~10 reps' },
  { pct: 70, reps: '~12 reps' },
  { pct: 65, reps: '~15 reps' },
  { pct: 60, reps: '~20 reps' },
]

export default function OneRMCalculator({ initialWeight = 80, initialReps = 5, close }) {
  const S = useStore(s => s.S)
  const unit = S.unit || 'kg'
  const [w, setW] = useState(initialWeight)
  const [r, setR] = useState(initialReps)

  const est = estimate1RM(w, r) || 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div className="row between" style={{ alignItems: 'baseline' }}>
        <h3 style={{ margin: 0 }}>{t('1RM Calculator')}</h3>
        <span className="muted small">{t('Estimated One-Rep Max')}</span>
      </div>

      <div className="grid2">
        <div>
          <div className="sub" style={{ marginBottom: 4 }}>{t('Weight ({0})', unit)}</div>
          <NumberField decimal value={w} onChange={v => setW(Math.max(0, v || 0))} />
        </div>
        <div>
          <div className="sub" style={{ marginBottom: 4 }}>{t('Reps (1–12)')}</div>
          <NumberField decimal={false} value={r} onChange={v => setR(Math.min(12, Math.max(1, Math.round(v || 1))))} />
        </div>
      </div>

      <div className="card" style={{ margin: 0, textAlign: 'center', background: 'var(--surface-2)', padding: '16px 12px' }}>
        <div className="small dim">{t('Estimated 1RM')}</div>
        <div className="stat-v" style={{ fontSize: 36, fontWeight: 700, color: 'var(--acc)', margin: '4px 0' }}>
          {est > 0 ? `${fmtNum(est)} ${unit}` : '—'}
        </div>
        <div className="small dim">{t('Calculated using the standard Epley equation')}</div>
      </div>

      {est > 0 && (
        <div className="card" style={{ margin: 0 }}>
          <h4 className="sec" style={{ marginTop: 0, marginBottom: 8 }}>{t('Training percentages')}</h4>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 12px' }}>
            {PERCENTAGES.map(item => {
              const targetW = Math.round((est * (item.pct / 100)) * 2) / 2
              return (
                <div key={item.pct} className="row between small" style={{ padding: '4px 0', borderBottom: 'var(--hair) solid var(--sep)' }}>
                  <span className="muted"><b>{item.pct}%</b> <span className="dim">({item.reps})</span></span>
                  <span style={{ fontWeight: 600 }}>{fmtNum(targetW)} {unit}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {close && <Button variant="primary" onClick={close}>{t('Done')}</Button>}
    </div>
  )
}
