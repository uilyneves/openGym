import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import { fmtNum } from '../lib/format.js'
import { isAIConnected } from '../lib/ai.js'
import { evaluateWeightLoss, aiEvaluateWeightLoss } from '../lib/aiPlanner.js'
import { getDiet } from '../lib/diet.js'
import Icon from '../components/Icon.jsx'
import { Button } from '../components/ui.jsx'

const STATUS = {
  otimo: { label: 'Ritmo excelente', color: 'var(--green)', icon: 'checkCircle' },
  excelente: { label: 'Excelente', color: 'var(--green)', icon: 'checkCircle' },
  bom: { label: 'Bom ritmo', color: 'var(--acc)', icon: 'checkCircle' },
  atencao: { label: 'Atenção', color: 'var(--yellow)', icon: 'info' },
  critico: { label: 'Crítico', color: 'var(--red)', icon: 'bolt' },
  estagnado: { label: 'Estagnado', color: 'var(--yellow)', icon: 'pause' },
  'sem-dados': { label: 'Sem dados', color: 'var(--label-3)', icon: 'info' }
}

function Metric({ icon, label, value, hint, accent }) {
  return <div className="card" style={{ padding: '12px 14px', flex: '1 1 130px', minWidth: 130 }}>
    <div className="row" style={{ gap: 6, marginBottom: 4 }}>
      <Icon name={icon} style={{ fontSize: 14, color: accent || 'var(--label-3)' }} />
      <span className="small muted" style={{ fontWeight: 500 }}>{label}</span>
    </div>
    <div style={{ fontSize: 20, fontWeight: 600, lineHeight: 1.2 }}>{value}</div>
    {hint && <div className="small dim" style={{ fontSize: 11, marginTop: 2 }}>{hint}</div>}
  </div>
}

function ListBlock({ icon, title, items, color }) {
  if (!items?.length) return null
  return <div style={{ marginTop: 12 }}>
    <div className="row" style={{ gap: 6, marginBottom: 6 }}>
      <Icon name={icon} style={{ fontSize: 14, color }} />
      <span className="small" style={{ fontWeight: 600 }}>{title}</span>
    </div>
    {items.map((x, i) => <div key={i} className="small" style={{ padding: '4px 0 4px 20px', lineHeight: 1.5, color: 'var(--label-2)' }}>• {x}</div>)}
  </div>
}

export default function WeightLossEval() {
  const nav = useNavigate()
  const S = useStore(s => s.S)
  const diet = getDiet(S)
  const [verdict, setVerdict] = useState(null)
  const [loading, setLoading] = useState(false)

  const m = evaluateWeightLoss(S)
  const st = STATUS[m.status] || STATUS['sem-dados']
  const hasData = m.weighIns >= 2

  const runAI = async () => {
    setLoading(true)
    try { setVerdict(await aiEvaluateWeightLoss(S)) } finally { setLoading(false) }
  }

  const vSt = verdict ? (STATUS[verdict.status] || STATUS.bom) : null

  return <div className="narrow">
    <div className="hdr">
      <div><h1>Avaliação de Emagrecimento</h1><div className="sub">Diagnóstico completo da sua evolução corporal</div></div>
      <button className="iconbtn" onClick={() => nav('/ai')} aria-label="IA Coach" title="IA Coach"><Icon name="sparkles" /></button>
    </div>

    {!hasData && <div className="card">
      <div className="empty"><div className="ico"><Icon name="scale" /></div>
        Registre pelo menos 2 pesagens para desbloquear a avaliação.<br />A pesagem semanal consistente é a base de todo o acompanhamento.
      </div>
      <Button variant="primary" icon="plus" onClick={() => nav('/home')}>Ir para o registro de peso</Button>
    </div>}

    {hasData && <>
      {/* Resumo do processo */}
      <div className="card">
        <div className="row between" style={{ marginBottom: 10 }}>
          <div className="row" style={{ gap: 9 }}>
            <span className="lrow-i"><Icon name="scale" /></span>
            <div>
              <h2 style={{ margin: 0 }}>Seu processo</h2>
              <div className="small dim">{m.weighIns} pesagens · {m.spanDays} dias de acompanhamento</div>
            </div>
          </div>
          <span className="tag" style={{ color: st.color, background: `color-mix(in srgb, ${st.color} 16%, transparent)` }}>
            <Icon name={st.icon} style={{ fontSize: 11 }} />{st.label}
          </span>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <Metric icon="scale" label="Peso atual" value={`${fmtNum(m.last)} kg`} hint={m.first != null ? `inicial: ${fmtNum(m.first)} kg` : ''} />
          <Metric icon="arrowDown" label="Perda total" value={m.totalLost != null ? `${m.totalLost > 0 ? '−' : '+'}${fmtNum(Math.abs(m.totalLost))} kg` : '—'} hint={m.pctLost != null ? `${Math.abs(m.pctLost)}% do peso inicial` : ''} accent="var(--green)" />
          <Metric icon="chartLine" label="Ritmo médio" value={m.avgRate != null ? `${fmtNum(Math.abs(m.avgRate))} kg/sem` : '—'} hint="faixa saudável: 0,25–1,0" />
          <Metric icon="bolt" label="Tendência recente" value={m.trend != null ? `${m.trend > 0 ? '+' : m.trend < 0 ? '−' : ''}${fmtNum(Math.abs(m.trend))} kg/sem` : '—'} hint="últimas pesagens" accent={m.trend != null && m.trend < 0 ? 'var(--green)' : 'var(--yellow)'} />
          <Metric icon="target" label="Para a meta" value={m.remaining != null ? (m.remaining > 0 ? `${fmtNum(m.remaining)} kg` : 'Conquistada!') : 'sem meta'} hint={m.etaWeeks ? `~${m.etaWeeks} semanas no ritmo atual` : S.targetW ? 'defina ritmo com a IA' : 'defina em Home › Meta'} accent="var(--yellow)" />
          {m.bmi != null && <Metric icon="calc" label="IMC" value={fmtNum(m.bmi)} hint={m.bmi < 18.5 ? 'abaixo do peso' : m.bmi < 25 ? 'peso normal' : m.bmi < 30 ? 'sobrepeso' : 'obesidade'} />}
          <Metric icon="dumbbell" label="Aderência treino" value={`${m.workoutAdherence}%`} hint={`${m.workouts28} treinos em 28 dias`} />
          <Metric icon="flame" label="Aderência dieta" value={m.dietAdherence != null ? `${m.dietAdherence}%` : '—'} hint={m.kcalAvg != null ? `média ${m.kcalAvg} / ${diet.calorieTarget} kcal` : 'sem registros'} />
        </div>
      </div>

      {/* Análise da IA */}
      <div className="card">
        <div className="row between" style={{ marginBottom: 8 }}>
          <div className="row" style={{ gap: 9 }}>
            <span className="lrow-i" style={{ background: 'color-mix(in srgb, var(--acc) 18%, transparent)', color: 'var(--acc)' }}><Icon name="sparkles" /></span>
            <div>
              <h2 style={{ margin: 0 }}>Análise do desenvolvimento</h2>
              <div className="small dim">Diagnóstico inteligente do seu processo de emagrecimento</div>
            </div>
          </div>
        </div>

        {!verdict && <Button variant="primary" icon={loading ? 'timer' : 'sparkles'} disabled={loading} onClick={runAI}>
          {loading ? 'Analisando sua evolução…' : isAIConnected() ? 'Analisar com IA' : 'Analisar minha evolução'}
        </Button>}
        {!verdict && !loading && <div className="muted small" style={{ marginTop: 8, lineHeight: 1.5 }}>
          {isAIConnected()
            ? 'A IA cruza peso, treinos, alimentação e hidratação para calificar seu processo e sugerir os próximos passos.'
            : 'Modo demonstração: análise local pelas suas métricas. Conecte o OmniRoute na aba IA Coach para diagnósticos completos com IA.'}
        </div>}

        {verdict && <>
          <div className="row between" style={{ marginBottom: 6 }}>
            <div className="row" style={{ gap: 8 }}>
              <span className="tag" style={{ color: vSt.color, background: `color-mix(in srgb, ${vSt.color} 16%, transparent)`, fontSize: 13 }}>
                <Icon name={vSt.icon} style={{ fontSize: 12 }} />{verdict.score}/100
              </span>
              <strong>{verdict.title}</strong>
            </div>
            <span className="tag">{verdict.source === 'ai' ? 'IA' : 'Local'}</span>
          </div>
          <div className="small" style={{ lineHeight: 1.6, color: 'var(--label-2)' }}>{verdict.summary}</div>
          <ListBlock icon="checkCircle" title="Pontos fortes" items={verdict.strengths} color="var(--green)" />
          <ListBlock icon="info" title="Pontos de atenção" items={verdict.warnings} color="var(--yellow)" />
          <ListBlock icon="lightbulb" title="Próximas ações" items={verdict.actions} color="var(--acc)" />
          {verdict.suggestedCalories > 0 && <div className="row between" style={{ marginTop: 14, padding: 10, background: 'var(--surface-2)', borderRadius: 12 }}>
            <div className="small"><strong>Calorias sugeridas pela IA:</strong> {verdict.suggestedCalories} kcal/dia<br /><span className="dim">atual: {diet.calorieTarget} kcal</span></div>
            <Button size="sm" variant="tinted" icon="check" onClick={() => {
              useStore.getState().update(s => { s.diet = { ...s.diet, calorieTarget: verdict.suggestedCalories } })
              setVerdict({ ...verdict, suggestedCalories: 0 })
            }}>Aplicar</Button>
          </div>}
          {verdict.error && <div className="small" style={{ marginTop: 8, color: 'var(--yellow)' }}>IA indisponível ({verdict.error}) — exibindo análise local.</div>}
          <div style={{ height: 8 }} />
          <Button variant="ghost" className="dim" icon="reset" disabled={loading} onClick={runAI}>Reanalisar</Button>
        </>}
      </div>

      {/* Atalhos de ação */}
      <div className="card">
        <h2 style={{ margin: '0 0 8px' }}>Acelere seu resultado</h2>
        <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
          <Button size="sm" variant="tinted" icon="utensils" onClick={() => nav('/diet')}>Ajustar dieta</Button>
          <Button size="sm" variant="tinted" icon="dumbbell" onClick={() => nav('/plan')}>Revisar treino</Button>
          <Button size="sm" variant="tinted" icon="sparkles" onClick={() => nav('/ai')}>Falar com o coach</Button>
        </div>
      </div>
    </>}
  </div>
}
