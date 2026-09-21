import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { supabase } from '../integrations/supabase/client.js'
import { Btn, Card, TextField } from '../components/ui.jsx'
import Icon from '../components/Icon.jsx'
import { t } from '../lib/i18n.js'

// Modelos populares suportados via OmniRoute / OpenAI-compatible
const DEFAULT_MODELS = [
  { id: 'gpt-4o-mini', name: 'GPT-4o Mini (Rápido & Inteligente)' },
  { id: 'gpt-4o', name: 'GPT-4o (Mais Preciso e Completo)' },
  { id: 'claude-3-5-sonnet', name: 'Claude 3.5 Sonnet (Análise Aprofundada)' },
  { id: 'deepseek-chat', name: 'DeepSeek Chat (Custo-Benefício)' },
  { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash (Ultra Rápido)' },
  { id: 'llama-3.1-70b', name: 'Llama 3.1 70B (Open Source)' }
]

export default function AICoach() {
  const nav = useNavigate()
  const S = useStore(s => s.S)
  const toast = useUI(s => s.toast)

  // Configurações OmniRoute
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('omniroute_api_key') || '')
  const [endpoint, setEndpoint] = useState(() => localStorage.getItem('omniroute_endpoint') || 'https://api.omniroute.ai/v1')
  const [model, setModel] = useState(() => localStorage.getItem('omniroute_model') || 'gpt-4o-mini')
  const [customModel, setCustomModel] = useState('')
  const [showConfig, setShowConfig] = useState(false)

  // Mensagens do Chat
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const scrollRef = useRef(null)

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
          setMessages(data.map(m => ({
            id: m.id,
            role: m.role,
            content: m.content,
            model: m.model_used
          })))
        } else {
          // Mensagem inicial de boas-vindas
          setMessages([
            {
              id: 'welcome',
              role: 'assistant',
              content: 'Olá! Sou seu treinador e nutricionista pessoal com inteligência artificial via **OmniRoute**.\n\nPosso te ajudar a:\n- Montar e ajustar seu treino (hipertrofia, força, resistência);\n- Calcular e equilibrar seus macronutrientes e calorias da dieta;\n- Calcular sua hidratação ideal com base no seu peso e rotina;\n- Tirar dúvidas sobre execução de exercícios e técnicas de descanso.\n\nComo posso te ajudar hoje?',
              model: 'OmniRoute Assistant'
            }
          ])
        }
      } catch (e) {
        console.warn('Erro ao carregar mensagens:', e)
      }
    }
    loadChatHistory()
  }, [])

  // Auto-scroll para a última mensagem
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, loading])

  // Salvar configurações de IA
  const saveConfig = async () => {
    const selectedModel = customModel.trim() || model
    localStorage.setItem('omniroute_api_key', apiKey.trim())
    localStorage.setItem('omniroute_endpoint', endpoint.trim())
    localStorage.setItem('omniroute_model', selectedModel)
    setShowConfig(false)
    toast('Configurações do OmniRoute salvas com sucesso!')

    try {
      await supabase.from('user_targets').upsert([{
        omniroute_api_key: apiKey.trim(),
        omniroute_endpoint: endpoint.trim(),
        omniroute_model: selectedModel,
        updated_at: new Date().toISOString()
      }])
    } catch (err) {
      console.warn('Erro salvando no supabase:', err)
    }
  }

  // Enviar mensagem para o OmniRoute
  const sendMessage = async () => {
    const text = input.trim()
    if (!text || loading) return

    const activeModel = customModel.trim() || model
    const userMsg = { id: Date.now().toString(), role: 'user', content: text, model: activeModel }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setLoading(true)

    // Salvar no Supabase
    try {
      await supabase.from('ai_chat_messages').insert([{
        role: 'user',
        content: text,
        model_used: activeModel
      }])
    } catch (e) {
      console.warn('Erro ao salvar no Supabase:', e)
    }

    // Contexto do usuário para enriquecer o prompt da IA
    const systemPrompt = `Você é um assistente de elite em musculação, treinamento físico, hipertrofia, nutrição e hidratação.
Responda sempre em Português do Brasil com clareza, empatia, base científica e formatação elegante em Markdown.
Contexto atual do usuário no openGym:
- Metas de Dieta: Calorias=${S?.dietTargets?.calories || 2200}kcal, Proteínas=${S?.dietTargets?.protein || 150}g, Carboidratos=${S?.dietTargets?.carbs || 250}g, Gorduras=${S?.dietTargets?.fats || 65}g.
- Meta de Água: ${S?.dietTargets?.waterMl || 3000}ml/dia.
- Unidade de peso: ${S?.unit || 'kg'}.`

    try {
      if (!apiKey) {
        // Modo demonstração assistida caso a chave ainda não tenha sido inserida
        setTimeout(async () => {
          let responseText = ''
          const lower = text.toLowerCase()
          if (lower.includes('dieta') || lower.includes('calor') || lower.includes('prote')) {
            responseText = `Ótima pergunta sobre alimentação! Para uma divisão equilibrada focada em resultados:\n\n- **Proteínas:** Mantenha cerca de 1.6g a 2.2g por kg de peso corporal para garantir síntese proteica;\n- **Carboidratos:** Principal fonte de energia para treinar pesado e repor glicogênio;\n- **Gorduras:** Essenciais para a produção hormonal (mínimo 0.8g/kg).\n\n💡 *Dica:* Para usar respostas em tempo real com qualquer modelo de IA (GPT-4o, Claude 3.5, DeepSeek, Llama), clique em **Configurar OmniRoute** no canto superior e insira sua API Key!`
          } else if (lower.includes('agua') || lower.includes('água') || lower.includes('hidrata')) {
            responseText = `A hidratação é fundamental para força, lubrificação articular e performance muscular. A recomendação padrão é entre **35ml a 45ml por quilo de peso corporal** ao dia.\n\nNo openGym você pode registrar cada copo ou garrafa em 1 toque na aba de **Hidratação**!\n\n💡 *Configure sua chave do OmniRoute no botão acima para conectar diretamente aos modelos selecionados.*`
          } else {
            responseText = `Entendido! Para treinos eficientes, foque em progressão de carga (sobrecarga progressiva) e descanso adequado entre 2 a 3 minutos nas séries pesadas.\n\n🔗 Conecte sua chave no menu **Configurações OmniRoute** para conversar ilimitadamente com o modelo **${activeModel}**!`
          }

          const botMsg = { id: (Date.now() + 1).toString(), role: 'assistant', content: responseText, model: activeModel }
          setMessages(prev => [...prev, botMsg])
          setLoading(false)

          try {
            await supabase.from('ai_chat_messages').insert([{
              role: 'assistant',
              content: responseText,
              model_used: activeModel
            }])
          } catch (e) {}
        }, 800)
        return
      }

      // Chamada HTTP real via OmniRoute / OpenAI endpoint
      const baseUrl = endpoint.replace(/\/$/, '')
      const res = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: activeModel,
          messages: [
            { role: 'system', content: systemPrompt },
            ...messages.slice(-8).map(m => ({ role: m.role, content: m.content })),
            { role: 'user', content: text }
          ],
          temperature: 0.7
        })
      })

      if (!res.ok) {
        throw new Error(`Erro na API (${res.status}): ${await res.text()}`)
      }

      const data = await res.json()
      const answer = data.choices?.[0]?.message?.content || 'Não foi possível obter uma resposta do modelo.'

      const botMsg = { id: (Date.now() + 1).toString(), role: 'assistant', content: answer, model: activeModel }
      setMessages(prev => [...prev, botMsg])

      await supabase.from('ai_chat_messages').insert([{
        role: 'assistant',
        content: answer,
        model_used: activeModel
      }])
    } catch (err) {
      console.error('Erro na chamada OmniRoute:', err)
      const errorMsg = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `⚠️ Erro ao consultar o OmniRoute (${activeModel}): ${err.message}. Verifique sua chave de API e endpoint nas configurações.`,
        model: activeModel
      }
      setMessages(prev => [...prev, errorMsg])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="pad view-enter" style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - var(--tabbar-h, 60px) - 20px)' }}>
      {/* Topo do Chat */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 12, borderBottom: '1px solid var(--sep)' }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ color: 'var(--acc)' }}><Icon name="sparkles" size={24} /></span>
            Coach IA (OmniRoute)
          </h1>
          <div style={{ fontSize: 12, color: 'var(--label-2)', marginTop: 2 }}>
            Modelo ativo: <strong>{customModel.trim() || model}</strong>
          </div>
        </div>
        <Btn variant="ghost" size="sm" icon="gear" onClick={() => setShowConfig(!showConfig)}>
          {showConfig ? 'Fechar' : 'Configurar'}
        </Btn>
      </div>

      {/* Painel de Configuração do OmniRoute */}
      {showConfig && (
        <Card style={{ margin: '12px 0', padding: 14, background: 'var(--surface-2)' }}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8, color: 'var(--acc)' }}>
            Configurações da IA (OmniRoute / OpenAI API)
          </div>

          <div style={{ marginBottom: 10 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--label-2)', display: 'block', marginBottom: 4 }}>
              Chave de API (OmniRoute / OpenAI / DeepSeek)
            </label>
            <input
              type="password"
              value={apiKey}
              placeholder="Ex: sk-omniroute-... ou sua chave"
              onChange={e => setApiKey(e.target.value)}
              style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--sep)', background: 'var(--surface)', color: 'var(--fg)' }}
            />
          </div>

          <div style={{ marginBottom: 10 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--label-2)', display: 'block', marginBottom: 4 }}>
              Endpoint da API
            </label>
            <input
              type="text"
              value={endpoint}
              placeholder="https://api.omniroute.ai/v1"
              onChange={e => setEndpoint(e.target.value)}
              style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--sep)', background: 'var(--surface)', color: 'var(--fg)' }}
            />
          </div>

          <div style={{ marginBottom: 10 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--label-2)', display: 'block', marginBottom: 4 }}>
              Escolha o Modelo de IA
            </label>
            <select
              value={model}
              onChange={e => setModel(e.target.value)}
              style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--sep)', background: 'var(--surface)', color: 'var(--fg)' }}
            >
              {DEFAULT_MODELS.map(m => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </div>

          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--label-2)', display: 'block', marginBottom: 4 }}>
              Ou Digite Outro Modelo Customizado
            </label>
            <input
              type="text"
              value={customModel}
              placeholder="Ex: o1, claude-3-haiku, mistral-large..."
              onChange={e => setCustomModel(e.target.value)}
              style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--sep)', background: 'var(--surface)', color: 'var(--fg)' }}
            />
          </div>

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <Btn variant="primary" size="sm" onClick={saveConfig}>
              Salvar Configurações
            </Btn>
          </div>
        </Card>
      )}

      {/* Lista de Mensagens */}
      <div
        ref={scrollRef}
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '12px 0',
          display: 'flex',
          flexDirection: 'column',
          gap: 12
        }}
      >
        {messages.map(m => {
          const isUser = m.role === 'user'
          return (
            <div
              key={m.id}
              style={{
                alignSelf: isUser ? 'flex-end' : 'flex-start',
                maxWidth: '88%',
                background: isUser ? 'var(--acc)' : 'var(--surface)',
                color: isUser ? 'var(--bg-black, #fff)' : 'var(--fg)',
                padding: '12px 14px',
                borderRadius: 14,
                borderBottomRightRadius: isUser ? 2 : 14,
                borderBottomLeftRadius: isUser ? 14 : 2,
                boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                whiteSpace: 'pre-wrap',
                lineHeight: 1.5,
                fontSize: 14
              }}
            >
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

      {/* Caixa de Entrada */}
      <div style={{ display: 'flex', gap: 8, paddingTop: 8, borderTop: '1px solid var(--sep)' }}>
        <input
          type="text"
          value={input}
          placeholder="Pergunte sobre dieta, treino, suplementação..."
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') sendMessage()
          }}
          style={{
            flex: 1,
            padding: '12px 14px',
            borderRadius: 12,
            border: '1px solid var(--sep)',
            background: 'var(--surface)',
            color: 'var(--fg)',
            fontSize: 14,
            outline: 'none'
          }}
        />
        <Btn variant="primary" onClick={sendMessage} disabled={loading || !input.trim()}>
          <Icon name="arrowRight" />
        </Btn>
      </div>
    </div>
  )
}
