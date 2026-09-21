// Central AI service for openGym — OmniRoute (OpenAI-compatible) integration.
// One place for: config persistence, chat calls and strict-JSON calls.
// Every AI feature (coach chat, plan generators, weight-loss evaluation) funnels
// through here so the API key / endpoint / model are configured exactly once.

const LS_KEY = 'omniroute_api_key'
const LS_ENDPOINT = 'omniroute_endpoint'
const LS_MODEL = 'omniroute_model'

// Popular models available through OmniRoute / any OpenAI-compatible endpoint.
export const DEFAULT_MODELS = [
  { id: 'gpt-4o-mini', name: 'GPT-4o Mini (Rápido & Inteligente)' },
  { id: 'gpt-4o', name: 'GPT-4o (Mais Preciso e Completo)' },
  { id: 'claude-3-5-sonnet', name: 'Claude 3.5 Sonnet (Análise Aprofundada)' },
  { id: 'deepseek-chat', name: 'DeepSeek Chat (Custo-Benefício)' },
  { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash (Ultra Rápido)' },
  { id: 'llama-3.1-70b', name: 'Llama 3.1 70B (Open Source)' }
]

export function aiConfig() {
  return {
    apiKey: localStorage.getItem(LS_KEY) || '',
    endpoint: localStorage.getItem(LS_ENDPOINT) || 'https://api.omniroute.ai/v1',
    model: localStorage.getItem(LS_MODEL) || 'gpt-4o-mini'
  }
}

export function saveAIConfig({ apiKey, endpoint, model }) {
  localStorage.setItem(LS_KEY, (apiKey || '').trim())
  localStorage.setItem(LS_ENDPOINT, (endpoint || 'https://api.omniroute.ai/v1').trim())
  localStorage.setItem(LS_MODEL, (model || 'gpt-4o-mini').trim())
}

export const isAIConnected = () => !!aiConfig().apiKey

/**
 * Chat completion. `messages` = [{role, content}] WITHOUT the system prompt.
 * Returns the assistant text; throws on HTTP / network errors.
 */
export async function aiChat(messages, { system = '', temperature = 0.7 } = {}) {
  const { apiKey, endpoint, model } = aiConfig()
  if (!apiKey) throw new Error('Sem chave de API configurada')
  const base = endpoint.replace(/\/$/, '')
  const res = await fetch(`${base}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      messages: system ? [{ role: 'system', content: system }, ...messages] : messages,
      temperature
    })
  })
  if (!res.ok) throw new Error(`Erro na API (${res.status}): ${await res.text()}`)
  const data = await res.json()
  return data.choices?.[0]?.message?.content || ''
}

// Models love wrapping JSON in ```json fences or adding chatter around it.
// This recovers the outermost JSON object/array from any response shape.
export function extractJSON(text) {
  if (!text) return null
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const raw = (fenced ? fenced[1] : text).trim()
  const start = Math.min(...['{', '['].map(c => { const i = raw.indexOf(c); return i === -1 ? Infinity : i }))
  if (!isFinite(start)) return null
  const opener = raw[start]
  const closer = opener === '{' ? '}' : ']'
  const end = raw.lastIndexOf(closer)
  if (end <= start) return null
  try { return JSON.parse(raw.slice(start, end + 1)) } catch { return null }
}

/**
 * Ask the model for a strict JSON object. Falls back to throwing when the
 * answer is not parseable — callers show a friendly error and let the user retry.
 */
export async function aiJSON(system, user, { temperature = 0.4 } = {}) {
  const answer = await aiChat([{ role: 'user', content: user }], { system, temperature })
  const obj = extractJSON(answer)
  if (!obj) throw new Error('A IA respondeu em formato inesperado. Tente novamente.')
  return obj
}
