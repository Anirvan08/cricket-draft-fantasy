/**
 * CricAPI scorecard parser.
 *
 * Converts a raw CricAPI v1 `match_scorecard` response into a flat map of
 * player stats keyed by API player ID.
 *
 * Scorecard shape (CricAPI v1):
 * {
 *   status: "success",
 *   data: {
 *     scorecard: [
 *       {
 *         inning: "Team A Inning 1",
 *         batting: [{ batsman: {id, name}, r, b, "4s", "6s", "dismissal-text" }],
 *         bowling: [{ bowler: {id, name}, o, r, w, m }]
 *       }, ...
 *     ]
 *   }
 * }
 */

/** Convert CricAPI overs string "4.2" → decimal overs 4.333 */
function oversToDecimal(oStr) {
  const parts = String(oStr ?? '0').split('.')
  const complete = parseInt(parts[0]) || 0
  const balls    = parseInt(parts[1]) || 0
  return complete + balls / 6
}

/**
 * Parse dismissal text to determine dismissal type and fielder(s) involved.
 * Returns { type, fielderId?, fielderName?, bowlerId?, lbwOrBowled }
 *
 * Common patterns:
 *  "not out"                       → not out
 *  "b Bumrah"                      → bowled
 *  "lbw b Bumrah"                  → lbw
 *  "c Rohit b Bumrah"              → caught (fielder = Rohit)
 *  "c & b Bumrah"                  → caught & bowled (fielder = bowler)
 *  "st †Dhoni b Jadeja"            → stumped (fielder = Dhoni)
 *  "run out (Kohli)"               → runout direct
 *  "run out (Kohli/Dhoni)"         → runout indirect (two fielders)
 *  "retired hurt"                  → not out
 */
function parseDismissal(text) {
  if (!text) return { dismissed: false }
  const t = text.trim().toLowerCase()

  if (t === 'not out' || t.startsWith('retired')) {
    return { dismissed: false }
  }

  if (t.startsWith('run out')) {
    // "run out (Kohli)" or "run out (Kohli/Dhoni)"
    const inner = text.match(/\(([^)]+)\)/)
    if (inner) {
      const names = inner[1].split('/').map(n => n.trim())
      if (names.length === 1) {
        return { dismissed: true, type: 'runout_direct', fielderName: names[0] }
      } else {
        // Both fielders get indirect credit
        return { dismissed: true, type: 'runout_indirect', fielderNames: names }
      }
    }
    return { dismissed: true, type: 'runout_direct' }
  }

  if (t.startsWith('st ')) {
    // "st †Dhoni b Jadeja" — strip † prefix from keeper name
    const match = text.match(/^st\s+[†]?(\S+)/)
    return { dismissed: true, type: 'stumped', fielderName: match?.[1] }
  }

  if (t === 'c & b' || t.startsWith('c & b ')) {
    // Caught and bowled — bowler is also the fielder
    const bowlerName = text.replace(/^c & b\s*/i, '').trim()
    return { dismissed: true, type: 'caught_and_bowled', fielderName: bowlerName, lbwOrBowled: false }
  }

  if (t.startsWith('c ')) {
    // "c Rohit b Bumrah"
    const match = text.match(/^c\s+(.+?)\s+b\s+(.+)$/i)
    return {
      dismissed: true,
      type: 'caught',
      fielderName: match?.[1]?.trim(),
      lbwOrBowled: false,
    }
  }

  if (t.startsWith('lbw')) {
    return { dismissed: true, type: 'lbw', lbwOrBowled: true }
  }

  if (t.startsWith('b ')) {
    return { dismissed: true, type: 'bowled', lbwOrBowled: true }
  }

  return { dismissed: true, type: 'other', lbwOrBowled: false }
}

/**
 * Fuzzy name match: does the short name from dismissal text match a full player name?
 * e.g. "Rohit" matches "Rohit Sharma", "KL Rahul" matches "KL Rahul"
 */
function nameMatches(shortName, fullName) {
  if (!shortName || !fullName) return false
  const s = shortName.toLowerCase().trim()
  const f = fullName.toLowerCase().trim()
  return f === s || f.startsWith(s + ' ') || f.endsWith(' ' + s)
}

/**
 * Build a lookup: playerName (lowercase) → API player ID
 * from all batting/bowling entries across all innings.
 */
function buildNameIdMap(scorecard) {
  const map = {}
  for (const inning of scorecard) {
    for (const b of (inning.batting ?? [])) {
      if (b.batsman?.id) map[b.batsman.name.toLowerCase()] = b.batsman.id
    }
    for (const b of (inning.bowling ?? [])) {
      if (b.bowler?.id) map[b.bowler.name.toLowerCase()] = b.bowler.id
    }
  }
  return map
}

/**
 * Main parser.
 * Returns a Map<apiPlayerId, statsObject> for every player who appeared.
 *
 * statsObject shape matches the player_match_points columns.
 */
export function parseScorecard(data) {
  const scorecard = data?.scorecard
  if (!scorecard?.length) throw new Error('No scorecard data in response')

  const nameIdMap = buildNameIdMap(scorecard)
  const players   = new Map() // apiPlayerId → stats

  function getOrCreate(id, name) {
    if (!id) return null
    if (!players.has(id)) {
      players.set(id, {
        api_player_id:   id,
        api_player_name: name,
        runs:            0,
        balls_faced:     0,
        fours:           0,
        sixes:           0,
        dismissed:       false,
        did_play:        true,
        wickets:         0,
        lbw_bowled_count:0,
        maiden_overs:    0,
        overs_bowled:    0,
        runs_conceded:   0,
        catches:         0,
        stumpings:       0,
        runouts_direct:  0,
        runouts_indirect:0,
      })
    }
    return players.get(id)
  }

  // Collect lbw/bowled per bowler separately (need bowling entry to match)
  const lbwBowledByBowler = new Map() // bowlerId → count

  for (const inning of scorecard) {
    // ── Batting entries ────────────────────────────────────
    for (const entry of (inning.batting ?? [])) {
      const id   = entry.batsman?.id
      const name = entry.batsman?.name
      if (!id) continue

      const p = getOrCreate(id, name)
      p.runs        += entry.r  ?? 0
      p.balls_faced += entry.b  ?? 0
      p.fours       += entry['4s'] ?? 0
      p.sixes       += entry['6s'] ?? 0

      const dismissal = parseDismissal(entry['dismissal-text'])
      if (dismissal.dismissed) p.dismissed = true

      if (!dismissal.dismissed) continue

      // Attribute fielding to the fielder(s)
      if (dismissal.type === 'caught' && dismissal.fielderName) {
        const fId = resolveFielderId(dismissal.fielderName, nameIdMap)
        if (fId) { const fp = getOrCreate(fId, dismissal.fielderName); fp.catches++ }
      }

      if (dismissal.type === 'caught_and_bowled' && dismissal.fielderName) {
        // The bowler is also the fielder
        const fId = resolveFielderId(dismissal.fielderName, nameIdMap)
        if (fId) { const fp = getOrCreate(fId, dismissal.fielderName); fp.catches++ }
      }

      if (dismissal.type === 'stumped' && dismissal.fielderName) {
        const fId = resolveFielderId(dismissal.fielderName, nameIdMap)
        if (fId) { const fp = getOrCreate(fId, dismissal.fielderName); fp.stumpings++ }
      }

      if (dismissal.type === 'runout_direct' && dismissal.fielderName) {
        const fId = resolveFielderId(dismissal.fielderName, nameIdMap)
        if (fId) { const fp = getOrCreate(fId, dismissal.fielderName); fp.runouts_direct++ }
      }

      if (dismissal.type === 'runout_indirect' && dismissal.fielderNames) {
        for (const fn of dismissal.fielderNames) {
          const fId = resolveFielderId(fn, nameIdMap)
          if (fId) { const fp = getOrCreate(fId, fn); fp.runouts_indirect++ }
        }
      }

      // Track LBW / bowled against the bowler (resolved later from bowling data)
      if (dismissal.lbwOrBowled) {
        // We'll match it to a bowler using inning bowling data heuristically.
        // The bowler responsible is the one whose name appears after "b " in dismissal text.
        const bowlerName = entry['dismissal-text']?.replace(/^.*\bb\s+/i, '').trim()
        if (bowlerName) {
          const bId = resolveFielderId(bowlerName, nameIdMap)
          if (bId) lbwBowledByBowler.set(bId, (lbwBowledByBowler.get(bId) ?? 0) + 1)
        }
      }
    }

    // ── Bowling entries ────────────────────────────────────
    for (const entry of (inning.bowling ?? [])) {
      const id   = entry.bowler?.id
      const name = entry.bowler?.name
      if (!id) continue

      const p = getOrCreate(id, name)
      p.wickets      += entry.w ?? 0
      p.maiden_overs += entry.m ?? 0
      p.overs_bowled += oversToDecimal(entry.o)
      p.runs_conceded+= entry.r ?? 0
    }
  }

  // Apply lbw/bowled counts to bowlers
  for (const [bowlerId, count] of lbwBowledByBowler) {
    if (players.has(bowlerId)) {
      players.get(bowlerId).lbw_bowled_count += count
    }
  }

  return players
}

/** Resolve a short fielder/bowler name from dismissal text to an API player ID */
function resolveFielderId(shortName, nameIdMap) {
  if (!shortName) return null
  const s = shortName.toLowerCase().trim().replace(/^[†+]/, '') // strip keeper symbol
  // Exact match first
  if (nameIdMap[s]) return nameIdMap[s]
  // Partial match
  for (const [fullName, id] of Object.entries(nameIdMap)) {
    if (nameMatches(s, fullName)) return id
  }
  return null
}
