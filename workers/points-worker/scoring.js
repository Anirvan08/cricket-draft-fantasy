/**
 * Pure fantasy points calculator — no I/O, fully testable in isolation.
 * Implements the My11Circle scoring system as defined in plam.md.
 *
 * @param {object} stats
 * @param {string} role  — 'BAT' | 'BOWL' | 'AR' | 'WK'
 * @returns {number} fantasy_points
 */
export function calculateFantasyPoints(stats, role) {
  let pts = 0

  // ── Appearance ────────────────────────────────────────────
  if (stats.did_play) pts += 4

  // ── Batting ───────────────────────────────────────────────
  pts += stats.runs * 1
  pts += stats.fours * 4
  pts += stats.sixes * 6

  // Milestone bonuses are cumulative:
  // score 100 → +4 (25) +8 (50) +12 (75) +16 (100) = +40 bonus
  if (stats.runs >= 25)  pts += 4
  if (stats.runs >= 50)  pts += 8
  if (stats.runs >= 75)  pts += 12
  if (stats.runs >= 100) pts += 16

  // Duck: dismissed for 0, BAT / WK / AR only
  if (stats.runs === 0 && stats.dismissed && role !== 'BOWL') pts -= 2

  // ── Bowling ───────────────────────────────────────────────
  pts += stats.wickets * 30
  pts += stats.lbw_bowled_count * 8
  pts += stats.maiden_overs * 12

  // Wicket bonus milestones (cumulative)
  if (stats.wickets >= 3) pts += 4
  if (stats.wickets >= 4) pts += 8
  if (stats.wickets >= 5) pts += 12

  // ── Fielding ──────────────────────────────────────────────
  pts += stats.catches * 8
  if (stats.catches >= 3) pts += 4   // 3-catch bonus
  pts += stats.stumpings * 12
  pts += stats.runouts_direct * 12
  pts += stats.runouts_indirect * 6

  // ── Economy rate (min 2 complete overs bowled) ────────────
  if (stats.overs_bowled >= 2) {
    const eco = stats.runs_conceded / stats.overs_bowled
    if      (eco < 5)    pts += 6
    else if (eco <= 5.99) pts += 4
    else if (eco <= 7)    pts += 2
    else if (eco <= 9.99) pts += 0
    else if (eco <= 11)   pts -= 2
    else if (eco <= 12)   pts -= 4
    else                  pts -= 6
  }

  // ── Strike rate (min 10 balls, BAT / WK / AR only) ────────
  if (stats.balls_faced >= 10 && role !== 'BOWL') {
    const sr = (stats.runs / stats.balls_faced) * 100
    if      (sr > 170)  pts += 6
    else if (sr > 150)  pts += 4
    else if (sr >= 130) pts += 2
    else if (sr > 70)   pts += 0
    else if (sr >= 60)  pts -= 2
    else if (sr >= 50)  pts -= 4
    else                pts -= 6
  }

  return pts
}
