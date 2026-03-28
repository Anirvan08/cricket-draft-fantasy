'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { getActivePickerOrder, getRoundNumber } from '@/lib/draft-utils'
import TurnBanner from './TurnBanner'
import PlayerPool from './PlayerPool'
import SquadTracker from './SquadTracker'
import styles from './DraftRoom.module.css'

export default function DraftRoom({ league: initialLeague, members, initialPicks, allPlayers, currentUserId }) {
  const router = useRouter()
  const [league, setLeague] = useState(initialLeague)
  const [picks, setPicks] = useState(initialPicks)
  const [picking, setPicking] = useState(null) // player id being submitted
  const [error, setError] = useState('')
  const [view, setView] = useState('pool') // 'pool' | 'squads' (mobile toggle)

  const currentMember = members.find(m => m.user_id === currentUserId)
  const isAdmin = currentMember?.is_admin ?? false

  // Derived state
  const totalPicks = members.length * league.players_per_team
  const activePickerOrder = getActivePickerOrder(league.current_pick_number, members.length)
  const activeMember = members.find(m => m.draft_order === activePickerOrder)
  const roundNumber = getRoundNumber(league.current_pick_number, members.length)
  const isYourTurn = activeMember?.user_id === currentUserId

  const pickedPlayerIds = useMemo(() => new Set(picks.map(p => p.player_id)), [picks])
  const availablePlayers = useMemo(() => allPlayers.filter(p => !pickedPlayerIds.has(p.id)), [allPlayers, pickedPlayerIds])

  // Refresh picks from server
  const refreshPicks = useCallback(async () => {
    const res = await fetch(`/api/draft/${league.id}/picks`)
    if (res.ok) {
      const json = await res.json()
      setPicks(json.data)
    }
  }, [league.id])

  // Realtime subscriptions
  useEffect(() => {
    const supabase = createClient()

    // Watch for new draft picks
    const picksSub = supabase
      .channel(`draft-picks-${league.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'draft_picks',
        filter: `league_id=eq.${league.id}`,
      }, () => refreshPicks())
      .subscribe()

    // Watch league for pick number / status changes
    const leagueSub = supabase
      .channel(`draft-league-${league.id}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'leagues',
        filter: `id=eq.${league.id}`,
      }, payload => setLeague(payload.new))
      .subscribe()

    return () => {
      supabase.removeChannel(picksSub)
      supabase.removeChannel(leagueSub)
    }
  }, [league.id, refreshPicks])

  // Redirect when draft completes
  useEffect(() => {
    if (league.draft_status === 'completed') {
      router.push(`/squad/${league.id}`)
    }
  }, [league.draft_status, league.id, router])

  async function handlePick(player) {
    setError('')
    setPicking(player.id)

    const res = await fetch(`/api/draft/${league.id}/pick`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerId: player.id }),
    })
    const json = await res.json()

    if (!res.ok) setError(json.error)
    setPicking(null)
  }

  async function handleAdvanceTurn() {
    setError('')
    const res = await fetch(`/api/draft/${league.id}/advance`, { method: 'POST' })
    const json = await res.json()
    if (!res.ok) setError(json.error)
  }

  const isDraftDone = league.current_pick_number > totalPicks

  return (
    <div className={styles.page}>
      <div className={styles.topBar}>
        <span className={styles.leagueName}>{league.name}</span>
        {isAdmin && (
          <button
            className={styles.advanceBtn}
            onClick={handleAdvanceTurn}
            title="Skip current turn (admin)"
          >
            Skip turn
          </button>
        )}
      </div>

      {error && <div className={styles.errorBanner}>{error}</div>}

      <TurnBanner
        activeMember={activeMember}
        currentUserId={currentUserId}
        roundNumber={roundNumber}
        pickNumber={league.current_pick_number}
        totalPicks={totalPicks}
        onTimerExpire={() => {
          // Advisory only — just surfaces a visual cue, admin decides to skip
        }}
      />

      {/* Mobile view toggle */}
      <div className={styles.mobileToggle}>
        <button
          className={`${styles.toggleBtn} ${view === 'pool' ? styles.toggleActive : ''}`}
          onClick={() => setView('pool')}
        >
          Player pool ({availablePlayers.length})
        </button>
        <button
          className={`${styles.toggleBtn} ${view === 'squads' ? styles.toggleActive : ''}`}
          onClick={() => setView('squads')}
        >
          Squads
        </button>
      </div>

      <div className={styles.body}>
        <div className={`${styles.poolCol} ${view === 'pool' ? styles.visible : styles.hidden}`}>
          <PlayerPool
            players={availablePlayers}
            onPick={handlePick}
            canPick={isYourTurn && !isDraftDone}
            picking={picking}
          />
        </div>

        <div className={`${styles.squadsCol} ${view === 'squads' ? styles.visible : styles.hidden}`}>
          <SquadTracker
            members={members}
            picks={picks}
            currentUserId={currentUserId}
            playersPerTeam={league.players_per_team}
          />
        </div>
      </div>
    </div>
  )
}
