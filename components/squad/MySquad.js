'use client'

import Link from 'next/link'
import styles from './MySquad.module.css'

const ROLE_LABEL = { BAT: 'Bat', BOWL: 'Bowl', AR: 'All-R', WK: 'WK' }
const ROLE_ORDER = ['WK', 'BAT', 'AR', 'BOWL']

export default function MySquad({ league, member, picks }) {
  const grouped = ROLE_ORDER.reduce((acc, role) => {
    acc[role] = picks.filter(p => p.player.role === role)
    return acc
  }, {})

  const totalSlots = league.players_per_team
  const filled = picks.length
  const isDraftDone = league.draft_status === 'completed'

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <Link href="/lobby" className={styles.backLink}>← Back to lobby</Link>
          <h1 className={styles.title}>My Squad</h1>
          <p className={styles.leagueName}>{league.name}</p>
        </div>
        <div className={styles.countBadge}>
          <span className={styles.countNum}>{filled}</span>
          <span className={styles.countDen}>/{totalSlots}</span>
          <span className={styles.countLabel}>players</span>
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
        return (
          <div key={role} className={styles.section}>
            <div className={styles.sectionHeader}>
              <span className={`${styles.roleTag} ${styles[`role_${role}`]}`}>
                {ROLE_LABEL[role]}
              </span>
              <span className={styles.roleCount}>{rolePicks.length}</span>
            </div>
            <div className={styles.playerList}>
              {rolePicks.map(pick => (
                <div key={pick.id} className={styles.playerCard}>
                  <div className={styles.playerInfo}>
                    <span className={styles.playerName}>{pick.player.name}</span>
                    <span className={styles.teamTag}>{pick.player.ipl_team}</span>
                  </div>
                  <span className={styles.pickNum}>#{pick.pick_number}</span>
                </div>
              ))}
            </div>
          </div>
        )
      })}

      {picks.length === 0 && (
        <p className={styles.empty}>No players drafted yet.</p>
      )}
    </div>
  )
}
