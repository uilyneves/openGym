import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { todayISO, formatDay } from '../lib/format.js'
import { calcDietSummary } from '../lib/diet.js'
import { supabase } from '../integrations/supabase/client.js'
import { Btn, Card, Row } from '../components/ui.jsx'
import Icon from '../components/Icon.jsx'

export default function Water() {
  const nav = useNavigate()
  const S = useStore(s => s.S)
  const addWater = useStore(s => s.addWater)
  const setWaterTarget = useStore(s => s.setWaterTarget)
  const openSheet = useUI(s => s.openSheet)
  const toast = useUI(s => s.toast)

  const [date, setDate] = useState(todayISO())
  const [syncedLogs, setSyncedLogs] = useState([])
  const [loadingSync, setLoadingSync] = useState(false)

  const currentSummary = calcDietSummary(S, date)
  const target = S?.dietTargets?.waterMl || 3000
  const consumed = currentSummary.waterConsumed
  const pct = Math.min(100, Math.round((consumed / target) * 100))

  const handleLog = async (ml) => {
    addWater(ml, date)
    toast(`+${ml}ml de água registrado!`)
    try {
      await supabase.from('water_logs').insert([{
        date: date,
        amount_ml: ml
      }])
    } catch (e) {
      console.warn('Erro ao sincronizar água com Supabase:', e)
    }
  }

  // Carrega histórico remoto do Supabase para o dia
  useEffect(() => {
    async function loadRemoteWater() {
      setLoadingSync(true)
      try {
        const { data, error } = await supabase
          .from('water_logs')
          .select('*')
          .eq('date', date)
          .order('created_at', { ascending: false })
        if (!error && data) {
          setSyncedLogs(data)
        }
      } catch (err) {
        console.warn('Erro buscando dados remotos de água:', err)
      } finally {
        setLoadingSync(false)
      }
    }
    loadRemoteWater()
  }, [date])

  return (
    <div className="pad view-enter" style={{ paddingBottom: 'calc(var(--tabbar-h, 60px) + 30px)' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '8px 0 16px' }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ color: 'var(--acc)' }}><Icon name="water" size={26} /></span>
            Hidratação
          </h1>
          <div style={{ fontSize: 13, color: 'var(--label-2)', marginTop: 2 }}>
            Controle de consumo de água e histórico diário
          </div>
        </div>
        <Btn variant="ghost" icon="sparkles" onClick={() => nav('/ai')}>
          Coach IA
        </Btn>
      </div>

      {/* Seletor de Data */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--surface)', padding: '8px 12px', borderRadius: 14, marginBottom: 16 }}>
        <button
          onClick={() => {
            const d = new Date(date)
            d.setDate(d.getDate() - 1)
            setDate(d.toISOString().slice(0, 10))
          }}
          style={{ background: 'none', border: 'none', color: 'var(--fg)', cursor: 'pointer', padding: 8 }}
        >
          <Icon name="arrowLeft" />
        </button>
        <span style={{ fontWeight: 600, fontSize: 15 }}>{date === todayISO() ? 'Hoje' : formatDay(date)}</span>
        <button
          onClick={() => {
            const d = new Date(date)
            d.setDate(d.getDate() + 1)
            setDate(d.toISOString().slice(0, 10))
          }}
          style={{ background: 'none', border: 'none', color: 'var(--fg)', cursor: 'pointer', padding: 8 }}
        >
          <Icon name="arrowRight" />
        </button>
      </div>

      {/* Cartão de Destaque / Progresso de Hidratação */}
      <Card style={{ padding: '20px 16px', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
        <div style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: `${pct}%`,
          background: 'var(--acc)',
          opacity: 0.12,
          transition: 'height 0.4s ease',
          pointerEvents: 'none'
        }} />

        <div style={{ fontSize: 44, fontWeight: 800, color: 'var(--acc)', letterSpacing: -1 }}>
          {consumed} <span style={{ fontSize: 20, fontWeight: 600, color: 'var(--fg)' }}>/ {target} ml</span>
        </div>

        <div style={{ fontSize: 14, color: 'var(--label-2)', marginTop: 4 }}>
          {pct >= 100 ? '🎉 Meta diária atingida! Excelente hidratação!' : `Faltam ${Math.max(0, target - consumed)} ml para sua meta`}
        </div>

        {/* Barra de Progresso */}
        <div style={{ height: 10, background: 'var(--surface-3)', borderRadius: 5, overflow: 'hidden', margin: '16px 0 8px' }}>
          <div style={{ height: '100%', width: `${pct}%`, background: 'var(--acc)', borderRadius: 5, transition: 'width 0.3s' }} />
        </div>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--acc)' }}>{pct}% Concluído</div>
      </Card>

      {/* Ações Rápidas de Ingestão */}
      <div style={{ margin: '20px 0 12px', fontSize: 15, fontWeight: 600, color: 'var(--label-2)' }}>
        Adicionar Água
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
        <button
          onClick={() => handleLog(250)}
          style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            padding: '16px 8px', borderRadius: 14, border: '1px solid var(--sep)', background: 'var(--surface)',
            cursor: 'pointer', gap: 6, color: 'var(--fg)'
          }}
        >
          <Icon name="water" size={24} style={{ color: 'var(--acc)' }} />
          <span style={{ fontWeight: 700, fontSize: 16 }}>+250 ml</span>
          <span style={{ fontSize: 12, color: 'var(--label-3)' }}>Copo</span>
        </button>

        <button
          onClick={() => handleLog(500)}
          style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            padding: '16px 8px', borderRadius: 14, border: '1px solid var(--sep)', background: 'var(--surface)',
            cursor: 'pointer', gap: 6, color: 'var(--fg)'
          }}
        >
          <Icon name="water" size={26} style={{ color: 'var(--acc)' }} />
          <span style={{ fontWeight: 700, fontSize: 16 }}>+500 ml</span>
          <span style={{ fontSize: 12, color: 'var(--label-3)' }}>Garrafa</span>
        </button>

        <button
          onClick={() => openSheet('addWater', { date })}
          style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            padding: '16px 8px', borderRadius: 14, border: '1px solid var(--sep)', background: 'var(--surface)',
            cursor: 'pointer', gap: 6, color: 'var(--fg)'
          }}
        >
          <Icon name="plus" size={24} style={{ color: 'var(--label-2)' }} />
          <span style={{ fontWeight: 700, fontSize: 16 }}>Outro</span>
          <span style={{ fontSize: 12, color: 'var(--label-3)' }}>Personalizado</span>
        </button>
      </div>

      {/* Meta e Ajustes */}
      <div style={{ marginTop: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--label-2)' }}>Configurações de Hidratação</span>
          <Btn variant="ghost" size="sm" onClick={() => openSheet('dietTargets')}>
            Ajustar Meta
          </Btn>
        </div>
        <Card>
          <Row label="Meta Diária de Água" value={`${target} ml`} />
          <Row label="Banco de Dados Supabase" value={loadingSync ? 'Sincronizando...' : 'Conectado (PostgreSQL)'} />
        </Card>
      </div>
    </div>
  )
}
