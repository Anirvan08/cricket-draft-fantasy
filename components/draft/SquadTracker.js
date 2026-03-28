'use client'

import { useState } from 'react'
import styles from './SquadTracker.module.css'

const ROLE_LABEL = { BAT: 'Bat', BOWL: 'Bowl', AR: 'AR', WK: 'WK' }

export default function SquadTracker({ members, picks, currentUserId, playersPerTeam }) {
  const [activeTab, setActiveTab] = useState(
    members.find(m => m.user_id === currentUserId)?.id ?? members[0]?.id
  )

  const picksByMember = picks.reduce((acc, pick) => {
    acc[pick.league_member_id] = acc[pick.league_member_id] ?? []
    acc[pick.league_member_id].push(pick)
    return acc
  }, {})

  return (
    <div className={styles.container}>
      <div className={styles.tabs}>
        {members.map(m => {
          const count = picksByMember[m.id]?.length ?? 0
          const isYou = m.user_id === currentUserId
          return (
            <button
              key={m.id}
              className={`${styles.tab} ${activeTab === m.id ? styles.tabActive : ''}`}
              onClick={() => setActiveTab(m.id)}
            >
              <span>{isYou ? 'You' : m.user.display_name}</span>
              <span className={styles.count}>{count}/{playersPerTeam}</span>
            </button>
          )
        })}
      </div>

      <div className={styles.squad}>
        {(picksByMember[activeTab] ?? []).map((pick, i) => (
          <div key={pick.id} className={styles.pickRow}>
            <span className={styles.pickNum}>{i + 1}</span>
            <span className={styles.pickName}>{pick.player.name}</span>
            <div className={styles.pickMeta}>
              <span className={`${styles.roleTag} ${styles[`role_${pick.player.role}`]}`}>
                {ROLE_LABEL[pick.player.role]}
              </span>
              <span className={styles.teamTag}>{pick.player.ipl_team}</span>
            </div>
          </div>
        ))}

        {/* Empty slots */}
        {Array.from({ length: playersPerTeam - (picksByMember[activeTab]?.length ?? 0) }).map((_, i) => (
          <div key={`empty-${i}`} className={`${styles.pickRow} ${styles.emptyRow}`}>
            <span className={styles.pickNum}>
              {(picksByMember[activeTab]?.length ?? 0) + i + 1}
            </span>
            <span className={styles.emptyLabel}>—</span>
          </div>
        ))}
      </div>
    </div>
  )
}
