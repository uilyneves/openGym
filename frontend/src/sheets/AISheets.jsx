import { useState, useEffect } from 'react'
import { useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { exOr } from '../lib/exercises.js'
import { DAYN } from '../lib/format.js'
import { t } from '../lib/i18n.js'
import { isAIConnected, aiConfig, saveAIConfig, saveAIConfigToCloud, testAIConnection, syncAIConfigFromCloud, DEFAULT_MODELS } from '../lib/ai.js'
import { nav } from '../lib/nav.js'
import { generateWorkoutPlan, generateDietPlan, applyWorkoutPlan, applyDietPlan, getFitnessProfile, profileMissing, saveFitnessProfile, syncFitnessProfileFromCloud } from '../lib/aiPlanner.js'
import Icon from '../components/Icon.jsx'
import { Button, NumberField, TextField, Segmented } from '../components/ui.jsx'

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
  const [profileTick, setProfileTick] = useState(0)
  const profileOk = profileMissing().length === 0

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
      {!profileOk && <QuickProfileCard key={profileTick} onSaved={() => setProfileTick(t => t + 1)} />}
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
  const [profileTick, setProfileTick] = useState(0)
  const profileOk = profileMissing().length === 0

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
      {!profileOk && <QuickProfileCard key={'d' + profileTick} onSaved={() => setProfileTick(t => t + 1)} />}
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

/* =========================================================================
   QUICK PROFILE — the AI can't personalize without a body to personalize for.
   Shown inline in the generators whenever core anamnesis fields are missing.
   ========================================================================= */
export function QuickProfileCard({ onSaved }) {
  const toast = useUI(s => s.toast)
  const p = getFitnessProfile()
  const [weight, setWeight] = useState(p.weightKg ? Number(p.weightKg) : null)
  const [height, setHeight] = useState(p.heightCm ? Number(p.heightCm) : null)
  const [age, setAge] = useState(p.age ? Number(p.age) : null)
  const [gender, setGender] = useState(p.gender || 'masculino')
  const [goal, setGoal] = useState(p.fitnessGoal || 'emagrecimento')
  const [injuries, setInjuries] = useState(p.injuries || '')
  const [showMore, setShowMore] = useState(false)
  const [saving, setSaving] = useState(false)
  const missing = profileMissing(p)

  useEffect(() => {
    syncFitnessProfileFromCloud().then(prof => {
      if (prof) {
        if (weight == null && prof.weightKg) setWeight(Number(prof.weightKg))
        if (height == null && prof.heightCm) setHeight(Number(prof.heightCm))
        if (age == null && prof.age) setAge(Number(prof.age))
        if (prof.gender) setGender(prof.gender)
        if (prof.fitnessGoal) setGoal(prof.fitnessGoal)
        if (prof.injuries) setInjuries(prof.injuries)
      }
    })
  }, [])

  const save = async () => {
    if (!weight || !height || !age) { toast('Preencha peso, altura e idade para a IA personalizar seu plano.'); return }
    setSaving(true)
    try {
      await saveFitnessProfile({
        weightKg: weight,
        heightCm: height,
        age,
        gender,
        fitnessGoal: goal,
        injuries: injuries.trim()
      })
      toast('Perfil salvo! A IA já vai usar seus dados.')
      onSaved && onSaved()
    } finally { setSaving(false) }
  }

  return <div className="card" style={{ padding: 14, background: 'color-mix(in srgb, var(--yellow) 8%, var(--surface-2))' }}>
    <div className="row between" style={{ marginBottom: 8 }}>
      <div className="row" style={{ gap: 8 }}>
        <Icon name="personCircle" style={{ color: 'var(--yellow)', fontSize: 18 }} />
        <strong style={{ fontSize: 14 }}>Complete seu perfil para a IA</strong>
      </div>
      <Button variant="ghost" size="sm" onClick={() => setShowMore(m => !m)} style={{ fontSize: 11, padding: '2px 6px' }}>
        {showMore ? 'Menos' : '+ Detalhes'}
      </Button>
    </div>
    <div className="muted small" style={{ marginBottom: 10 }}>
      {missing.length === 4
        ? 'A IA precisa de alguns dados seus para montar algo realmente personalizado.'
        : `Faltando: ${missing.map(f => ({ weightKg: 'peso', heightCm: 'altura', age: 'idade', fitnessGoal: 'objetivo' }[f])).join(', ')}.`}
    </div>
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      <div style={{ flex: '1 1 80px' }}>
        <div className="sub" style={{ marginBottom: 4 }}>Peso (kg)</div>
        <NumberField decimal value={weight} onChange={setWeight} />
      </div>
      <div style={{ flex: '1 1 80px' }}>
        <div className="sub" style={{ marginBottom: 4 }}>Altura (cm)</div>
        <NumberField decimal value={height} onChange={setHeight} />
      </div>
      <div style={{ flex: '1 1 70px' }}>
        <div className="sub" style={{ marginBottom: 4 }}>Idade</div>
        <NumberField decimal={false} value={age} onChange={setAge} />
      </div>
    </div>
    <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
      <div style={{ flex: '1 1 120px' }}>
        <div className="sub" style={{ marginBottom: 4 }}>Gênero</div>
        <Segmented value={gender} onChange={setGender} options={[
          { value: 'masculino', label: 'Masc' },
          { value: 'feminino', label: 'Fem' }
        ]} />
      </div>
      <div style={{ flex: '1 1 160px' }}>
        <div className="sub" style={{ marginBottom: 4 }}>Objetivo</div>
        <Segmented value={goal} onChange={setGoal} options={[
          { value: 'emagrecimento', label: 'Secar' },
          { value: 'hipertrofia', label: 'Massa' },
          { value: 'saude', label: 'Saúde' }
        ]} />
      </div>
    </div>
    {showMore && (
      <div style={{ marginTop: 10 }}>
        <div className="sub" style={{ marginBottom: 4 }}>Lesões ou limitações (opcional)</div>
        <TextField value={injuries} onChange={setInjuries} placeholder="Ex: dor no joelho direito, hérnia de disco..." />
      </div>
    )}
    <div style={{ marginTop: 12, display: 'flex', justifyContent: 'flex-end' }}>
      <Button variant="primary" size="sm" icon="check" disabled={saving} onClick={save}>{saving ? 'Salvando…' : 'Salvar perfil'}</Button>
    </div>
  </div>
}

/* =========================================================================
   OMNIROUTE CONFIG — shared by the IA Coach panel and Settings › Data.
   Local + cloud persistence and a real "test connection" round-trip.
   ========================================================================= */
const inputSt = { width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--sep)', background: 'var(--surface)', color: 'var(--fg)' }
const labelSt = { fontSize: 12, fontWeight: 600, color: 'var(--label-2)', display: 'block', marginBottom: 4 }

export function AIConfigForm({ onSaved }) {
  const toast = useUI(s => s.toast)
  const cfg = aiConfig()
  const [apiKey, setApiKey] = useState(cfg.apiKey)
  const [endpoint, setEndpoint] = useState(cfg.endpoint)
  const [model, setModel] = useState(cfg.model)
  const [customModel, setCustomModel] = useState('')
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState(null)

  const activeModel = customModel.trim() || model

  const save = async () => {
    saveAIConfig({ apiKey, endpoint, model: activeModel })
    await saveAIConfigToCloud({ apiKey: apiKey.trim(), endpoint: endpoint.trim(), model: activeModel })
    toast('Integração OmniRoute salva neste dispositivo e na sua conta!')
    setTestResult(null)
    onSaved && onSaved()
  }

  const test = async () => {
    // Tests exactly what will be used: persists first, pings, reports back.
    saveAIConfig({ apiKey, endpoint, model: activeModel })
    setTesting(true); setTestResult(null)
    const r = await testAIConnection()
    setTesting(false); setTestResult(r)
  }

  return <>
    <div style={{ marginBottom: 10 }}>
      <label style={labelSt}>Chave de API (OmniRoute / OpenAI / DeepSeek)</label>
      <input type="password" value={apiKey} placeholder="Ex: sk-omniroute-..." onChange={e => setApiKey(e.target.value)} style={inputSt} />
    </div>
    <div style={{ marginBottom: 10 }}>
      <label style={labelSt}>Endpoint da API</label>
      <input type="text" value={endpoint} placeholder="https://api.omniroute.ai/v1" onChange={e => setEndpoint(e.target.value)} style={inputSt} />
    </div>
    <div style={{ marginBottom: 10 }}>
      <label style={labelSt}>Modelo de IA</label>
      <select value={model} onChange={e => setModel(e.target.value)} style={inputSt}>
        {DEFAULT_MODELS.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
      </select>
    </div>
    <div style={{ marginBottom: 12 }}>
      <label style={labelSt}>Ou digite outro modelo customizado</label>
      <input type="text" value={customModel} placeholder="Ex: o1, claude-3-haiku, mistral-large..." onChange={e => setCustomModel(e.target.value)} style={inputSt} />
    </div>
    {testResult && (
      <div className="small" style={{ marginBottom: 12, padding: 10, borderRadius: 10, lineHeight: 1.5, color: testResult.ok ? 'var(--green)' : 'var(--red)', background: `color-mix(in srgb, ${testResult.ok ? 'var(--green)' : 'var(--red)'} 10%, transparent)` }}>
        {testResult.ok
          ? <><Icon name="checkCircle" style={{ fontSize: 13, verticalAlign: -2 }} /> Conectado! Resposta em {testResult.ms}ms com <strong>{activeModel}</strong>: “{testResult.answer}”</>
          : <><Icon name="bolt" style={{ fontSize: 13, verticalAlign: -2 }} /> Falha na conexão: {testResult.error}. Confira a chave, o endpoint e o modelo.</>}
      </div>
    )}
    <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
      <Button size="sm" icon={testing ? 'timer' : 'bolt'} disabled={testing || !apiKey.trim()} onClick={test}>{testing ? 'Testando…' : 'Testar conexão'}</Button>
      <Button variant="primary" size="sm" icon="check" onClick={save}>Salvar</Button>
    </div>
  </>
}

export function AIConfigSheet({ close }) {
  // Pull cloud credentials first so the form starts filled on a fresh device.
  const [ready, setReady] = useState(false)
  useEffect(() => { syncAIConfigFromCloud().finally(() => setReady(true)) }, [])
  return <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
    <div className="row between">
      <div>
        <h3 style={{ margin: 0 }}>Integração OmniRoute (IA)</h3>
        <div className="small dim">Chave única para Coach, treinos, dieta e avaliações</div>
      </div>
      <Icon name="sparkles" style={{ color: 'var(--acc)' }} />
    </div>
    {ready
      ? <AIConfigForm onSaved={close} />
      : <div className="muted small" style={{ padding: 8 }}>Buscando credenciais da sua conta…</div>}
  </div>
}
