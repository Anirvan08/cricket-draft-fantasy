'use client'

import { useState, useMemo, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import PlayerPool from '@/components/draft/PlayerPool'
import styles from './AdminPanel.module.css'

const ROLE_LABEL = { BAT: 'Bat', BOWL: 'Bowl', AR: 'AR', WK: 'WK' }

export default function AdminPanel({ league, members, initialPicks, allPlayers, currentUserId }) {
  const router = useRouter()
  const [tab, setTab] = useState('picks') // 'picks' | 'replacements' | 'backfill'
  const [picks, setPicks] = useState(initialPicks)
  const [selectedMemberId, setSelectedMemberId] = useState(members[0]?.id ?? '')
  const [error, setError] = useState('')
  const [removing, setRemoving] = useState(null)
  const [adding, setAdding] = useState(null)
  const [replacingPick, setReplacingPick] = useState(null) // pick object being replaced
  const [replaceReason, setReplaceReason] = useState('')
  const [submittingReplace, setSubmittingReplace] = useState(null)

  const selectedMember = members.find(m => m.id === selectedMemberId)
  const backfillMembers = members.filter(m => m.has_pending_backfill)

  const pickedPlayerIds = useMemo(() => new Set(picks.map(p => p.player_id)), [picks])
  const availablePlayers = useMemo(
    () => allPlayers.filter(p => !pickedPlayerIds.has(p.id) && p.is_available !== false),
    [allPlayers, pickedPlayerIds]
  )
  const selectedMemberPicks = useMemo(
    () => picks.filter(p => p.league_member_id === selectedMemberId),
    [picks, selectedMemberId]
  )

  const refreshPicks = useCallback(async () => {
    const res = await fetch(`/api/draft/${league.id}/picks`)
    if (res.ok) {
      const json = await res.json()
      setPicks(json.data)
    }
  }, [league.id])

  useEffect(() => {
    const supabase = createClient()
    const sub = supabase
      .channel(`admin-picks-${league.id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'draft_picks',
        filter: `league_id=eq.${league.id}`,
      }, () => refreshPicks())
      .subscribe()

    return () => supabase.removeChannel(sub)
  }, [league.id, refreshPicks])

  async function handleAddPick(player) {
    setError('')
    setAdding(player.id)

    const res = await fetch(`/api/admin/${league.id}/pick`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerId: player.id, targetMemberId: selectedMemberId }),
    })
    const json = await res.json()

    if (!res.ok) setError(json.error)
    else await refreshPicks()

    setAdding(null)
  }

  async function handleRemovePick(pickId) {
    setError('')
    setRemoving(pickId)

    const res = await fetch(`/api/admin/${league.id}/pick`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pickId }),
    })
    const json = await res.json()

    if (!res.ok) setError(json.error)
    else await refreshPicks()

    setRemoving(null)
  }

  async function handleReplaceSubmit(newPlayer) {
    if (!replacingPick) return
    setError('')
    setSubmittingReplace(newPlayer.id)

    const res = await fetch(`/api/admin/${league.id}/pick`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pickId: replacingPick.id,
        newPlayerId: newPlayer.id,
        reason: replaceReason.trim() || null,
      }),
    })
    const json = await res.json()

    if (!res.ok) {
      setError(json.error)
      setSubmittingReplace(null)
      return
    }

    await refreshPicks()
    setSubmittingReplace(null)
    setReplacingPick(null)
    setReplaceReason('')
  }

  async function handleClearBackfill(memberId) {
    setError('')
    const res = await fetch(`/api/admin/${league.id}/backfill`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ memberId }),
    })
    const json = await res.json()
    if (!res.ok) setError(json.error)
    else router.refresh()
  }

  const spotsLeft = league.players_per_team - selectedMemberPicks.length

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <p className={styles.leagueLabel}>{league.name}</p>
          <h1 className={styles.title}>Admin Panel</h1>
        </div>
        <a href={`/lobby`} className={styles.backLink}>← Back to lobby</a>
      </div>

      {error && <div className={styles.errorBanner}>{error}</div>}

      <div className={styles.tabs}>
        <button className={`${styles.tab} ${tab === 'picks' ? styles.tabActive : ''}`} onClick={() => setTab('picks')}>
          Manage Picks
        </button>
        <button className={`${styles.tab} ${tab === 'replacements' ? styles.tabActive : ''}`} onClick={() => setTab('replacements')}>
          Replacements
        </button>
        <button className={`${styles.tab} ${tab === 'backfill' ? styles.tabActive : ''}`} onClick={() => setTab('backfill')}>
          Backfill
          {backfillMembers.length > 0 && <span className={styles.badge}>{backfillMembers.length}</span>}
        </button>
      </div>

      {tab === 'picks' && (
        <div className={styles.body}>
          <div className={styles.selectorBar}>
            <label className={styles.selectorLabel}>Managing picks for</label>
            <select
              className={styles.selector}
              value={selectedMemberId}
              onChange={e => setSelectedMemberId(e.target.value)}
            >
              {members.map(m => (
                <option key={m.id} value={m.id}>
                  {m.user?.display_name ?? 'Unknown'}{m.user_id === currentUserId ? ' (you)' : ''}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.columns}>
            <div className={styles.squadCol}>
              <div className={styles.colHeader}>
                <span>{selectedMember?.user?.display_name ?? '...'}'s squad</span>
                <span className={styles.spotsLeft}>{spotsLeft} spot{spotsLeft !== 1 ? 's' : ''} left</span>
              </div>
              <div className={styles.squadList}>
                {selectedMemberPicks.map((pick, i) => (
                  <div key={pick.id} className={styles.pickRow}>
                    <span className={styles.pickNum}>{i + 1}</span>
                    <span className={styles.pickName}>{pick.player.name}</span>
                    <div className={styles.pickMeta}>
                      <span className={`${styles.roleTag} ${styles[`role_${pick.player.role}`]}`}>
                        {ROLE_LABEL[pick.player.role]}
                      </span>
                      <span className={styles.teamTag}>{pick.player.ipl_team}</span>
                      {pick.picked_by === 'admin' && <span className={styles.adminTag}>admin</span>}
                    </div>
                    <button
                      className={styles.removeBtn}
                      onClick={() => handleRemovePick(pick.id)}
                      disabled={removing === pick.id}
                      title="Remove pick"
                    >
                      {removing === pick.id ? '…' : '✕'}
                    </button>
                  </div>
                ))}

                {selectedMemberPicks.length === 0 && (
                  <p className={styles.emptySquad}>No picks yet. Use the player pool to add.</p>
                )}
              </div>
            </div>

            <div className={styles.poolCol}>
              <PlayerPool
                players={availablePlayers}
                onPick={handleAddPick}
                canPick={spotsLeft > 0}
                picking={adding}
              />
            </div>
          </div>
        </div>
      )}

      {tab === 'replacements' && (
        <div className={styles.body}>
          <p className={styles.replacementsHint}>
            Replace a player who's injured, dropped from squad, or otherwise unavailable. Past points stay credited.
          </p>

          <div className={styles.selectorBar}>
            <label className={styles.selectorLabel}>Replace a player from</label>
            <select
              className={styles.selector}
              value={selectedMemberId}
              onChange={e => setSelectedMemberId(e.target.value)}
            >
              {members.map(m => (
                <option key={m.id} value={m.id}>
                  {m.user?.display_name ?? 'Unknown'}{m.user_id === currentUserId ? ' (you)' : ''}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.replacementList}>
            {selectedMemberPicks.length === 0 && (
              <p className={styles.emptySquad}>No picks for this member.</p>
            )}
            {selectedMemberPicks.map((pick, i) => (
              <div key={pick.id} className={styles.replacementRow}>
                <span className={styles.pickNum}>{i + 1}</span>
                <span className={styles.pickName}>{pick.player.name}</span>
                <div className={styles.pickMeta}>
                  <span className={`${styles.roleTag} ${styles[`role_${pick.player.role}`]}`}>
                    {ROLE_LABEL[pick.player.role]}
                  </span>
                  <span className={styles.teamTag}>{pick.player.ipl_team}</span>
                  {pick.replaced_from_player_id && <span className={styles.replacedTag}>swapped</span>}
                </div>
                <button
                  className={styles.replaceBtn}
                  onClick={() => { setReplacingPick(pick); setReplaceReason('') }}
                >
                  Replace →
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'backfill' && (
        <div className={styles.backfillTab}>
          {backfillMembers.length === 0 ? (
            <p className={styles.noBackfill}>No participants have pending backfill turns.</p>
          ) : (
            <>
              <p className={styles.backfillHint}>
                These participants skipped their turn during the draft. Switch to "Manage Picks" to add their missing players, then mark as done here.
              </p>
              {backfillMembers.map(m => {
                const memberPicks = picks.filter(p => p.league_member_id === m.id)
                const isFull = memberPicks.length >= league.players_per_team
                return (
                  <div key={m.id} className={styles.backfillRow}>
                    <div className={styles.backfillInfo}>
                      <span className={styles.backfillName}>{m.user?.display_name ?? 'Unknown'}</span>
                      <span className={styles.backfillCount}>{memberPicks.length}/{league.players_per_team} picks</span>
                    </div>
                    <div className={styles.backfillActions}>
                      <button
                        className={styles.manageBtn}
                        onClick={() => { setSelectedMemberId(m.id); setTab('picks') }}
                      >
                        Manage picks
                      </button>
                      <button
                        className={isFull ? styles.doneBtn : styles.doneBtnDisabled}
                        onClick={() => handleClearBackfill(m.id)}
                        disabled={!isFull}
                        title={!isFull ? 'Fill all spots before marking done' : ''}
                      >
                        Mark done
                      </button>
                    </div>
                  </div>
                )
              })}
            </>
          )}
        </div>
      )}

      {/* Replacement modal */}
      {replacingPick && (
        <div className={styles.modalOverlay} onClick={() => !submittingReplace && setReplacingPick(null)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>Replace player</h2>
              <button
                className={styles.modalClose}
                onClick={() => setReplacingPick(null)}
                disabled={!!submittingReplace}
              >×</button>
            </div>

            <div className={styles.modalSwap}>
              <div className={styles.swapOut}>
                <span className={styles.swapLabel}>Out</span>
                <span className={styles.swapName}>{replacingPick.player.name}</span>
                <span className={`${styles.roleTag} ${styles[`role_${replacingPick.player.role}`]}`}>
                  {ROLE_LABEL[replacingPick.player.role]}
                </span>
                <span className={styles.teamTag}>{replacingPick.player.ipl_team}</span>
              </div>
              <span className={styles.swapArrow}>→</span>
              <div className={styles.swapIn}>
                <span className={styles.swapLabel}>In</span>
                <span className={styles.swapHint}>Choose below</span>
              </div>
            </div>

            <div className={styles.modalReason}>
              <label className={styles.reasonLabel}>Reason (optional)</label>
              <input
                type="text"
                className={styles.reasonInput}
                placeholder="e.g. Injured, Dropped from squad"
                value={replaceReason}
                onChange={e => setReplaceReason(e.target.value)}
                disabled={!!submittingReplace}
              />
            </div>

            <div className={styles.modalPool}>
              <PlayerPool
                players={availablePlayers}
                onPick={handleReplaceSubmit}
                canPick={true}
                picking={submittingReplace}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
