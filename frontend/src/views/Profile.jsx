import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { supabase } from '../integrations/supabase/client.js'
import { Button, Row, Section, Segmented } from '../components/ui.jsx'
import Icon from '../components/Icon.jsx'
import { t } from '../lib/i18n.js'
import { todayISO } from '../lib/format.js'

export default function Profile() {
  const nav = useNavigate()
  const S = useStore(s => s.S)
  const logBW = useStore(s => s.logBW)
  const toast = useUI(s => s.toast)

  // Perfil e Dados Biométricos para a IA
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  const [name, setName] = useState('')
  const [avatarUrl, setAvatarUrl] = useState('')
  const [age, setAge] = useState('')
  const [gender, setGender] = useState('masculino')
  const [heightCm, setHeightCm] = useState('')
  const [weightKg, setWeightKg] = useState('')
  const [bodyFat, setBodyFat] = useState('')
  const [fitnessGoal, setFitnessGoal] = useState('hipertrofia')
  const [activityLevel, setActivityLevel] = useState('moderado')
  const [daysPerWeek, setDaysPerWeek] = useState(4)
  const [experience, setExperience] = useState('intermediario')
  const [restrictions, setRestrictions] = useState('')
  const [injuries, setInjuries] = useState('')
  const [notes, setNotes] = useState('')

  // Carregar dados salvos
  useEffect(() => {
    // 1. Tentar pegar do localStorage local primeiro
    try {
      const local = JSON.parse(localStorage.getItem('user_fitness_profile') || '{}')
      if (local.name) setName(local.name)
      if (local.avatarUrl) setAvatarUrl(local.avatarUrl)
      if (local.age) setAge(local.age)
      if (local.gender) setGender(local.gender)
      if (local.heightCm) setHeightCm(local.heightCm)
      if (local.weightKg) setWeightKg(local.weightKg)
      if (local.bodyFat) setBodyFat(local.bodyFat)
      if (local.fitnessGoal) setFitnessGoal(local.fitnessGoal)
      if (local.activityLevel) setActivityLevel(local.activityLevel)
      if (local.daysPerWeek) setDaysPerWeek(local.daysPerWeek)
      if (local.experience) setExperience(local.experience)
      if (local.restrictions) setRestrictions(local.restrictions)
      if (local.injuries) setInjuries(local.injuries)
      if (local.notes) setNotes(local.notes)
    } catch {}

    // Preencher peso padrão a partir do store se não houver
    if (S.bodyweight && S.bodyweight.length > 0) {
      const last = S.bodyweight[S.bodyweight.length - 1]
      setWeightKg(prev => prev || String(last.w))
    }

    // 2. Buscar dados remotos do Supabase
    async function loadRemoteProfile() {
      setLoading(true)
      try {
        const { data: user } = await supabase.auth.getUser()
        if (!user?.user) return
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('user_id', user.user.id)
          .maybeSingle()

        if (!error && data) {
          const p = data
          if (p.name) setName(p.name)
          if (p.avatar_url) setAvatarUrl(p.avatar_url)
          if (p.age) setAge(String(p.age))
          if (p.gender) setGender(p.gender)
          if (p.height_cm) setHeightCm(String(p.height_cm))
          if (p.weight_kg) setWeightKg(String(p.weight_kg))
          if (p.body_fat_pct) setBodyFat(String(p.body_fat_pct))
          if (p.fitness_goal) setFitnessGoal(p.fitness_goal)
          if (p.activity_level) setActivityLevel(p.activity_level)
          if (p.workout_days_per_week) setDaysPerWeek(p.workout_days_per_week)
          if (p.workout_experience) setExperience(p.workout_experience)
          if (p.dietary_restrictions) setRestrictions(p.dietary_restrictions)
          if (p.injuries_limitations) setInjuries(p.injuries_limitations)
          if (p.preferences_notes) setNotes(p.preferences_notes)
        }
      } catch (err) {
        console.warn('Erro ao carregar perfil do Supabase:', err)
      } finally {
        setLoading(false)
      }
    }

    loadRemoteProfile()
  }, [S.bodyweight])

  // Foto de perfil via upload de arquivo (Base64)
  const handlePhotoUpload = (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.size > 2 * 1024 * 1024) {
      toast('A foto deve ter no máximo 2MB.')
      return
    }

    const reader = new FileReader()
    reader.onload = (event) => {
      const b64 = event.target?.result
      if (b64) {
        setAvatarUrl(b64)
        toast('Foto carregada!')
      }
    }
    reader.readAsDataURL(file)
  }

  // Salvar perfil completo
  const saveProfile = async () => {
    setSaving(true)
    const profileData = {
      name: name.trim(),
      avatarUrl,
      age: age ? Number(age) : null,
      gender,
      heightCm: heightCm ? Number(heightCm) : null,
      weightKg: weightKg ? Number(weightKg) : null,
      bodyFat: bodyFat ? Number(bodyFat) : null,
      fitnessGoal,
      activityLevel,
      daysPerWeek: Number(daysPerWeek),
      experience,
      restrictions: restrictions.trim(),
      injuries: injuries.trim(),
      notes: notes.trim(),
      updatedAt: new Date().toISOString()
    }

    // Salvar localmente
    localStorage.setItem('user_fitness_profile', JSON.stringify(profileData))

    // Se informou peso, salvar no histórico de peso do openGym
    if (profileData.weightKg) {
      logBW(profileData.weightKg, todayISO())
    }

    // Salvar no Supabase
    try {
      const { data: user } = await supabase.auth.getUser()
      if (!user?.user) throw new Error('Entre na sua conta para sincronizar o perfil.')
      const { data: currentProfile, error: findError } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', user.user.id)
        .maybeSingle()
      if (findError) throw findError

      const payload = {
        user_id: user.user.id,
        name: profileData.name,
        avatar_url: profileData.avatarUrl,
        age: profileData.age,
        gender: profileData.gender,
        height_cm: profileData.heightCm,
        weight_kg: profileData.weightKg,
        body_fat_pct: profileData.bodyFat,
        fitness_goal: profileData.fitnessGoal,
        activity_level: profileData.activityLevel,
        workout_days_per_week: profileData.daysPerWeek,
        workout_experience: profileData.experience,
        dietary_restrictions: profileData.restrictions,
        injuries_limitations: profileData.injuries,
        preferences_notes: profileData.notes,
        updated_at: new Date().toISOString()
      }
      const query = currentProfile?.id
        ? supabase.from('profiles').update(payload).eq('id', currentProfile.id)
        : supabase.from('profiles').insert([payload])
      const { error } = await query
      if (error) throw error
      toast('Perfil e biometria salvos no Supabase com sucesso!')
    } catch (err) {
      console.warn('Erro ao salvar no Supabase:', err)
      toast('Perfil salvo localmente!')
    } finally {
      setSaving(false)
    }
  }

  // Cálculo de IMC e Taxa Metabólica Basal Estimada (Mifflin-St Jeor)
  const hM = Number(heightCm) / 100
  const w = Number(weightKg)
  const imc = hM > 0 && w > 0 ? (w / (hM * hM)).toFixed(1) : null

  let tmb = null
  if (w > 0 && Number(heightCm) > 0 && Number(age) > 0) {
    if (gender === 'masculino') {
      tmb = Math.round(10 * w + 6.25 * Number(heightCm) - 5 * Number(age) + 5)
    } else {
      tmb = Math.round(10 * w + 6.25 * Number(heightCm) - 5 * Number(age) - 161)
    }
  }

  return (
    <div className="pad view-enter" style={{ paddingBottom: 'calc(var(--tabbar-h, 60px) + 40px)' }}>
      {/* Topo */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ color: 'var(--acc)' }}><Icon name="user" size={26} /></span>
            Perfil do Atleta
          </h1>
          <div style={{ fontSize: 13, color: 'var(--label-2)', marginTop: 2 }}>
            Biometria e anamnese usadas pela IA para gerar treinos e dietas
          </div>
        </div>
        <Button variant="primary" icon="check" onClick={saveProfile} disabled={saving}>
          {saving ? 'Salvando...' : 'Salvar'}
        </Button>
      </div>

      {/* Foto e Identificação */}
      <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 16, padding: 16, marginBottom: 16 }}>
        <div style={{ position: 'relative', width: 80, height: 80, borderRadius: '50%', background: 'var(--surface-3)', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, border: '2px solid var(--acc)' }}>
          {avatarUrl ? (
            <img src={avatarUrl} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <Icon name="user" size={36} style={{ color: 'var(--label-2)' }} />
          )}
          <label style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'rgba(0,0,0,0.65)', color: '#fff', fontSize: 10, textAlign: 'center', padding: '3px 0', cursor: 'pointer' }}>
            Alterar
            <input type="file" accept="image/*" onChange={handlePhotoUpload} style={{ display: 'none' }} />
          </label>
        </div>

        <div style={{ flex: 1 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--label-2)', display: 'block', marginBottom: 4 }}>Nome ou Apelido</label>
          <input
            type="text"
            value={name}
            placeholder="Ex: Carlos Silva"
            onChange={e => setName(e.target.value)}
            style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid var(--sep)', background: 'var(--surface-2)', color: 'var(--fg)', fontSize: 15 }}
          />
        </div>
      </div>

      {/* Cartão de Estimativas Metabólicas */}
      {(imc || tmb) && (
        <div className="card" style={{ marginBottom: 16, background: 'color-mix(in srgb, var(--acc) 8%, var(--surface))', border: '1px solid color-mix(in srgb, var(--acc) 30%, transparent)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-around', textAlign: 'center' }}>
            {imc && (
              <div>
                <div style={{ fontSize: 12, color: 'var(--label-2)', fontWeight: 600 }}>Índice IMC</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--acc)' }}>{imc}</div>
              </div>
            )}
            {tmb && (
              <div>
                <div style={{ fontSize: 12, color: 'var(--label-2)', fontWeight: 600 }}>Metabolismo Basal (TMB)</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--acc)' }}>~{tmb} <span style={{ fontSize: 13, fontWeight: 500 }}>kcal/dia</span></div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 1. Dados Biométricos */}
      <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--label-2)', margin: '16px 0 8px' }}>
        1. Medidas Corporais
      </div>
      <div className="card" style={{ padding: 14 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--label-2)', display: 'block', marginBottom: 4 }}>Idade (anos)</label>
            <input
              type="number"
              value={age}
              placeholder="Ex: 28"
              onChange={e => setAge(e.target.value)}
              style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid var(--sep)', background: 'var(--surface-2)', color: 'var(--fg)' }}
            />
          </div>

          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--label-2)', display: 'block', marginBottom: 4 }}>Gênero Biológico</label>
            <select
              value={gender}
              onChange={e => setGender(e.target.value)}
              style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid var(--sep)', background: 'var(--surface-2)', color: 'var(--fg)' }}
            >
              <option value="masculino">Masculino</option>
              <option value="feminino">Feminino</option>
              <option value="outro">Outro / Prefiro não dizer</option>
            </select>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--label-2)', display: 'block', marginBottom: 4 }}>Altura (cm)</label>
            <input
              type="number"
              value={heightCm}
              placeholder="Ex: 178"
              onChange={e => setHeightCm(e.target.value)}
              style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid var(--sep)', background: 'var(--surface-2)', color: 'var(--fg)' }}
            />
          </div>

          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--label-2)', display: 'block', marginBottom: 4 }}>Peso Atual (kg)</label>
            <input
              type="number"
              step="0.1"
              value={weightKg}
              placeholder="Ex: 75.5"
              onChange={e => setWeightKg(e.target.value)}
              style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid var(--sep)', background: 'var(--surface-2)', color: 'var(--fg)' }}
            />
          </div>

          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--label-2)', display: 'block', marginBottom: 4 }}>% Gordura (BF)</label>
            <input
              type="number"
              step="0.5"
              value={bodyFat}
              placeholder="Ex: 15%"
              onChange={e => setBodyFat(e.target.value)}
              style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid var(--sep)', background: 'var(--surface-2)', color: 'var(--fg)' }}
            />
          </div>
        </div>
      </div>

      {/* 2. Objetivos e Rotina de Treino */}
      <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--label-2)', margin: '20px 0 8px' }}>
        2. Metas & Rotina de Treino
      </div>
      <div className="card" style={{ padding: 14 }}>
        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--label-2)', display: 'block', marginBottom: 4 }}>Objetivo Principal</label>
          <select
            value={fitnessGoal}
            onChange={e => setFitnessGoal(e.target.value)}
            style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid var(--sep)', background: 'var(--surface-2)', color: 'var(--fg)' }}
          >
            <option value="hipertrofia">Ganho de Massa Muscular (Hipertrofia)</option>
            <option value="emagrecimento">Perda de Gordura / Definição (Cutting)</option>
            <option value="forca">Ganho de Força Bruta (Powerlifting)</option>
            <option value="resistencia">Condicionamento e Resistência Geral</option>
            <option value="saude">Manutenção & Saúde Geral</option>
          </select>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--label-2)', display: 'block', marginBottom: 4 }}>Experiência com Treino</label>
            <select
              value={experience}
              onChange={e => setExperience(e.target.value)}
              style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid var(--sep)', background: 'var(--surface-2)', color: 'var(--fg)' }}
            >
              <option value="iniciante">Iniciante (menos de 6 meses)</option>
              <option value="intermediario">Intermediário (6 meses a 2 anos)</option>
              <option value="avancado">Avançado (mais de 2 anos)</option>
            </select>
          </div>

          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--label-2)', display: 'block', marginBottom: 4 }}>Dias de Treino / Semana</label>
            <select
              value={daysPerWeek}
              onChange={e => setDaysPerWeek(Number(e.target.value))}
              style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid var(--sep)', background: 'var(--surface-2)', color: 'var(--fg)' }}
            >
              <option value={2}>2 dias por semana</option>
              <option value={3}>3 dias por semana (ex: Fullbody / ABC)</option>
              <option value={4}>4 dias por semana (ex: Upper/Lower)</option>
              <option value={5}>5 dias por semana (ex: PPL + Upper/Lower)</option>
              <option value={6}>6 dias por semana (ex: PPL x2)</option>
            </select>
          </div>
        </div>

        <div>
          <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--label-2)', display: 'block', marginBottom: 4 }}>Nível de Atividade Diária (fora o treino)</label>
          <select
            value={activityLevel}
            onChange={e => setActivityLevel(e.target.value)}
            style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid var(--sep)', background: 'var(--surface-2)', color: 'var(--fg)' }}
          >
            <option value="sedentario">Sedentário (trabalho sentado, pouco movimento)</option>
            <option value="leve">Levemente ativo (caminhadas leves, rotina moderada)</option>
            <option value="moderado">Moderadamente ativo (passos frequentes durante o dia)</option>
            <option value="muito_ativo">Muito ativo (trabalho braçal ou rotina intensa)</option>
          </select>
        </div>
      </div>

      {/* 3. Anamnese Nutricional e Lesões */}
      <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--label-2)', margin: '20px 0 8px' }}>
        3. Restrições, Lesões & Preferências (Para a IA)
      </div>
      <div className="card" style={{ padding: 14 }}>
        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--label-2)', display: 'block', marginBottom: 4 }}>
            Restrições Alimentares / Alergias
          </label>
          <input
            type="text"
            value={restrictions}
            placeholder="Ex: Intolerância à lactose, vegetariano, não como peixe, etc."
            onChange={e => setRestrictions(e.target.value)}
            style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid var(--sep)', background: 'var(--surface-2)', color: 'var(--fg)' }}
          />
        </div>

        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--label-2)', display: 'block', marginBottom: 4 }}>
            Lesões, Dores ou Limitações Articulares
          </label>
          <input
            type="text"
            value={injuries}
            placeholder="Ex: Dor lombar ao agachar pesado, sensibilidade no ombro direito, condromalácia patelar..."
            onChange={e => setInjuries(e.target.value)}
            style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid var(--sep)', background: 'var(--surface-2)', color: 'var(--fg)' }}
          />
        </div>

        <div>
          <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--label-2)', display: 'block', marginBottom: 4 }}>
            Observações Gerais & Preferências da Dieta/Treino
          </label>
          <textarea
            rows={3}
            value={notes}
            placeholder="Ex: Prefiro treinos mais curtos (45-50 min), gosto de tomar whey após o treino, tenho facilidade para ganhar pernas mas dificuldade em peitoral..."
            onChange={e => setNotes(e.target.value)}
            style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid var(--sep)', background: 'var(--surface-2)', color: 'var(--fg)', resize: 'vertical' }}
          />
        </div>
      </div>

      {/* Ação de Ir para a IA */}
      <div style={{ marginTop: 24, textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <Button variant="primary" icon="sparkles" onClick={async () => {
          await saveProfile()
          nav('/ai')
        }}>
          Salvar e Falar com o Coach IA
        </Button>
        <Button variant="tinted" icon="chartLine" onClick={async () => {
          await saveProfile()
          nav('/eval')
        }}>
          Salvar e Avaliar Meu Emagrecimento
        </Button>
      </div>
    </div>
  )
}
