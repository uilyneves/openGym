import { useState } from 'react'
import { useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { exOr } from '../lib/exercises.js'
import { DAYN } from '../lib/format.js'
import { t } from '../lib/i18n.js'
import { isAIConnected } from '../lib/ai.js'
import { nav } from '../lib/nav.js'
import { generateWorkoutPlan, generateDietPlan, applyWorkoutPlan, applyDietPlan, getFitnessProfile } from '../lib/aiPlanner.js'
import Icon from '../components/Icon.jsx'
import { Button, TextField, Segmented } from '../components/ui.jsx'

// Shared pieces -----------------------------------------------------------
function SourceBadge({ source }) {
  return source === 'ai'
    ? <span className="tag acc"><Icon name="sparkles" style={{ fontSize: 11 }} />Gerado pela IA</span>
    : <span className="tag"><Icon name="bolt" style={{ fontSize: 11 }} />Demonstração local</span>
}

function LoadingBtn({ loading, children, ...props }) {
  return <Button variant="primary" icon={loading ? 'timer' : 'sparkles'} disabled={loading} {...props}>
    {loading ? 'Analisando seu perfil…' : children}
  </Button>
}

/* =========================================================================
   WORKOUT PLAN GENERATOR — preferences → AI (or local) plan → 1-click apply
   ========================================================================= */
export function AIWorkoutSheet({ close }) {
  const S = useStore(s => s.S)
  const toast = useUI(s => s.toast)
  const [goal, setGoal] = useState('maintain')
  const [days, setDays] = useState(4)
  const [equip, setEquip] = useState('gym')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)

  const generate = async () => {
    setLoading(true)
    try {
      const r = await generateWorkoutPlan(S, { goal, days, equipment: equip, notes })
      setResult(r)
    } catch (e) {
      toast('Erro: ' + e.message)
    } finally { setLoading(false) }
  }

  const apply = () => {
    applyWorkoutPlan(result.plan)
    close()
    toast(t('AI workout plan applied!'))
    nav('/plan')
  }

  return <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
    <div className="row between">
      <h3 style={{ margin: 0 }}>Montar treino com IA</h3>
      <Icon name="dumbbell" className="muted" />
    </div>

    {!result && <>
      <div>
        <div className="sub" style={{ marginBottom: 4 }}>Objetivo</div>
        <Segmented value={goal} onChange={setGoal} options={[
          { value: 'cutting', label: 'Emagrecer' },
          { value: 'bulk', label: 'Hipertrofia' },
          { value: 'maintain', label: 'Manter' },
          { value: 'strength', label: 'Força' }
        ]} />
      </div>
      <div>
        <div className="sub" style={{ marginBottom: 4 }}>Treinos por semana</div>
        <Segmented value={days} onChange={setDays} options={[2, 3, 4, 5, 6].map(d => ({ value: d, label: String(d) }))} />
      </div>
      <div>
        <div className="sub" style={{ marginBottom: 4 }}>Onde você treina</div>
        <Segmented value={equip} onChange={setEquip} options={[
          { value: 'gym', label: 'Academia' },
          { value: 'dumbbells', label: 'Halteres' },
          { value: 'home', label: 'Casa' }
        ]} />
      </div>
      <TextField value={notes} onChange={setNotes} placeholder="Observações (opcional): foco em braços, apenas 45min por sessão…" />
      {!isAIConnected() && <div className="muted small">Sem chave OmniRoute configurada — será gerado um plano demonstração local. Configure na aba IA Coach para planos 100% personalizados.</div>}
      <LoadingBtn loading={loading} onClick={generate}>Gerar plano de treino</LoadingBtn>
    </>}

    {result && <>
      <div className="row between">
        <span className="small muted">{result.plan.length} treinos · {result.plan.reduce((a, r) => a + r.ex.length, 0)} exercícios</span>
        <SourceBadge source={result.source} />
      </div>
      {result.plan.map((r, i) => <div key={i} className="card" style={{ padding: 12, background: 'var(--surface-2)' }}>
        <div className="row between" style={{ marginBottom: 6 }}>
          <div className="row" style={{ gap: 8 }}>
            <span className="lrow-i" style={{ width: 28, height: 28 }}><Icon name={r.emoji === 'legs' ? 'legs' : r.emoji === 'pullup' ? 'pullup' : r.emoji === 'flame' ? 'flame' : 'barbell'} /></span>
            <strong>{r.name}</strong>
          </div>
          {!!r.days.length && <span className="tag">{r.days.map(d => t(DAYN[d]).slice(0, 3)).join(' · ')}</span>}
        </div>
        {r.ex.map((e, j) => {
          const ex = exOr(e.id)
          return <div key={j} className="row between small" style={{ padding: '3px 0' }}>
            <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{j + 1}. {ex.n}</span>
            <span className="muted">{e.sets}×{e.reps}</span>
          </div>
        })}
      </div>)}
      <LoadingBtn loading={false} onClick={apply}>Aplicar no meu plano</LoadingBtn>
      <Button variant="ghost" className="dim" onClick={() => setResult(null)}>Ajustar preferências</Button>
    </>}
  </div>
}

/* =========================================================================
   DIET PLAN GENERATOR — preferences → AI (or local) plan → 1-click apply
   ========================================================================= */
export function AIDietSheet({ close }) {
  const S = useStore(s => s.S)
  const toast = useUI(s => s.toast)
  const [goal, setGoal] = useState('cutting')
  const [nMeals, setNMeals] = useState(4)
  const [prefs, setPrefs] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)

  const generate = async () => {
    setLoading(true)
    try {
      const r = await generateDietPlan(S, { goal, meals: nMeals, notes: prefs })
      setResult(r)
    } catch (e) {
      toast('Erro: ' + e.message)
    } finally { setLoading(false) }
  }

  const apply = withMeals => {
    applyDietPlan(result.plan, { applyMealsToday: withMeals })
    close()
    toast(withMeals ? 'Plano alimentar aplicado e registrado em hoje!' : 'Metas nutricionais atualizadas!')
    nav('/diet')
  }

  const p = getFitnessProfile()
  const tg = result?.plan.targets

  return <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
    <div className="row between">
      <h3 style={{ margin: 0 }}>Montar alimentação com IA</h3>
      <Icon name="utensils" className="muted" />
    </div>

    {!result && <>
      <div>
        <div className="sub" style={{ marginBottom: 4 }}>Objetivo</div>
        <Segmented value={goal} onChange={setGoal} options={[
          { value: 'cutting', label: 'Emagrecer' },
          { value: 'maintain', label: 'Manter' },
          { value: 'bulk', label: 'Ganhar massa' }
        ]} />
      </div>
      <div>
        <div className="sub" style={{ marginBottom: 4 }}>Refeições por dia</div>
        <Segmented value={nMeals} onChange={setNMeals} options={[3, 4, 5, 6].map(n => ({ value: n, label: String(n) }))} />
      </div>
      <TextField value={prefs} onChange={setPrefs} placeholder={`Preferências (opcional)${p.restrictions ? ' · suas restrições: ' + p.restrictions : ': sem lactose, vegetariano…'}`} />
      {!isAIConnected() && <div className="muted small">Sem chave OmniRoute configurada — será gerado um plano demonstração equilibrado. Configure na aba IA Coach para planos 100% personalizados.</div>}
      <LoadingBtn loading={loading} onClick={generate}>Gerar plano alimentar</LoadingBtn>
    </>}

    {result && <>
      <div className="row between">
        <span className="small muted">{result.plan.meals.length} refeições · {result.plan.kcalSum} kcal/dia</span>
        <SourceBadge source={result.source} />
      </div>
      <div className="card" style={{ padding: 12, background: 'var(--surface-2)' }}>
        <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
          <span className="tag acc">{tg.calorieTarget} kcal</span>
          <span className="tag">P {tg.proteinTarget}g</span>
          <span className="tag">C {tg.carbsTarget}g</span>
          <span className="tag">G {tg.fatTarget}g</span>
          <span className="tag"><Icon name="drop" style={{ fontSize: 11, verticalAlign: -2 }} />{tg.waterTarget}ml</span>
        </div>
      </div>
      {result.plan.meals.map((m, i) => <div key={i} className="card" style={{ padding: 12, background: 'var(--surface-2)' }}>
        <div className="row between" style={{ marginBottom: 4 }}>
          <strong className="small">{m.time && <span className="muted">{m.time} · </span>}{m.name}</strong>
          <span className="tag">{m.calories} kcal</span>
        </div>
        <div className="muted small">{m.portion}</div>
        <div className="small" style={{ marginTop: 4, color: 'var(--acc)' }}>P {m.protein}g · C {m.carbs}g · G {m.fat}g</div>
      </div>)}
      {result.plan.notes && <div className="muted small" style={{ lineHeight: 1.5 }}><Icon name="lightbulb" style={{ fontSize: 12, verticalAlign: -2 }} /> {result.plan.notes}</div>}
      <LoadingBtn loading={false} onClick={() => apply(true)}>Aplicar metas + refeições de hoje</LoadingBtn>
      <Button onClick={() => apply(false)}>Aplicar somente as metas</Button>
      <Button variant="ghost" className="dim" onClick={() => setResult(null)}>Ajustar preferências</Button>
    </>}
  </div>
}
