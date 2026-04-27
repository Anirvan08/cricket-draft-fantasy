'use client'

import styles from './MySquad.module.css'

const ROLE_LABEL = { BAT: 'Bat', BOWL: 'Bowl', AR: 'All-R', WK: 'WK' }
const ROLE_ORDER = ['WK', 'BAT', 'AR', 'BOWL']

export default function MySquad({ league, member, picks, playerPoints = {}, totalPoints = 0, releasedPlayers = [] }) {
  const grouped = ROLE_ORDER.reduce((acc, role) => {
    acc[role] = picks.filter(p => p.player.role === role)
    return acc
  }, {})

  const totalSlots = league.players_per_team
  const filled = picks.length
  const isDraftDone = league.draft_status === 'completed'
  const hasPoints = totalPoints > 0

  // Sort picks within each role by points (highest first)
  ROLE_ORDER.forEach(role => {
    grouped[role].sort((a, b) => (playerPoints[b.player_id] ?? 0) - (playerPoints[a.player_id] ?? 0))
  })

  // Find best performer
  let bestPlayerId = null
  let bestPts = -Infinity
  picks.forEach(p => {
    const pts = playerPoints[p.player_id] ?? 0
    if (pts > bestPts) { bestPts = pts; bestPlayerId = p.player_id }
  })

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>My Squad</h1>
          <p className={styles.leagueName}>{league.name}</p>
        </div>
        <div className={styles.statsRow}>
          {hasPoints && (
            <div className={styles.totalBadge}>
              <span className={styles.totalNum}>{totalPoints.toFixed(1)}</span>
              <span className={styles.totalLabel}>pts</span>
            </div>
          )}
          <div className={styles.countBadge}>
            <span className={styles.countNum}>{filled}</span>
            <span className={styles.countDen}>/{totalSlots}</span>
            <span className={styles.countLabel}>players</span>
          </div>
        </div>
      </div>

      {!isDraftDone && filled < totalSlots && (
        <div className={styles.draftingBanner}>
          Draft in progress — {totalSlots - filled} slot{totalSlots - filled !== 1 ? 's' : ''} remaining
        </div>
      )}

      {ROLE_ORDER.map(role => {
        const rolePicks = grouped[role]
        if (rolePicks.length === 0) return null
        const roleTotal = rolePicks.reduce((sum, p) => sum + (playerPoints[p.player_id] ?? 0), 0)
        return (
          <div key={role} className={styles.section}>
            <div className={styles.sectionHeader}>
              <span className={`${styles.roleTag} ${styles[`role_${role}`]}`}>
                {ROLE_LABEL[role]}
              </span>
              <span className={styles.roleCount}>{rolePicks.length}</span>
              {hasPoints && <span className={styles.rolePts}>{roleTotal.toFixed(1)} pts</span>}
            </div>
            <div className={styles.playerList}>
              {rolePicks.map(pick => {
                const pts = playerPoints[pick.player_id] ?? 0
                const isBest = pick.player_id === bestPlayerId && bestPts > 0
                return (
                  <div key={pick.id} className={`${styles.playerCard} ${isBest ? styles.bestPlayer : ''}`}>
                    <div className={styles.playerInfo}>
                      <span className={styles.playerName}>
                        {pick.player.name}
                        {isBest && <span className={styles.mvpTag}>MVP</span>}
                      </span>
                      <span className={styles.teamTag}>{pick.player.ipl_team}</span>
                    </div>
                    <div className={styles.playerRight}>
                      {hasPoints && (
                        <span className={`${styles.playerPts} ${pts < 0 ? styles.negative : ''}`}>
                          {pts.toFixed(1)}
                        </span>
                      )}
                      <span className={styles.pickNum}>#{pick.pick_number}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}

      {releasedPlayers.length > 0 && (
        <div className={styles.released}>
          <div className={styles.releasedHeader}>
            <span className={styles.releasedLabel}>Released</span>
            <span className={styles.releasedHint}>Players you no longer hold (points retained)</span>
          </div>
          <div className={styles.releasedList}>
            {releasedPlayers.map(({ player, total }) => (
              <div key={player.id} className={styles.releasedCard}>
                <div className={styles.playerInfo}>
                  <span className={styles.playerName}>{player.name}</span>
                  <span className={`${styles.roleTag} ${styles[`role_${player.role}`]}`}>
                    {ROLE_LABEL[player.role]}
                  </span>
                  <span className={styles.teamTag}>{player.ipl_team}</span>
                </div>
                <span className={`${styles.playerPts} ${total < 0 ? styles.negative : ''}`}>
                  {total.toFixed(1)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {picks.length === 0 && (
        <p className={styles.empty}>No players drafted yet.</p>
      )}
    </div>
  )
}
