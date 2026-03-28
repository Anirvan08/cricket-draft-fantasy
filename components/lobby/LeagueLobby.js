'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import styles from './LeagueLobby.module.css'

export default function LeagueLobby({ league: initialLeague, members: initialMembers, currentUserId }) {
  const router = useRouter()
  const [league, setLeague] = useState(initialLeague)
  const [members, setMembers] = useState(initialMembers)
  const [copied, setCopied] = useState(false)
  const [loading, setLoading] = useState(null) // 'shuffle' | 'lock' | 'unlock' | 'start'

  const isAdmin = members.find(m => m.user_id === currentUserId)?.is_admin ?? false

  // Refetch members from server
  const refreshMembers = useCallback(async () => {
    const res = await fetch(`/api/leagues/${league.id}/members`)
    if (res.ok) {
      const json = await res.json()
      setMembers(json.data)
    }
  }, [league.id])

  // Realtime: watch league_members for new joins + league for status changes
  useEffect(() => {
    const supabase = createClient()

    const membersSub = supabase
      .channel(`lobby-members-${league.id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'league_members',
        filter: `league_id=eq.${league.id}`,
      }, () => refreshMembers())
      .subscribe()

    const leagueSub = supabase
      .channel(`lobby-league-${league.id}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'leagues',
        filter: `id=eq.${league.id}`,
      }, payload => setLeague(payload.new))
      .subscribe()

    return () => {
      supabase.removeChannel(membersSub)
      supabase.removeChannel(leagueSub)
    }
  }, [league.id, refreshMembers])

  // Redirect to draft room when draft goes active
  useEffect(() => {
    if (league.draft_status === 'active') {
      router.push(`/draft/${league.id}`)
    }
  }, [league.draft_status, league.id, router])

  async function handleShuffle() {
    setLoading('shuffle')
    await fetch(`/api/leagues/${league.id}/shuffle`, { method: 'POST' })
    await refreshMembers()
    setLoading(null)
  }

  async function handleToggleLock() {
    const newStatus = league.draft_status === 'locked' ? 'active' : 'locked'
    setLoading(newStatus === 'active' ? 'start' : 'lock')

    await fetch(`/api/leagues/${league.id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    })
    setLoading(null)
  }

  async function copyInviteCode() {
    await navigator.clipboard.writeText(league.invite_code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const membersWithOrder = members.filter(m => m.draft_order != null)
  const membersWithoutOrder = members.filter(m => m.draft_order == null)
  const allOrdersAssigned = members.length > 0 && membersWithoutOrder.length === 0
  const canStartDraft = isAdmin && allOrdersAssigned && members.length >= 2

  const statusLabel = {
    locked: { text: 'Waiting', color: '#f59e0b' },
    active: { text: 'Draft Live', color: '#22c55e' },
    backfill: { text: 'Backfill', color: '#818cf8' },
    completed: { text: 'Completed', color: '#94a3b8' },
  }[league.draft_status]

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.leagueName}>{league.name}</h1>
          <span className={styles.statusBadge} style={{ color: statusLabel.color, borderColor: statusLabel.color }}>
            {statusLabel.text}
          </span>
        </div>
        {isAdmin && (
          <a href={`/admin/${league.id}`} className={styles.adminLink}>Admin panel →</a>
        )}

        <div className={styles.inviteBox}>
          <span className={styles.inviteLabel}>Invite code</span>
          <div className={styles.inviteRow}>
            <span className={styles.inviteCode}>{league.invite_code}</span>
            <button className={styles.copyBtn} onClick={copyInviteCode}>
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
        </div>
      </div>

      <div className={styles.membersSection}>
        <div className={styles.sectionHeader}>
          <h2>Participants <span className={styles.count}>{members.length} / {league.max_participants}</span></h2>
          {isAdmin && (
            <button
              className={styles.shuffleBtn}
              onClick={handleShuffle}
              disabled={loading === 'shuffle'}
            >
              {loading === 'shuffle' ? 'Shuffling…' : '🔀 Shuffle order'}
            </button>
          )}
        </div>

        <div className={styles.memberGrid}>
          {members.map(member => (
            <div key={member.id} className={styles.memberCard}>
              <span className={styles.orderBadge}>
                {member.draft_order ?? '—'}
              </span>
              <div className={styles.memberInfo}>
                <span className={styles.memberName}>
                  {member.user?.display_name ?? 'Unknown'}
                  {member.user_id === currentUserId && <span className={styles.youTag}>you</span>}
                </span>
                {member.is_admin && <span className={styles.adminTag}>admin</span>}
              </div>
            </div>
          ))}

          {/* Empty slots */}
          {Array.from({ length: league.max_participants - members.length }).map((_, i) => (
            <div key={`empty-${i}`} className={`${styles.memberCard} ${styles.emptySlot}`}>
              <span className={styles.orderBadge}>—</span>
              <span className={styles.emptyLabel}>Waiting for player…</span>
            </div>
          ))}
        </div>
      </div>

      {isAdmin && (
        <div className={styles.adminPanel}>
          <h3>Admin controls</h3>
          {!allOrdersAssigned && members.length > 0 && (
            <p className={styles.hint}>Shuffle draft order before starting the draft.</p>
          )}
          <button
            className={canStartDraft ? styles.startBtn : styles.startBtnDisabled}
            onClick={handleToggleLock}
            disabled={!canStartDraft || !!loading}
          >
            {loading === 'start' ? 'Starting…' : '🚀 Start Draft'}
          </button>
          {!canStartDraft && (
            <p className={styles.disabledHint}>
              {members.length < 2
                ? 'Need at least 2 participants to start.'
                : 'Assign draft order to all participants first.'}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
