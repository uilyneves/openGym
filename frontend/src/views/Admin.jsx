import { useEffect, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { supabase } from '../integrations/supabase/client.js'
import { api } from '../lib/api.js'
import { fmtDate, fmtVol, fmtDur } from '../lib/format.js'
import { workoutVolume, setsDone } from '../lib/history.js'
import { confirmSheet } from '../sheets.jsx'
import Icon from '../components/Icon.jsx'
import { Button, TextField, TextArea, Segmented } from '../components/ui.jsx'
import { t } from '../lib/i18n.js'

const rel = ts => {
  if (!ts) return 'nunca'
  const time = typeof ts === 'string' ? new Date(ts).getTime() : ts
  const s = Math.max(0, (Date.now() - time) / 1000)
  if (s < 60) return 'agora há pouco'
  if (s < 3600) return Math.floor(s / 60) + 'm atrás'
  if (s < 86400) return Math.floor(s / 3600) + 'h atrás'
  return Math.floor(s / 86400) + 'd atrás'
}

// Modal / Sheet para Edição e Criação de Perfil
function EditProfileSheet({ profile, onSave, close }) {
  const toast = useUI(s => s.toast)
  const isNew = !profile?.id

  const [name, setName] = useState(profile?.name || '')
  const [email, setEmail] = useState(profile?.email || '')
  const [role, setRole] = useState(profile?.role || 'user')
  const [status, setStatus] = useState(profile?.status || 'active')
  const [age, setAge] = useState(profile?.age ? String(profile.age) : '')
  const [gender, setGender] = useState(profile?.gender || 'masculino')
  const [heightCm, setHeightCm] = useState(profile?.height_cm ? String(profile.height_cm) : '')
  const [weightKg, setWeightKg] = useState(profile?.weight_kg ? String(profile.weight_kg) : '')
  const [bodyFat, setBodyFat] = useState(profile?.body_fat_pct ? String(profile.body_fat_pct) : '')
  const [fitnessGoal, setFitnessGoal] = useState(profile?.fitness_goal || 'hipertrofia')
  const [activityLevel, setActivityLevel] = useState(profile?.activity_level || 'moderado')
  const [daysPerWeek, setDaysPerWeek] = useState(profile?.workout_days_per_week || 4)
  const [experience, setExperience] = useState(profile?.workout_experience || 'intermediario')
  const [restrictions, setRestrictions] = useState(profile?.dietary_restrictions || '')
  const [injuries, setInjuries] = useState(profile?.injuries_limitations || '')
  const [notes, setNotes] = useState(profile?.preferences_notes || '')
  const [saving, setSaving] = useState(false)
  const canEditAccess = profile?.role !== 'admin'

  const handleSubmit = async (e) => {
    e?.preventDefault?.()
    if (!name.trim()) {
      toast('Nome é obrigatório')
      return
    }
    if (isNew) {
      toast('Criação de perfis deve começar pelo cadastro do usuário.')
      return
    }

    setSaving(true)
    const payload = {
      name: name.trim(),
      email: email.trim() || null,
      ...(canEditAccess ? { role, status } : {}),
      age: age ? Number(age) : null,
      gender,
      height_cm: heightCm ? Number(heightCm) : null,
      weight_kg: weightKg ? Number(weightKg) : null,
      body_fat_pct: bodyFat ? Number(bodyFat) : null,
      fitness_goal: fitnessGoal,
      activity_level: activityLevel,
      workout_days_per_week: Number(daysPerWeek),
      workout_experience: experience,
      dietary_restrictions: restrictions.trim() || null,
      injuries_limitations: injuries.trim() || null,
      preferences_notes: notes.trim() || null,
      updated_at: new Date().toISOString()
    }

    try {
      const { error } = await supabase
        .from('profiles')
        .update(payload)
        .eq('id', profile.id)
      if (error) throw error
      toast('Perfil atualizado com sucesso!')
      onSave?.()
      close()
    } catch (err) {
      console.error(err)
      toast(err.message || 'Erro ao salvar perfil')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ paddingBottom: 24 }}>
      <div className="row between" style={{ marginBottom: 16 }}>
        <h2 style={{ margin: 0, fontSize: '1.25rem' }}>
          {isNew ? 'Criar Novo Perfil' : `Editar: ${profile.name}`}
        </h2>
      </div>
      {isNew && <div className="card muted small" style={{ padding: 12, marginBottom: 14 }}>
        Perfis são criados quando o usuário se cadastra. Aqui você pode editar permissões e dados após o cadastro.
      </div>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div>
          <label className="small muted" style={{ display: 'block', marginBottom: 4 }}>Nome Completo *</label>
          <TextField value={name} onChange={setName} placeholder="Ex: João da Silva" />
        </div>

        <div>
          <label className="small muted" style={{ display: 'block', marginBottom: 4 }}>E-mail de Contato</label>
          <TextField value={email} onChange={setEmail} placeholder="joao@email.com" />
        </div>

        <div className="row" style={{ gap: 10 }}>
          <div style={{ flex: 1 }}>
            <label className="small muted" style={{ display: 'block', marginBottom: 4 }}>Papel (Permissão)</label>
            <Segmented
              options={[
                { value: 'user', label: 'Usuário' },
                { value: 'coach', label: 'Treinador' },
                { value: 'admin', label: 'Admin' }
              ]}
              value={role}
              onChange={setRole}
              disabled={!canEditAccess}
            />
          </div>
          <div style={{ flex: 1 }}>
            <label className="small muted" style={{ display: 'block', marginBottom: 4 }}>Status</label>
            <Segmented
              options={[
                { value: 'active', label: 'Ativo' },
                { value: 'inactive', label: 'Inativo' }
              ]}
              value={status}
              onChange={setStatus}
            />
          </div>
        </div>

        <div className="row" style={{ gap: 10 }}>
          <div style={{ flex: 1 }}>
            <label className="small muted" style={{ display: 'block', marginBottom: 4 }}>Idade</label>
            <TextField type="number" value={age} onChange={setAge} placeholder="Ex: 28" />
          </div>
          <div style={{ flex: 1 }}>
            <label className="small muted" style={{ display: 'block', marginBottom: 4 }}>Gênero</label>
            <Segmented
              options={[
                { value: 'masculino', label: 'Masc' },
                { value: 'feminino', label: 'Fem' }
              ]}
              value={gender}
              onChange={setGender}
            />
          </div>
        </div>

        <div className="row" style={{ gap: 10 }}>
          <div style={{ flex: 1 }}>
            <label className="small muted" style={{ display: 'block', marginBottom: 4 }}>Peso (kg)</label>
            <TextField type="number" step="0.1" value={weightKg} onChange={setWeightKg} placeholder="75.0" />
          </div>
          <div style={{ flex: 1 }}>
            <label className="small muted" style={{ display: 'block', marginBottom: 4 }}>Altura (cm)</label>
            <TextField type="number" value={heightCm} onChange={setHeightCm} placeholder="175" />
          </div>
          <div style={{ flex: 1 }}>
            <label className="small muted" style={{ display: 'block', marginBottom: 4 }}>% Gordura (BF)</label>
            <TextField type="number" step="0.1" value={bodyFat} onChange={setBodyFat} placeholder="15" />
          </div>
        </div>

        <div className="row" style={{ gap: 10 }}>
          <div style={{ flex: 1 }}>
            <label className="small muted" style={{ display: 'block', marginBottom: 4 }}>Objetivo Principal</label>
            <Segmented
              options={[
                { value: 'hipertrofia', label: 'Hipertrofia' },
                { value: 'emagrecimento', label: 'Secar' },
                { value: 'forca', label: 'Força' }
              ]}
              value={fitnessGoal}
              onChange={setFitnessGoal}
            />
          </div>
        </div>

        <div className="row" style={{ gap: 10 }}>
          <div style={{ flex: 1 }}>
            <label className="small muted" style={{ display: 'block', marginBottom: 4 }}>Nível de Experiência</label>
            <Segmented
              options={[
                { value: 'iniciante', label: 'Iniciante' },
                { value: 'intermediario', label: 'Médio' },
                { value: 'avancado', label: 'Avançado' }
              ]}
              value={experience}
              onChange={setExperience}
            />
          </div>
          <div style={{ flex: 1 }}>
            <label className="small muted" style={{ display: 'block', marginBottom: 4 }}>Dias/Semana</label>
            <Segmented
              options={[
                { value: 3, label: '3d' },
                { value: 4, label: '4d' },
                { value: 5, label: '5d' },
                { value: 6, label: '6d' }
              ]}
              value={daysPerWeek}
              onChange={setDaysPerWeek}
            />
          </div>
        </div>

        <div>
          <label className="small muted" style={{ display: 'block', marginBottom: 4 }}>Lesões ou Restrições Articulares</label>
          <TextField value={injuries} onChange={setInjuries} placeholder="Ex: Dor no ombro direito, condromalácia" />
        </div>

        <div>
          <label className="small muted" style={{ display: 'block', marginBottom: 4 }}>Restrições Dietéticas / Alergias</label>
          <TextField value={restrictions} onChange={setRestrictions} placeholder="Ex: Intolerância à lactose, vegetariano" />
        </div>

        <div>
          <label className="small muted" style={{ display: 'block', marginBottom: 4 }}>Observações do Treinador / Admin</label>
          <TextArea rows={2} value={notes} onChange={setNotes} placeholder="Anotações internas sobre o aluno ou perfil..." />
        </div>

        <div className="row" style={{ gap: 10, marginTop: 12 }}>
          <Button variant="ghost" style={{ flex: 1 }} onClick={close}>Cancelar</Button>
          <Button variant="primary" style={{ flex: 2 }} onClick={handleSubmit} disabled={saving}>
            {saving ? 'Salvando...' : isNew ? 'Criar Perfil' : 'Salvar Alterações'}
          </Button>
        </div>
      </div>
    </div>
  )
}

// Detalhes completos do perfil ao clicar
function ProfileDetailSheet({ profile, onEdit, onDelete, onStatusToggle, close }) {
  return (
    <div style={{ paddingBottom: 20 }}>
      <div className="row between" style={{ alignItems: 'flex-start', marginBottom: 16 }}>
        <div>
          <div className="row" style={{ gap: 8, alignItems: 'center' }}>
            <h2 style={{ margin: 0, fontSize: '1.4rem' }}>{profile.name}</h2>
            <span className={`tag ${profile.role === 'admin' ? 'acc' : profile.role === 'coach' ? 'blue' : ''}`}>
              {profile.role || 'user'}
            </span>
            <span className="tag" style={{ color: profile.status === 'inactive' ? 'var(--red)' : 'var(--green)' }}>
              {profile.status === 'inactive' ? 'inativo' : 'ativo'}
            </span>
          </div>
          {profile.email && <div className="dim small" style={{ marginTop: 2 }}>{profile.email}</div>}
        </div>
        <button className="iconbtn" onClick={close} aria-label="Fechar"><Icon name="xmark" /></button>
      </div>

      <div className="tiles" style={{ textAlign: 'left', marginBottom: 16 }}>
        <div className="tile">
          <div className="l">Peso</div>
          <div className="v" style={{ fontSize: '1.15rem' }}>{profile.weight_kg ? `${profile.weight_kg} kg` : '—'}</div>
        </div>
        <div className="tile">
          <div className="l">Altura</div>
          <div className="v" style={{ fontSize: '1.15rem' }}>{profile.height_cm ? `${profile.height_cm} cm` : '—'}</div>
        </div>
        <div className="tile">
          <div className="l">Idade / Sexo</div>
          <div className="v" style={{ fontSize: '1.05rem', textTransform: 'capitalize' }}>
            {profile.age ? `${profile.age}a` : '—'} {profile.gender ? `(${profile.gender.slice(0, 1)})` : ''}
          </div>
        </div>
        <div className="tile">
          <div className="l">% BF</div>
          <div className="v" style={{ fontSize: '1.15rem' }}>{profile.body_fat_pct ? `${profile.body_fat_pct}%` : '—'}</div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div className="row between">
          <span className="muted small">Objetivo:</span>
          <span className="small" style={{ fontWeight: 600, textTransform: 'capitalize' }}>{profile.fitness_goal || 'Não definido'}</span>
        </div>
        <div className="row between">
          <span className="muted small">Frequência:</span>
          <span className="small" style={{ fontWeight: 600 }}>{profile.workout_days_per_week ? `${profile.workout_days_per_week} dias/sem` : '—'}</span>
        </div>
        <div className="row between">
          <span className="muted small">Nível:</span>
          <span className="small" style={{ fontWeight: 600, textTransform: 'capitalize' }}>{profile.workout_experience || '—'}</span>
        </div>
        <div className="row between">
          <span className="muted small">Atividade:</span>
          <span className="small" style={{ fontWeight: 600, textTransform: 'capitalize' }}>{profile.activity_level || '—'}</span>
        </div>
        {profile.injuries_limitations && (
          <div style={{ marginTop: 6, paddingTop: 6, borderTop: '1px solid var(--sep)' }}>
            <span className="muted small" style={{ display: 'block', color: 'var(--orange)' }}>Lesões / Limitações:</span>
            <span className="small">{profile.injuries_limitations}</span>
          </div>
        )}
        {profile.dietary_restrictions && (
          <div style={{ marginTop: 4 }}>
            <span className="muted small" style={{ display: 'block' }}>Restrições Dietéticas:</span>
            <span className="small">{profile.dietary_restrictions}</span>
          </div>
        )}
        {profile.preferences_notes && (
          <div style={{ marginTop: 4 }}>
            <span className="muted small" style={{ display: 'block' }}>Notas / Observações:</span>
            <span className="small dim">{profile.preferences_notes}</span>
          </div>
        )}
      </div>

      <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
        <Button variant="primary" icon="pencil" style={{ flex: 1 }} onClick={() => { close(); onEdit(profile) }}>
          Editar Perfil
        </Button>
        <Button
          variant="ghost"
          style={{ flex: 1, color: profile.status === 'inactive' ? 'var(--green)' : 'var(--orange)' }}
          onClick={() => { close(); onStatusToggle(profile) }}
        >
          {profile.status === 'inactive' ? 'Ativar Perfil' : 'Suspender/Pausar'}
        </Button>
        <Button
          variant="danger"
          icon="trash"
          onClick={() => { close(); onDelete(profile) }}
        >
          Excluir
        </Button>
      </div>
    </div>
  )
}

export default function Admin() {
  const nav = useNavigate()
  const toast = useUI(s => s.toast)
  const openSheet = useUI(s => s.openSheet)

  // Estados dos perfis Supabase
  const [profiles, setProfiles] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [roleFilter, setRoleFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')

  // Estados legados da API local (caso disponível)
  const [localUsers, setLocalUsers] = useState(null)
  const [tab, setTab] = useState('profiles') // 'profiles' | 'live' | 'system'

  // Carregar perfis do Supabase
  const loadProfiles = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('name', { ascending: true })

      if (error) throw error
      setProfiles(data || [])
    } catch (err) {
      console.error(err)
      toast('Erro ao buscar perfis do banco: ' + (err.message || ''))
    } finally {
      setLoading(false)
    }
  }

  // Carregar usuários do backend local caso existam
  const loadLocalUsers = () => {
    api('/api/admin/users')
      .then(d => setLocalUsers(d.users || []))
      .catch(() => {})
  }

  useEffect(() => {
    loadProfiles()
    loadLocalUsers()
    const iv = setInterval(() => {
      loadProfiles()
      loadLocalUsers()
    }, 20000)
    return () => clearInterval(iv)
  }, [])

  // Filtragem e busca
  const filteredProfiles = useMemo(() => {
    return profiles.filter(p => {
      const matchSearch = !searchTerm.trim() || 
        (p.name && p.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (p.email && p.email.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (p.fitness_goal && p.fitness_goal.toLowerCase().includes(searchTerm.toLowerCase()))
      
      const matchRole = roleFilter === 'all' || (p.role || 'user') === roleFilter
      const matchStatus = statusFilter === 'all' || (p.status || 'active') === statusFilter

      return matchSearch && matchRole && matchStatus
    })
  }, [profiles, searchTerm, roleFilter, statusFilter])

  // KPIs
  const totalProfiles = profiles.length
  const activeProfiles = profiles.filter(p => (p.status || 'active') === 'active').length
  const adminProfiles = profiles.filter(p => p.role === 'admin').length
  const coachProfiles = profiles.filter(p => p.role === 'coach').length

  // Ações
  const handleCreateProfile = () => {
    toast('Os perfis são criados no cadastro do usuário. Depois, use a lista para ajustar permissões e dados.')
  }

  const handleEditProfile = (profile) => {
    openSheet(close => <EditProfileSheet profile={profile} onSave={loadProfiles} close={close} />)
  }

  const handleViewProfile = (profile) => {
    openSheet(close => (
      <ProfileDetailSheet
        profile={profile}
        onEdit={handleEditProfile}
        onDelete={handleDeleteProfile}
        onStatusToggle={handleStatusToggle}
        close={close}
      />
    ))
  }

  const handleStatusToggle = async (profile) => {
    if (profile.role === 'admin') {
      toast('Por segurança, o status de administradores não pode ser alterado aqui.')
      return
    }
    const newStatus = profile.status === 'inactive' ? 'active' : 'inactive'
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', profile.id)
      if (error) throw error
      toast(`Status de ${profile.name} alterado para ${newStatus}`)
      loadProfiles()
    } catch (err) {
      toast(err.message || 'Falha ao alterar status')
    }
  }

  const handleDeleteProfile = (profile) => {
    if (profile.role === 'admin') {
      toast('Por segurança, administradores não podem ser excluídos aqui.')
      return
    }
    confirmSheet({
      title: `Excluir perfil de ${profile.name}?`,
      message: 'Essa ação removerá o perfil e dados associados permanentemente do banco.',
      confirmText: 'Excluir definitivamente',
      danger: true,
      onConfirm: async () => {
        try {
          const { error } = await supabase.from('profiles').delete().eq('id', profile.id)
          if (error) throw error
          toast(`Perfil de ${profile.name} excluído!`)
          loadProfiles()
        } catch (err) {
          toast('Erro ao excluir: ' + (err.message || ''))
        }
      }
    })
  }

  // Exportar dados dos perfis para JSON
  const exportProfiles = () => {
    const jsonStr = JSON.stringify(profiles, null, 2)
    const blob = new Blob([jsonStr], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `opengym-perfis-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
    toast('Relatório de perfis exportado em JSON!')
  }

  return (
    <div className="narrow" style={{ paddingBottom: 60 }}>
      {/* Header */}
      <div className="hdr">
        <button className="iconbtn" onClick={() => nav('/settings')} aria-label="Voltar">
          <Icon name="chevronLeft" />
        </button>
        <div style={{ flex: 1, marginLeft: 8 }}>
          <h1 style={{ margin: 0, fontSize: '1.45rem' }}>Painel do Administrador</h1>
          <div className="sub">Gerenciamento central de usuários e perfis</div>
        </div>
        <button className="iconbtn" onClick={loadProfiles} title="Recarregar" aria-label="Recarregar">
          ↻
        </button>
      </div>

      {/* Navegação entre abas */}
      <div style={{ marginBottom: 16 }}>
        <Segmented
          options={[
            { value: 'profiles', label: `Perfis (${profiles.length})` },
            { value: 'system', label: 'Estatísticas' }
          ]}
          value={tab}
          onChange={setTab}
        />
      </div>

      {/* Cards de Métricas / KPIs */}
      <div className="tiles" style={{ marginBottom: 16 }}>
        <div className="tile">
          <div className="l">Total Perfis</div>
          <div className="v">{totalProfiles}</div>
        </div>
        <div className="tile">
          <div className="l">Ativos</div>
          <div className="v" style={{ color: 'var(--green)' }}>{activeProfiles}</div>
        </div>
        <div className="tile">
          <div className="l">Admins</div>
          <div className="v" style={{ color: 'var(--acc)' }}>{adminProfiles}</div>
        </div>
        <div className="tile">
          <div className="l">Treinadores</div>
          <div className="v" style={{ color: 'var(--indigo)' }}>{coachProfiles}</div>
        </div>
      </div>

      {tab === 'profiles' ? (
        <>
          {/* Barra de Ações: Busca, Filtros e Novo Perfil */}
          <div className="card" style={{ marginBottom: 16, padding: '12px 14px' }}>
            <div className="row" style={{ gap: 8, marginBottom: 10 }}>
              <div style={{ flex: 1, position: 'relative' }}>
                <input
                  type="text"
                  className="input"
                  placeholder="Buscar por nome, email ou objetivo..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  style={{ paddingLeft: 34, height: 38 }}
                />
                <div style={{ position: 'absolute', left: 10, top: 10, color: 'var(--label-3)', pointerEvents: 'none' }}>
                  <Icon name="magnifier" />
                </div>
              </div>
              <Button variant="primary" size="sm" icon="plus" onClick={handleCreateProfile}>
                Novo Perfil
              </Button>
            </div>

            <div className="row between" style={{ gap: 8, flexWrap: 'wrap' }}>
              <div className="row" style={{ gap: 6, alignItems: 'center' }}>
                <span className="dim small">Papel:</span>
                <select
                  className="input"
                  style={{ width: 'auto', height: 32, padding: '0 8px', fontSize: '.8rem' }}
                  value={roleFilter}
                  onChange={e => setRoleFilter(e.target.value)}
                >
                  <option value="all">Todos os papéis</option>
                  <option value="admin">Administradores</option>
                  <option value="coach">Treinadores</option>
                  <option value="user">Alunos / Usuários</option>
                </select>
              </div>

              <div className="row" style={{ gap: 6, alignItems: 'center' }}>
                <span className="dim small">Status:</span>
                <select
                  className="input"
                  style={{ width: 'auto', height: 32, padding: '0 8px', fontSize: '.8rem' }}
                  value={statusFilter}
                  onChange={e => setStatusFilter(e.target.value)}
                >
                  <option value="all">Todos os status</option>
                  <option value="active">Ativos</option>
                  <option value="inactive">Inativos</option>
                </select>

                <Button variant="ghost" size="sm" icon="download" onClick={exportProfiles} title="Exportar JSON">
                  Exportar
                </Button>
              </div>
            </div>
          </div>

          {/* Lista de Perfis */}
          <div className="row between" style={{ margin: '8px 2px 10px' }}>
            <span className="sec" style={{ margin: 0, textTransform: 'uppercase', letterSpacing: '.06em', fontSize: '.8rem', color: 'var(--label-3)' }}>
              Perfis Encontrados ({filteredProfiles.length})
            </span>
          </div>

          {loading ? (
            <div className="card small muted" style={{ textAlign: 'center', padding: 24 }}>
              Carregando perfis do sistema...
            </div>
          ) : filteredProfiles.length === 0 ? (
            <div className="card small muted" style={{ textAlign: 'center', padding: 28 }}>
              {searchTerm || roleFilter !== 'all' || statusFilter !== 'all'
                ? 'Nenhum perfil corresponde aos filtros de busca.'
                : 'Nenhum perfil cadastrado no momento.'}
            </div>
          ) : (
            <div className="list" style={{ gap: 8 }}>
              {filteredProfiles.map(p => {
                const isInactive = p.status === 'inactive'
                const roleBadge = p.role === 'admin' ? 'admin' : p.role === 'coach' ? 'coach' : null

                return (
                  <div
                    key={p.id}
                    className="card item"
                    onClick={() => handleViewProfile(p)}
                    style={{
                      cursor: 'pointer',
                      padding: '12px 14px',
                      opacity: isInactive ? 0.6 : 1,
                      borderLeft: p.role === 'admin' ? '3px solid var(--acc)' : p.role === 'coach' ? '3px solid var(--indigo)' : '3px solid transparent'
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="row" style={{ gap: 6, alignItems: 'center', marginBottom: 2 }}>
                        <span style={{ fontWeight: 600, fontSize: '.95rem' }}>{p.name}</span>
                        {roleBadge && <span className={`tag ${roleBadge === 'admin' ? 'acc' : 'blue'}`}>{roleBadge}</span>}
                        {isInactive && <span className="tag" style={{ color: 'var(--red)' }}>inativo</span>}
                      </div>

                      <div className="dim small" style={{ fontSize: '.78rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {p.email && <span>{p.email} · </span>}
                        {p.fitness_goal && <span style={{ textTransform: 'capitalize' }}>{p.fitness_goal} · </span>}
                        {p.weight_kg ? `${p.weight_kg}kg` : 'Sem peso'}
                        {p.updated_at && <span className="muted"> (atualizado {rel(p.updated_at)})</span>}
                      </div>

                      {p.injuries_limitations && (
                        <div style={{ fontSize: '.72rem', color: 'var(--orange)', marginTop: 3 }}>
                          ⚠️ {p.injuries_limitations}
                        </div>
                      )}
                    </div>

                    <div className="row" style={{ gap: 4 }}>
                      <button
                        className="iconbtn"
                        style={{ width: 34, height: 34 }}
                        onClick={(e) => {
                          e.stopPropagation()
                          handleEditProfile(p)
                        }}
                        title="Editar"
                        aria-label="Editar"
                      >
                        <Icon name="pencil" />
                      </button>
                      <button
                        className="iconbtn"
                        style={{ width: 34, height: 34, color: 'var(--red)' }}
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDeleteProfile(p)
                        }}
                        title="Excluir"
                        aria-label="Excluir"
                      >
                        <Icon name="trash" />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </>
      ) : (
        /* Aba de Estatísticas e Informações do Sistema */
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="card">
            <h3 style={{ margin: '0 0 12px' }}>Distribuição de Objetivos</h3>
            {['hipertrofia', 'emagrecimento', 'forca', 'condicionamento'].map(goal => {
              const count = profiles.filter(p => p.fitness_goal === goal).length
              const pct = profiles.length ? Math.round((count / profiles.length) * 100) : 0
              return (
                <div key={goal} style={{ marginBottom: 8 }}>
                  <div className="row between small" style={{ marginBottom: 3 }}>
                    <span style={{ textTransform: 'capitalize', fontWeight: 500 }}>{goal}</span>
                    <span className="muted">{count} alunos ({pct}%)</span>
                  </div>
                  <div style={{ height: 6, background: 'var(--surface-3)', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{ width: `${pct}%`, height: '100%', background: 'var(--acc)' }} />
                  </div>
                </div>
              )
            })}
          </div>

          <div className="card">
            <h3 style={{ margin: '0 0 8px' }}>Visão Geral da Base</h3>
            <div className="dim small" style={{ lineHeight: 1.6 }}>
              Todos os perfis listados têm seus planos, anamneses e metas integrados ao banco de dados Supabase e alimentam diretamente a inteligência artificial do <strong>AICoach</strong>.
            </div>
            <div className="row" style={{ gap: 8, marginTop: 14 }}>
              <Button variant="primary" icon="plus" onClick={handleCreateProfile}>
                Cadastrar Novo Perfil
              </Button>
              <Button variant="ghost" icon="download" onClick={exportProfiles}>
                Exportar Base Completa
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
