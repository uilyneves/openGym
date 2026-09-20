import { useState } from 'react'
import { useStore } from '../store/useStore.js'
import { t } from '../lib/i18n.js'
import { DEFAULT_PLATES, BAR_WEIGHTS, calcPlates, plateStyle } from '../lib/plates.js'
import { fmtNum } from '../lib/format.js'
import { Button, NumberField } from './ui.jsx'
import Icon from './Icon.jsx'

export default function PlateCalculator({ initialWeight = 60, close }) {
  const S = useStore(s => s.S)
  const unit = S.unit || 'kg'
  const defaultBar = unit === 'lb' ? 45 : 20
  const availableBars = BAR_WEIGHTS[unit] || BAR_WEIGHTS.kg
  const defaultPlateList = DEFAULT_PLATES[unit] || DEFAULT_PLATES.kg

  const [target, setTarget] = useState(initialWeight || defaultBar)
  const [bar, setBar] = useState(defaultBar)
  const [plates, setPlates] = useState(defaultPlateList)

  const result = calcPlates(target, bar, plates)

  const togglePlate = p => {
    if (plates.includes(p)) {
      if (plates.length > 1) setPlates(plates.filter(x => x !== p))
    } else {
      setPlates([...plates, p].sort((a, b) => b - a))
    }
  }

  // Visual plate heights based on denomination
  const plateHeight = p => {
    if (unit === 'kg') {
      if (p >= 25) return 96
      if (p >= 20) return 96
      if (p >= 15) return 86
      if (p >= 10) return 76
      if (p >= 5) return 60
      if (p >= 2.5) return 48
      return 38
    } else {
      if (p >= 45) return 96
      if (p >= 35) return 88
      if (p >= 25) return 78
      if (p >= 10) return 64
      if (p >= 5) return 50
      return 40
    }
  }

  const plateWidth = p => {
    if (p >= 20) return 18
    if (p >= 10) return 15
    if (p >= 5) return 13
    return 11
  }

  return (
    <div className="plate-calc">
      <div className="row between" style={{ alignItems: 'baseline' }}>
        <h3 style={{ margin: 0 }}>{t('Plate Calculator')}</h3>
        <span className="muted small">{unit.toUpperCase()}</span>
      </div>

      <div className="row" style={{ gap: 10, alignItems: 'center' }}>
        <div style={{ flex: 1 }}>
          <div className="sub" style={{ marginBottom: 4 }}>{t('Target weight')}</div>
          <div className="row" style={{ gap: 6 }}>
            <div className="grow">
              <NumberField
                value={target}
                decimal={true}
                onChange={v => setTarget(Math.max(0, v || 0))}
              />
            </div>
            <Button size="sm" onClick={() => setTarget(t => Math.max(0, Math.round((t - 2.5) * 10) / 10))}>-2.5</Button>
            <Button size="sm" onClick={() => setTarget(t => Math.round((t + 2.5) * 10) / 10)}>+2.5</Button>
            <Button size="sm" onClick={() => setTarget(t => Math.round((t + 5) * 10) / 10)}>+5</Button>
          </div>
        </div>
      </div>

      {/* Bar selection */}
      <div>
        <div className="sub" style={{ marginBottom: 6 }}>{t('Barbell weight')}</div>
        <div className="chips">
          {availableBars.map(b => (
            <button
              key={b.w}
              className={'chip' + (bar === b.w ? ' on' : '')}
              onClick={() => setBar(b.w)}
            >
              {b.w} {unit}
            </button>
          ))}
        </div>
      </div>

      {/* Visual barbell side */}
      <div className="plate-vis-wrap">
        <div className="plate-barbell">
          <div className="plate-shaft" />
          <div className="plate-collar" />
          <div className="plate-sleeve">
            {result.perSide.map(item => {
              const st = plateStyle(item.plate)
              const h = plateHeight(item.plate)
              const w = plateWidth(item.plate)
              return Array.from({ length: item.count }).map((_, idx) => (
                <div
                  key={`${item.plate}-${idx}`}
                  className="plate-disc"
                  style={{
                    height: h,
                    width: w,
                    background: st.bg,
                    color: st.text,
                    borderColor: st.border,
                  }}
                  title={`${item.plate} ${unit}`}
                />
              ))
            })}
          </div>
        </div>
        <div className="small dim" style={{ marginTop: 8 }}>
          {t('One side of the barbell shown')}
        </div>
      </div>

      {/* Results breakdown */}
      <div className="card" style={{ margin: 0 }}>
        <div className="row between" style={{ marginBottom: 6 }}>
          <span style={{ fontWeight: 600 }}>{t('Each side')}:</span>
          <span className="accent" style={{ fontWeight: 700, fontSize: 18 }}>
            {fmtNum(result.weightPerSide)} {unit}
          </span>
        </div>

        {result.perSide.length > 0 ? (
          <div className="plate-row" style={{ marginTop: 8 }}>
            {result.perSide.map(item => (
              <span key={item.plate} className="plate-badge">
                <span
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: '50%',
                    background: plateStyle(item.plate).bg,
                    display: 'inline-block',
                  }}
                />
                <b>{item.count}×</b> {item.plate} {unit}
              </span>
            ))}
          </div>
        ) : (
          <div className="muted small" style={{ marginTop: 4 }}>
            {target < bar
              ? t('Target is lighter than the empty barbell')
              : t('Empty barbell (no plates needed)')}
          </div>
        )}

        {!result.exact && result.remaining > 0 && (
          <div className="warn small" style={{ marginTop: 10 }}>
            {t('Cannot reach exact target with chosen plates. Nearest total: {0} {1} ({2} {3} difference).',
              fmtNum(result.totalOnBar), unit, fmtNum(result.remaining), unit)}
          </div>
        )}
      </div>

      {/* Available plates toggle */}
      <div>
        <div className="sub" style={{ marginBottom: 6 }}>{t('Available plates')}</div>
        <div className="chips">
          {defaultPlateList.map(p => {
            const on = plates.includes(p)
            return (
              <button
                key={p}
                className={'chip' + (on ? ' on' : '')}
                onClick={() => togglePlate(p)}
              >
                {p} {unit}
              </button>
            )
          })}
        </div>
      </div>

      <div style={{ height: 8 }} />
      <Button variant="primary" onClick={close}>{t('Done')}</Button>
    </div>
  )
}
