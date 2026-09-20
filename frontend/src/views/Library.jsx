import { useState } from 'react'
import { useStore } from '../store/useStore.js'
import { EXDB, BODYPARTS, allExercises, equipmentOf } from '../lib/exercises.js'
import { bestWeightFor } from '../lib/history.js'
import { fmtNum } from '../lib/format.js'
import { t } from '../lib/i18n.js'
import { Thumb } from '../components/Media.jsx'
import { exerciseDetailSheet, addToRoutineSheet, customExSheet } from '../sheets.jsx'
import Icon from '../components/Icon.jsx'
import { Button } from '../components/ui.jsx'

export default function Library() {
  const S = useStore(s => s.S)
  const update = useStore(s => s.update)
  const [q, setQ] = useState('')
  const [bp, setBp] = useState('')
  const [eq, setEq] = useState('')
  const [shown, setShown] = useState(40)

  const favs = S.favorites || []
  const toggleFav = (ev, id) => {
    ev.stopPropagation()
    update(s => {
      const list = s.favorites || []
      s.favorites = list.includes(id) ? list.filter(x => x !== id) : [...list, id]
    })
  }

  const ql = q.toLowerCase().trim()
  const base = allExercises(S).filter(e => {
    if (bp === '★' && !favs.includes(e.id)) return false
    if (bp && bp !== '★' && e.bp !== bp) return false
    if (ql && !(e.n.toLowerCase().includes(ql) || (e.tg && e.tg.toLowerCase().includes(ql)) || (e.eq && e.eq.toLowerCase().includes(ql)) || ((e.desc || '').toLowerCase().includes(ql)))) {
      return false
    }
    return true
  })

  const eqOpts = equipmentOf(base)
  // Drop the equipment filter if the search narrowed it away, so you never hit a dead end.
  const eqOn = eqOpts.includes(eq) ? eq : ''
  const f = eqOn ? base.filter(e => e.eq === eqOn) : base

  return <>
    <div className="hdr"><div><h1>{t('Exercises')}</h1><div className="sub">{t('{0} exercises with animations', EXDB.length)}</div></div></div>

    <div className="search" style={{ marginBottom: 10, position: 'relative' }}>
      <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></svg>
      <input
        className="input"
        placeholder={t('Search…')}
        value={q}
        onChange={e => { setQ(e.target.value); setShown(40) }}
      />
      {q && (
        <button
          className="iconbtn"
          onClick={() => { setQ(''); setShown(40) }}
          aria-label={t('Clear search')}
          style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', width: 28, height: 28 }}
        >
          <Icon name="xmark" />
        </button>
      )}
    </div>

    <div className="chips" style={{ marginBottom: eqOpts.length > 1 ? 8 : 12 }}>
      {favs.length > 0 && (
        <button className={'chip' + (bp === '★' ? ' on' : '')} onClick={() => { setBp('★'); setEq(''); setShown(40) }}>
          <Icon name="starFill" style={{ fontSize: 12, marginRight: 4, display: 'inline-block', verticalAlign: '-1px' }} />
          {t('Favorites')} ({favs.length})
        </button>
      )}
      <button className={'chip nocap' + (!bp ? ' on' : '')} onClick={() => { setBp(''); setEq(''); setShown(40) }}>{t('All')}</button>
      {BODYPARTS.map(b => <button key={b} className={'chip' + (bp === b ? ' on' : '')} onClick={() => { setBp(b); setEq(''); setShown(40) }}>{t(b)}</button>)}
    </div>

    {eqOpts.length > 1 && <div className="chips" style={{ marginBottom: 12 }}>
      <button className={'chip nocap' + (!eqOn ? ' on' : '')} onClick={() => { setEq(''); setShown(40) }}>{t('Any equipment')}</button>
      {eqOpts.map(x => <button key={x} className={'chip' + (eqOn === x ? ' on' : '')} onClick={() => { setEq(x); setShown(40) }}>{t(x)}</button>)}
    </div>}

    <div className="list">
      {bp !== '★' && (
        <div className="item" onClick={() => customExSheet(null, ex => exerciseDetailSheet(ex), q.trim())}>
          <div className="thumb thumb-x"><Icon name="sparkles" /></div>
          <div className="grow"><div className="tt">{t('Create your own exercise')}</div><div className="ss">{t('name + body part, no animation')}</div></div><Icon name="plus" className="chev" />
        </div>
      )}
      {f.slice(0, shown).map(e => {
        const best = bestWeightFor(S, e.id)
        const isFav = favs.includes(e.id)
        return <div key={e.id} className="item" onClick={() => exerciseDetailSheet(e)}>
          <Thumb ex={e} />
          <div className="grow"><div className="tt capitalize">{e.n}</div><div className="ss capitalize">{t(e.tg || e.bp)} · {t(e.eq)}</div></div>
          {best > 0 && <span className="tag acc">{fmtNum(best)}</span>}
          <button
            className={'iconbtn' + (isFav ? ' acc' : ' dim')}
            onClick={ev => toggleFav(ev, e.id)}
            title={isFav ? t('Remove from favorites') : t('Add to favorites')}
            aria-label={isFav ? t('Remove from favorites') : t('Add to favorites')}
            style={{ width: 32, height: 32, flex: 'none' }}
          >
            <Icon name={isFav ? 'starFill' : 'star'} />
          </button>
          <Button size="sm" variant="tinted" icon="plus" onClick={ev => { ev.stopPropagation(); addToRoutineSheet(e) }}>{t('Plan')}</Button>
        </div>
      })}
      {f.length === 0 && <div className="empty"><div className="ico"><Icon name="magnifier" /></div>{t('No match')}</div>}
    </div>
    {f.length > shown && <><div style={{ height: 10 }} /><Button onClick={() => setShown(s => s + 40)}>{t('Show more')}</Button></>}
  </>
}
