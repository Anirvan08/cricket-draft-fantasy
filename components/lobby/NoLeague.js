'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import styles from './NoLeague.module.css'

export default function NoLeague({ canCreate = false }) {
  const router = useRouter()
  const [view, setView] = useState(null) // null | 'create' | 'join'

  const [leagueName, setLeagueName] = useState('')
  const [maxParticipants, setMaxParticipants] = useState(8)
  const [inviteCode, setInviteCode] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleCreate(e) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const res = await fetch('/api/leagues', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: leagueName, maxParticipants }),
    })
    const json = await res.json()

    if (!res.ok) {
      setError(json.error)
      setLoading(false)
      return
    }

    router.refresh()
  }

  async function handleJoin(e) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const res = await fetch('/api/leagues/join', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ inviteCode }),
    })
    const json = await res.json()

    if (!res.ok) {
      setError(json.error)
      setLoading(false)
      return
    }

    router.refresh()
  }

  if (!view) {
    return (
      <div className={styles.container}>
        <h1 className={styles.title}>IPL Fantasy</h1>
        <p className={styles.subtitle}>Get started by creating or joining a league</p>
        <div className={styles.options}>
          {canCreate && (
            <button className={styles.optionBtn} onClick={() => setView('create')}>
              <span className={styles.optionIcon}>🏏</span>
              <span className={styles.optionLabel}>Create a league</span>
              <span className={styles.optionDesc}>Set up a new league and invite your friends</span>
            </button>
          )}
          <button className={styles.optionBtn} onClick={() => setView('join')}>
            <span className={styles.optionIcon}>🔗</span>
            <span className={styles.optionLabel}>Join a league</span>
            <span className={styles.optionDesc}>Enter an invite code from your league admin</span>
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.container}>
      <button className={styles.back} onClick={() => { setView(null); setError('') }}>← Back</button>

      {view === 'create' && (
        <div className={styles.formCard}>
          <h2>Create a league</h2>
          <form onSubmit={handleCreate} className={styles.form}>
            <div className={styles.field}>
              <label>League name</label>
              <input
                type="text"
                value={leagueName}
                onChange={e => setLeagueName(e.target.value)}
                placeholder="e.g. Friends IPL 2026"
                required
                maxLength={50}
              />
            </div>
            <div className={styles.field}>
              <label>Number of participants</label>
              <select value={maxParticipants} onChange={e => setMaxParticipants(Number(e.target.value))}>
                {[2, 3, 4, 5, 6, 7, 8].map(n => (
                  <option key={n} value={n}>{n} participants</option>
                ))}
              </select>
            </div>
            {error && <p className={styles.error}>{error}</p>}
            <button type="submit" className={styles.button} disabled={loading}>
              {loading ? 'Creating…' : 'Create league'}
            </button>
          </form>
        </div>
      )}

      {view === 'join' && (
        <div className={styles.formCard}>
          <h2>Join a league</h2>
          <form onSubmit={handleJoin} className={styles.form}>
            <div className={styles.field}>
              <label>Invite code</label>
              <input
                type="text"
                value={inviteCode}
                onChange={e => setInviteCode(e.target.value.toUpperCase())}
                placeholder="e.g. AB12CD"
                required
                maxLength={6}
                style={{ letterSpacing: '0.2em', textTransform: 'uppercase' }}
              />
            </div>
            {error && <p className={styles.error}>{error}</p>}
            <button type="submit" className={styles.button} disabled={loading}>
              {loading ? 'Joining…' : 'Join league'}
            </button>
          </form>
        </div>
      )}
    </div>
  )
}
