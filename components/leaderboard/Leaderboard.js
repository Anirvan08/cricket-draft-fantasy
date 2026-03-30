'use client'

import { useState, useMemo } from 'react'
import styles from './Leaderboard.module.css'

const ROLE_LABEL = { BAT: 'Bat', BOWL: 'Bowl', AR: 'All-R', WK: 'WK' }
const MEDALS = ['🥇', '🥈', '🥉']

export default function Leaderboard({ league, members, matches, points, currentUserId }) {
  const [tab, setTab] = useState('standings')
  const [expandedMatch, setExpandedMatch] = useState(null)
  const [expandedMember, setExpandedMember] = useState(null)

  // Total points per member
  const memberTotals = useMemo(() => {
    const totals = {}
    members.forEach(m => { totals[m.id] = 0 })
    points.forEach(p => {
      if (totals[p.league_member_id] !== undefined) {
        totals[p.league_member_id] += p.fantasy_points
      }
    })
    return totals
  }, [members, points])

  // Ranked members
  const ranked = useMemo(() => {
    return [...members].sort((a, b) => memberTotals[b.id] - memberTotals[a.id])
  }, [members, memberTotals])

  // Last processed match
  const lastMatch = useMemo(() => {
    const processed = matches.filter(m => m.points_processed)
    if (processed.length === 0) return null
    return processed.sort((a, b) => new Date(b.match_date) - new Date(a.match_date))[0]
  }, [matches])

  // Points per match per member
  const matchPoints = useMemo(() => {
    const map = {}
    points.forEach(p => {
      if (!map[p.match_id]) map[p.match_id] = {}
      map[p.match_id][p.league_member_id] = (map[p.match_id][p.league_member_id] ?? 0) + p.fantasy_points
    })
    return map
  }, [points])

  // Last match points per member (for the "last match" column)
  const lastMatchPts = useMemo(() => {
    if (!lastMatch) return {}
    return matchPoints[lastMatch.id] ?? {}
  }, [lastMatch, matchPoints])

  // Per-match top scorer member id
  const matchTopScorer = useMemo(() => {
    const top = {}
    for (const [matchId, perMember] of Object.entries(matchPoints)) {
      let bestId = null, bestPts = -Infinity
      for (const [memberId, pts] of Object.entries(perMember)) {
        if (pts > bestPts) { bestPts = pts; bestId = memberId }
      }
      top[matchId] = bestId
    }
    return top
  }, [matchPoints])

  // Points per match per member per player (for breakdown)
  const matchPlayerPoints = useMemo(() => {
    const map = {}
    points.forEach(p => {
      if (!map[p.match_id]) map[p.match_id] = {}
      if (!map[p.match_id][p.league_member_id]) map[p.match_id][p.league_member_id] = []
      map[p.match_id][p.league_member_id].push(p)
    })
    return map
  }, [points])

  const hasMatches = matches.length > 0
  const hasPoints = points.length > 0
  const leaderPts = ranked.length > 0 ? memberTotals[ranked[0].id] : 0

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Leaderboard</h1>
          <p className={styles.leagueName}>{league.name}</p>
        </div>
        {lastMatch && (
          <div className={styles.lastMatchBadge}>
            <span className={styles.lastMatchLabel}>Last match</span>
            <span className={styles.lastMatchTeams}>{lastMatch.team_a} vs {lastMatch.team_b}</span>
          </div>
        )}
      </div>

      <div className={styles.tabs}>
        <button
          className={`${styles.tab} ${tab === 'standings' ? styles.tabActive : ''}`}
          onClick={() => setTab('standings')}
        >
          Standings
        </button>
        <button
          className={`${styles.tab} ${tab === 'matches' ? styles.tabActive : ''}`}
          onClick={() => setTab('matches')}
        >
          Match history {hasMatches && <span className={styles.tabCount}>{matches.length}</span>}
        </button>
      </div>

      {tab === 'standings' && (
        <div className={styles.standings}>
          {/* Column labels */}
          {hasPoints && (
            <div className={styles.columnLabels}>
              <span className={styles.colSpacer}></span>
              {lastMatch && <span className={`${styles.colLabel} ${styles.colLabelLast}`}>Last</span>}
              <span className={`${styles.colLabel} ${styles.colLabelTotal}`}>Total</span>
              <span className={styles.colLabelChevron}></span>
            </div>
          )}

          {ranked.map((member, i) => {
            const total = memberTotals[member.id]
            const isYou = member.user_id === currentUserId
            const isExpanded = expandedMember === member.id
            const lastPts = lastMatchPts[member.id] ?? 0
            const rankClass = i === 0 ? styles.rank1 : i === 1 ? styles.rank2 : i === 2 ? styles.rank3 : ''

            // Player breakdown
            const memberPoints = points.filter(p => p.league_member_id === member.id)
            const byPlayer = memberPoints.reduce((acc, p) => {
              const key = p.player_id
              if (!acc[key]) acc[key] = { player: p.player, total: 0 }
              acc[key].total += p.fantasy_points
              return acc
            }, {})
            const playerBreakdown = Object.values(byPlayer).sort((a, b) => b.total - a.total)

            return (
              <div key={member.id}>
              {i === 3 && hasPoints && <hr className={styles.podiumDivider} />}
              <div className={`${styles.memberRow} ${isYou ? styles.youRow : rankClass}`}>
                <button
                  className={styles.memberMain}
                  onClick={() => setExpandedMember(isExpanded ? null : member.id)}
                >
                  <span className={styles.rank}>
                    {i < 3 ? MEDALS[i] : <span className={styles.rankNum}>{i + 1}</span>}
                  </span>
                  <span className={styles.memberName}>
                    {member.user?.display_name ?? 'Unknown'}
                    {isYou && <span className={styles.youTag}>you</span>}
                  </span>
                  {lastMatch && hasPoints && (
                    <span className={styles.lastPts}>{lastPts.toFixed(1)}</span>
                  )}
                  <span className={styles.totalPts}>{total.toFixed(1)}</span>
                  <span className={`${styles.chevron} ${isExpanded ? styles.chevronOpen : ''}`}>▾</span>
                </button>

                {isExpanded && (
                  <div className={styles.playerBreakdown}>
                    {playerBreakdown.length === 0 ? (
                      <p className={styles.noData}>No points recorded yet.</p>
                    ) : (
                      playerBreakdown.map(({ player, total: pts }) => (
                        <div key={player.id} className={styles.breakdownRow}>
                          <span className={styles.breakdownName}>{player.name}</span>
                          <span className={`${styles.roleTag} ${styles[`role_${player.role}`]}`}>
                            {ROLE_LABEL[player.role]}
                          </span>
                          <span className={styles.breakdownTeam}>{player.ipl_team}</span>
                          <span className={`${styles.breakdownPts} ${pts < 0 ? styles.negPts : ''}`}>{pts.toFixed(1)}</span>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
              </div>
            )
          })}

          {!hasPoints && (
            <p className={styles.emptyHint}>
              Points will appear here once matches are processed.
            </p>
          )}
        </div>
      )}

      {tab === 'matches' && (
        <div className={styles.matchList}>
          {!hasMatches && (
            <p className={styles.emptyHint}>No matches scheduled yet.</p>
          )}
          {[...matches]
            .sort((a, b) => new Date(b.match_date) - new Date(a.match_date))
            .map(match => {
            const isExpanded = expandedMatch === match.id
            const perMember = matchPoints[match.id] ?? {}
            const topMemberId = matchTopScorer[match.id]

            return (
              <div key={match.id} className={styles.matchCard}>
                <button
                  className={styles.matchHeader}
                  onClick={() => setExpandedMatch(isExpanded ? null : match.id)}
                >
                  <div className={styles.matchTitle}>
                    <span className={styles.matchTeams}>{match.team_a} vs {match.team_b}</span>
                    <span className={styles.matchDate}>
                      {new Date(match.match_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                    </span>
                  </div>
                  <div className={styles.matchRight}>
                    {match.points_processed
                      ? <span className={styles.processedBadge}>Processed</span>
                      : <span className={styles.pendingBadge}>Pending</span>
                    }
                    <span className={`${styles.chevron} ${isExpanded ? styles.chevronOpen : ''}`}>▾</span>
                  </div>
                </button>

                {isExpanded && (
                  <div className={styles.matchBreakdown}>
                    <div className={styles.matchMemberList}>
                      {[...members]
                        .sort((a, b) => (perMember[b.id] ?? 0) - (perMember[a.id] ?? 0))
                        .map((m, idx) => {
                          const pts = perMember[m.id] ?? 0
                          const playerRows = matchPlayerPoints[match.id]?.[m.id] ?? []
                          const isTop = m.id === topMemberId && match.points_processed
                          return (
                            <div key={m.id} className={`${styles.matchMemberRow} ${isTop ? styles.topScorer : ''}`}>
                              <div className={styles.matchMemberHeader}>
                                <span className={styles.matchMemberRank}>{idx + 1}</span>
                                <span className={styles.matchMemberName}>
                                  {m.user?.display_name ?? 'Unknown'}
                                  {m.user_id === currentUserId && <span className={styles.youTag}>you</span>}
                                  {isTop && <span className={styles.crownTag}>Best</span>}
                                </span>
                                <span className={styles.matchMemberPts}>{pts.toFixed(1)}</span>
                              </div>
                              {playerRows.length > 0 && (
                                <div className={styles.matchPlayerList}>
                                  {[...playerRows]
                                    .sort((a, b) => b.fantasy_points - a.fantasy_points)
                                    .map(row => (
                                      <div key={row.id} className={styles.matchPlayerRow}>
                                        <span className={styles.breakdownName}>{row.player.name}</span>
                                        <span className={`${styles.roleTag} ${styles[`role_${row.player.role}`]}`}>
                                          {ROLE_LABEL[row.player.role]}
                                        </span>
                                        <span className={`${styles.breakdownPts} ${row.fantasy_points < 0 ? styles.negPts : ''}`}>
                                          {row.fantasy_points.toFixed(1)}
                                        </span>
                                      </div>
                                    ))}
                                </div>
                              )}
                            </div>
                          )
                        })}
                    </div>
                    {!match.points_processed && (
                      <p className={styles.pendingNote}>Points not yet calculated for this match.</p>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
