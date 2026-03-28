'use client'

import { useState, useMemo } from 'react'
import styles from './PlayerPool.module.css'

const ROLES = ['ALL', 'BAT', 'BOWL', 'AR', 'WK']
const ROLE_LABEL = { BAT: 'Bat', BOWL: 'Bowl', AR: 'All-R', WK: 'WK' }

export default function PlayerPool({ players, onPick, canPick, picking }) {
  const [search, setSearch] = useState('')
  const [activeTeam, setActiveTeam] = useState('ALL')
  const [activeRole, setActiveRole] = useState('ALL')

  const teams = useMemo(() => {
    const t = [...new Set(players.map(p => p.ipl_team))].sort()
    return ['ALL', ...t]
  }, [players])

  const filtered = useMemo(() => {
    return players.filter(p => {
      if (activeTeam !== 'ALL' && p.ipl_team !== activeTeam) return false
      if (activeRole !== 'ALL' && p.role !== activeRole) return false
      if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false
      return true
    })
  }, [players, activeTeam, activeRole, search])

  // Group by team for display
  const grouped = useMemo(() => {
    if (activeTeam !== 'ALL') return { [activeTeam]: filtered }
    return filtered.reduce((acc, p) => {
      acc[p.ipl_team] = acc[p.ipl_team] ?? []
      acc[p.ipl_team].push(p)
      return acc
    }, {})
  }, [filtered, activeTeam])

  return (
    <div className={styles.container}>
      <div className={styles.searchBar}>
        <input
          type="text"
          placeholder="Search players…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className={styles.searchInput}
        />
      </div>

      {/* Team tabs */}
      <div className={styles.tabs}>
        {teams.map(team => (
          <button
            key={team}
            className={`${styles.tab} ${activeTeam === team ? styles.tabActive : ''}`}
            onClick={() => { setActiveTeam(team); setSearch('') }}
          >
            {team}
          </button>
        ))}
      </div>

      {/* Role filter chips */}
      <div className={styles.roleChips}>
        {ROLES.map(role => (
          <button
            key={role}
            className={`${styles.chip} ${activeRole === role ? styles.chipActive : ''}`}
            onClick={() => setActiveRole(role)}
          >
            {role === 'ALL' ? 'All roles' : ROLE_LABEL[role]}
          </button>
        ))}
      </div>

      {/* Player list */}
      <div className={styles.list}>
        {Object.entries(grouped).map(([team, teamPlayers]) => (
          <div key={team}>
            {activeTeam === 'ALL' && (
              <div className={styles.teamHeader}>{team}</div>
            )}
            {teamPlayers.map(player => (
              <div key={player.id} className={styles.playerRow}>
                <div className={styles.playerInfo}>
                  <span className={styles.playerName}>{player.name}</span>
                  <span className={`${styles.roleTag} ${styles[`role_${player.role}`]}`}>
                    {ROLE_LABEL[player.role] ?? player.role}
                  </span>
                </div>
                <button
                  className={styles.pickBtn}
                  onClick={() => onPick(player)}
                  disabled={!canPick || picking === player.id}
                >
                  {picking === player.id ? '…' : 'Pick'}
                </button>
              </div>
            ))}
          </div>
        ))}

        {filtered.length === 0 && (
          <p className={styles.empty}>No players match your filters.</p>
        )}
      </div>
    </div>
  )
}
