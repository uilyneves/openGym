import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { supabase } from '../integrations/supabase/client.js'
import { aiConfig, syncAIConfigFromCloud, aiChat, isAIConnected } from '../lib/ai.js'
import { buildBodyContext, profileMissing } from '../lib/aiPlanner.js'
import { aiWorkoutSheet, aiDietSheet } from '../sheets.jsx'
import { AIConfigForm } from '../sheets/AISheets.jsx'
import { Button } from '../components/ui.jsx'
import Icon from '../components/Icon.jsx'

// Ações de 1 toque — o coach não é só conversa: ele monta e aplica planas reais.
const ACTIONS = [
  { key: 'workout', icon: 'dumbbell', title: 'Montar treino', sub: 'Plano semanal completo', run: aiWorkoutSheet },
  { key: 'diet', icon: 'utensils', title: 'Montar dieta', sub: 'Macros + cardápio do dia', run: aiDietSheet },
]

// Comandos rápidos — um toque já manda o prompt pronto.
const QUICK_PROMPTS = [
  'Como está meu processo de emagrecimento?',
  'Ajuste minhas calorias para acelerar a queima de gordura',
  'Monte um treino de 3 dias para emagrecer',
  'O que comer antes e depois do treino?',
  'Estou em platô, o que faço?'
]

export default function AICoach() {
  const nav = useNavigate()
  const S = useStore(s => s.S)
  const toast = useUI(s => s.toast)

  // Configurações OmniRoute (compartilhadas com todos os recursos de IA do app)
  const cfg = aiConfig()
  const [model, setModel] = useState(cfg.model)
  const [customModel, setCustomModel] = useState('')
  const [showConfig, setShowConfig] = useState(!cfg.apiKey)
  const [connected, setConnected] = useState(!!cfg.apiKey)
  const profileOk = profileMissing().length === 0
  const activeModel = customModel.trim() || aiConfig().model

  // Fresh device / new session: pull the OmniRoute credentials this user saved
  // in the cloud so every AI feature is live without asking again.
  useEffect(() => {
    if (!cfg.apiKey) {
      syncAIConfigFromCloud().then(c => {
        if (c) {
          setModel(c.model)
          setConnected(true); setShowConfig(false)
          toast('Integração OmniRoute restaurada da sua conta!')
        }
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Mensagens do Chat
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [listening, setListening] = useState(false)
  const scrollRef = useRef(null)
  const recRef = useRef(null)

  // Carregar histórico do Supabase
  useEffect(() => {
    async function loadChatHistory() {
      try {
        const { data, error } = await supabase
          .from('ai_chat_messages')
          .select('*')
          .order('created_at', { ascending: true })
          .limit(50)

        if (!error && data && data.length > 0) {
          setMessages(data.map(m => ({ id: m.id, role: m.role, content: m.content, model: m.model_used })))
        } else {
          setMessages([{
            id: 'welcome',
            role: 'assistant',
            content: 'Olá! Sou seu treinador e nutricionista pessoal com IA via **OmniRoute**.\n\nPosso te ajudar a:\n- Montar e ajustar treino e dieta (com aplicação em 1 toque);\n- Avaliar seu processo de emagrecimento;\n- Calcular macros, hidratação e calorias;\n- Tirar dúvidas de execução e recuperação.\n\nComo posso te ajudar hoje?',
            model: 'OmniRoute Assistant'
          }])
        }
      } catch (e) {
        console.warn('Erro ao carregar mensagens:', e)
      }
    }
    loadChatHistory()
  }, [])

  // Auto-scroll para a última mensagem
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [messages, loading])

  // Salvar configurações de IA (local + nuvem) — delegado ao formulário compartilhado
  const onConfigSaved = () => {
    const c = aiConfig()
    setModel(c.model); setCustomModel('')
    setConnected(!!c.apiKey)
    setShowConfig(false)
  }

  // ---- comando de voz (Web Speech API, pt-BR) com fallback silencioso ----
  const toggleVoice = () => {
    if (listening) { recRef.current?.stop(); return }
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR) { toast('Reconhecimento de voz não suportado neste navegador.'); return }
    const rec = new SR()
    recRef.current = rec
    rec.lang = 'pt-BR'
    rec.interimResults = false
    rec.onresult = e => { setInput(e.results[0][0].transcript) }
    rec.onend = () => setListening(false)
    rec.onerror = () => { setListening(false); toast('Não consegui ouvir. Tente novamente.') }
    setListening(true)
    rec.start()
  }

  const persist = async (role, content, modelUsed) => {
    try { await supabase.from('ai_chat_messages').insert([{ role, content, model_used: modelUsed }]) } catch {}
  }

  // Enviar mensagem para o OmniRoute
  const sendMessage = (preset) => {
    const text = (preset || input).trim()
    if (!text || loading) return

    const activeModel = customModel.trim() || aiConfig().model
    setMessages(prev => [...prev, { id: Date.now().toString(), role: 'user', content: text, model: activeModel }])
    setInput('')
    setLoading(true)
    persist('user', text, activeModel)

    const systemPrompt = `Você é um treinador de elite e nutricionista esportivo pessoal com IA, integrado ao openGym via OmniRoute.
Responda sempre em Português do Brasil com clareza, empatia, base científica e formatação limpa.

${buildBodyContext(S)}

Ao montar ou sugerir treinos e dietas:
1. Respeite estritamente lesões, limitações e restrições alimentares do atleta.
2. Adapte calorias e macros ao peso, altura, idade e objetivo (cutting/bulking/manutenção).
3. Especifique séries, repetições, RPE/RIR e descanso quando montar rotinas.
4. Se o atleta pedir um plano completo, sugira usar os botões "Montar treino" e "Montar dieta" que aplicam tudo com 1 toque.`

    const respond = async (answer) => {
      setMessages(prev => [...prev, { id: (Date.now() + 1).toString(), role: 'assistant', content: answer, model: activeModel }])
      setLoading(false)
      await persist('assistant', answer, activeModel)
    }

    if (!isAIConnected()) {
      // Modo demonstração assistido caso a chave ainda não tenha sido inserida
      setTimeout(() => {
        const lower = text.toLowerCase()
        let responseText
        if (lower.includes('emagrec') || lower.includes('peso') || lower.includes('gordura')) {
          responseText = `Sobre emagrecimento: o openGym já calcula tudo para você.\n\n- **Ritmo saudável:** 0,5 a 1% do peso por semana;\n- **Proteína:** 1,8–2,2g/kg para preservar músculo;\n- **Déficit:** 300–500 kcal/dia é o ponto de partida ideal.\n\nUse a aba **Avaliação** (ou peça "Avaliar meu emagrecimento") para um diagnóstico completo com projeção até sua meta.\n\n💡 Conecte sua chave OmniRoute no botão **Configurar** para análises ilimitadas com IA real.`
        } else if (lower.includes('dieta') || lower.includes('calor') || lower.includes('prote') || lower.includes('comer')) {
          responseText = `Para uma divisão equilibrada focada em resultados:\n\n- **Proteínas:** 1,6–2,2g por kg para síntese proteica;\n- **Carboidratos:** energia para treinar pesado e repor glicogênio;\n- **Gorduras:** mínimo 0,8g/kg para saúde hormonal.\n\nToque em **Montar dieta** aqui em cima e a IA monta seu cardápio completo com aplicação em 1 toque!\n\n💡 *Configure sua chave OmniRoute para planos 100% personalizados.*`
        } else if (lower.includes('agua') || lower.includes('hidrata')) {
          responseText = `Hidratação: **35–45ml por kg** de peso corporal ao dia. No openGym você registra cada copo na aba **Hidratação**.\n\n💡 *Conecte o OmniRoute no botão Configurar para conversar com GPT-4o, Claude, Gemini e mais.*`
        } else {
          responseText = `Entendido! Foque em progressão de carga (sobrecarga progressiva), descanso de 2–3min nas séries pesadas e sono de 7–9h.\n\n🔗 Conecte sua chave em **Configurar** para conversar ilimitadamente com o modelo **${activeModel}**!`
        }
        respond(responseText)
      }, 800)
      return
    }

    (async () => {
      try {
        const answer = await aiChat(
          messages.slice(-8).map(m => ({ role: m.role, content: m.content })).concat([{ role: 'user', content: text }]),
          { system: systemPrompt, temperature: 0.7 }
        )
        await respond(answer || 'Não foi possível obter uma resposta do modelo.')
      } catch (err) {
        console.error('Erro na chamada OmniRoute:', err)
        setMessages(prev => [...prev, {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: `⚠️ Erro ao consultar o OmniRoute (${activeModel}): ${err.message}. Verifique sua chave e endpoint em Configurar.`,
          model: activeModel
        }])
        setLoading(false)
      }
    })()
  }

  const inputStyle = {
    flex: 1, padding: '12px 14px', borderRadius: 12, border: '1px solid var(--sep)',
    background: 'var(--surface)', color: 'var(--fg)', fontSize: 14, outline: 'none'
  }

  return (
    <div className="pad view-enter" style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - var(--tabbar-h, 60px) - 20px)' }}>
      {/* Topo do Chat */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 12, borderBottom: '1px solid var(--sep)' }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ color: 'var(--acc)' }}><Icon name="sparkles" size={24} /></span>
            Coach IA
          </h1>
          <div style={{ fontSize: 12, color: 'var(--label-2)', marginTop: 2, display: 'flex', alignItems: 'center', gap: 6 }}>
            <span className="dot" style={{ width: 8, height: 8, borderRadius: 99, background: connected ? 'var(--green)' : 'var(--yellow)', display: 'inline-block' }} />
            {connected
              ? <>OmniRoute: <strong>{customModel.trim() || model}</strong></>
              : <span style={{ color: 'var(--yellow)' }}>Modo demonstração — configure sua chave</span>}
          </div>
        </div>
        <Button variant="ghost" size="sm" icon="gear" onClick={() => setShowConfig(!showConfig)}>
          {showConfig ? 'Fechar' : 'Configurar'}
        </Button>
      </div>

      {/* Painel de Configuração do OmniRoute (formulário compartilhado com Configurações) */}
      {showConfig && (
        <div className="card" style={{ margin: '12px 0', padding: 14, background: 'var(--surface-2)' }}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8, color: 'var(--acc)' }}>
            Integração OmniRoute / OpenAI API
          </div>
          <AIConfigForm onSaved={onConfigSaved} />
        </div>
      )}

      {/* Action Cards — IA aplicando de verdade */}
      <div style={{ display: 'flex', gap: 8, padding: '12px 0 4px', flexWrap: 'wrap' }}>
        {ACTIONS.map(a => (
          <button key={a.key} className="card" onClick={a.run} style={{ flex: '1 1 140px', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', textAlign: 'left', minWidth: 140 }}>
            <span className="lrow-i" style={{ background: 'color-mix(in srgb, var(--acc) 18%, transparent)', color: 'var(--acc)' }}><Icon name={a.icon} /></span>
            <span style={{ minWidth: 0 }}>
              <span style={{ display: 'block', fontWeight: 600, fontSize: 13 }}>{a.title}</span>
              <span className="small dim" style={{ fontSize: 11 }}>{a.sub}</span>
            </span>
          </button>
        ))}
        <button className="card" onClick={() => nav('/eval')} style={{ flex: '1 1 140px', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', textAlign: 'left', minWidth: 140 }}>
          <span className="lrow-i" style={{ background: 'color-mix(in srgb, var(--green) 18%, transparent)', color: 'var(--green)' }}><Icon name="chartLine" /></span>
          <span style={{ minWidth: 0 }}>
            <span style={{ display: 'block', fontWeight: 600, fontSize: 13 }}>Avaliar emagrecimento</span>
            <span className="small dim" style={{ fontSize: 11 }}>Diagnóstico da evolução</span>
          </span>
        </button>
        <button className="card" onClick={() => nav('/profile')} style={{ flex: '1 1 140px', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', textAlign: 'left', minWidth: 140 }}>
          <span className="lrow-i" style={{ background: profileOk ? 'color-mix(in srgb, var(--teal) 16%, transparent)' : 'color-mix(in srgb, var(--yellow) 20%, transparent)', color: profileOk ? 'var(--teal)' : 'var(--yellow)' }}><Icon name="personCircle" /></span>
          <span style={{ minWidth: 0 }}>
            <span style={{ display: 'block', fontWeight: 600, fontSize: 13 }}>Meu perfil</span>
            <span className="small dim" style={{ fontSize: 11 }}>{profileOk ? 'Completo para a IA' : 'Faltam dados — toque'}</span>
          </span>
        </button>
      </div>

      {/* A IA só personaliza de verdade com anamnese completa */}
      {!profileOk && (
        <div className="card" style={{ padding: '10px 12px', background: 'color-mix(in srgb, var(--yellow) 8%, var(--surface-2))', display: 'flex', alignItems: 'center', gap: 10 }}>
          <Icon name="personCircle" style={{ color: 'var(--yellow)', fontSize: 18 }} />
          <div className="small grow" style={{ minWidth: 0 }}>
            <strong>Complete seu perfil</strong> — peso, altura, idade e objetivo deixam as respostas, treinos e dietas muito mais precisos.
          </div>
          <Button size="sm" variant="tinted" onClick={() => nav('/profile')}>Preencher</Button>
        </div>
      )}

      {/* Lista de Mensagens */}
      <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '12px 0', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {messages.map(m => {
          const isUser = m.role === 'user'
          return (
            <div key={m.id} style={{
              alignSelf: isUser ? 'flex-end' : 'flex-start', maxWidth: '88%',
              background: isUser ? 'var(--acc)' : 'var(--surface)', color: isUser ? 'var(--bg-black, #fff)' : 'var(--fg)',
              padding: '12px 14px', borderRadius: 14,
              borderBottomRightRadius: isUser ? 2 : 14, borderBottomLeftRadius: isUser ? 14 : 2,
              boxShadow: '0 1px 3px rgba(0,0,0,0.08)', whiteSpace: 'pre-wrap', lineHeight: 1.5, fontSize: 14
            }}>
              {!isUser && (
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--acc)', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Icon name="sparkles" size={13} /> {m.model || 'OmniRoute IA'}
                </div>
              )}
              {m.content}
            </div>
          )
        })}
        {loading && (
          <div style={{ alignSelf: 'flex-start', background: 'var(--surface)', padding: '10px 14px', borderRadius: 14, fontSize: 13, color: 'var(--label-2)' }}>
            Pensando com {customModel.trim() || model}...
          </div>
        )}
      </div>

      {/* Comandos rápidos */}
      <div className="chips" style={{ overflowX: 'auto', paddingBottom: 6, flexWrap: 'nowrap' }}>
        {QUICK_PROMPTS.map(q => <button key={q} className="chip" onClick={() => sendMessage(q)} style={{ whiteSpace: 'nowrap' }}>{q}</button>)}
      </div>

      {/* Caixa de Entrada (texto + voz) */}
      <div style={{ display: 'flex', gap: 8, paddingTop: 8, borderTop: '1px solid var(--sep)' }}>
        <button className={'iconbtn' + (listening ? ' rec' : '')} onClick={toggleVoice} aria-label="Comando de voz" title="Comando de voz" style={{ color: listening ? 'var(--red)' : 'var(--label-2)' }}>
          <Icon name="mic" />
        </button>
        <input
          type="text" value={input} placeholder="Pergunte sobre dieta, treino, suplementação..."
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') sendMessage() }}
          style={inputStyle}
        />
        <Button variant="primary" onClick={() => sendMessage()} disabled={loading || !input.trim()}>
          <Icon name="arrowUp" />
        </Button>
      </div>
    </div>
  )
}
