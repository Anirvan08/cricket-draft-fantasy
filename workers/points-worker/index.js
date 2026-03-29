/**
 * Cloudflare Worker — IPL Fantasy Points Calculator
 *
 * Cron: 0 1 * * *  (1:00 AM UTC = 6:30 AM IST)
 * Runs daily after IPL matches finish, calculates and stores fantasy points.
 *
 * Environment variables (set in Cloudflare dashboard or wrangler.toml [vars]):
 *   SUPABASE_URL             — e.g. https://xyz.supabase.co
 *   SUPABASE_SERVICE_ROLE_KEY
 *   CRICKET_DATA_API_KEY
 */

import { parseScorecard } from './parser.js'
import { calculateFantasyPoints } from './scoring.js'

export default {
  // Manual HTTP trigger for testing: GET /trigger
  async fetch(req, env) {
    if (new URL(req.url).pathname === '/trigger') {
      const result = await run(env)
      return Response.json(result)
    }
    return new Response('IPL Fantasy Points Worker', { status: 200 })
  },

  async scheduled(event, env, ctx) {
    ctx.waitUntil(run(env))
  },
}

const IPL_SERIES_ID = '87c62aac-bc3c-4738-ab93-19da0690488f' // IPL 2026

// ─── Main orchestration ─────────────────────────────────────────────────────

async function run(env) {
  const log = []
  const say = msg => { console.log(msg); log.push(msg) }

  say(`[${new Date().toISOString()}] Points worker started`)

  // Step 1: Auto-discover and store new IPL matches
  await syncIplMatches(env, say)

  // Yesterday in IST (UTC+5:30)
  const now = new Date()
  now.setMinutes(now.getMinutes() + 330) // shift to IST
  now.setDate(now.getDate() - 1)
  const yesterday = now.toISOString().slice(0, 10) // YYYY-MM-DD

  say(`\nProcessing points for ${yesterday}`)

  // Fetch unprocessed matches scheduled for yesterday
  const matches = await dbGet(env, `matches?match_date=eq.${yesterday}&points_processed=eq.false&select=*`)

  if (!matches.length) {
    say('No unprocessed matches found.')
    return { ok: true, log }
  }

  say(`Found ${matches.length} match(es) to process`)

  for (const match of matches) {
    say(`\n── Match: ${match.team_a} vs ${match.team_b} (${match.id})`)
    try {
      await processMatch(match, env, say)
    } catch (err) {
      say(`  ERROR: ${err.message}`)
    }
  }

  say('\nDone.')
  return { ok: true, log }
}

// ─── Auto-discover IPL matches from CricAPI ──────────────────────────────────

async function syncIplMatches(env, say) {
  say('Syncing IPL match schedule from CricAPI...')

  // Fetch all leagues so we know which league_ids to add matches to
  const leagues = await dbGet(env, 'leagues?select=id')
  if (!leagues.length) { say('  No leagues found.'); return }

  // Fetch currentMatches (paginated — IPL can appear on any page)
  const iplMatches = []
  for (let offset = 0; offset <= 50; offset += 25) {
    const res = await fetch(
      `https://api.cricapi.com/v1/currentMatches?apikey=${env.CRICKET_DATA_API_KEY}&offset=${offset}`
    )
    const json = await res.json()
    if (json.status !== 'success' || !json.data?.length) break

    const ipl = json.data.filter(m => m.series_id === IPL_SERIES_ID)
    iplMatches.push(...ipl)

    if (json.data.length < 25) break // last page
  }

  say(`  Found ${iplMatches.length} IPL matches in CricAPI`)

  if (!iplMatches.length) return

  // Upsert each match into every league
  const rows = []
  for (const league of leagues) {
    for (const m of iplMatches) {
      const teams = m.teams ?? []
      rows.push({
        league_id:    league.id,
        team_a:       teams[0] ?? 'TBD',
        team_b:       teams[1] ?? 'TBD',
        match_date:   m.date,
        api_match_id: m.id,
      })
    }
  }

  // Upsert on (league_id, api_match_id) — safe to run repeatedly
  const res = await fetch(`${env.SUPABASE_URL}/rest/v1/matches`, {
    method: 'POST',
    headers: {
      'apikey':        env.SUPABASE_SERVICE_ROLE_KEY,
      'Authorization': `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type':  'application/json',
      'Prefer':        'resolution=merge-duplicates',
    },
    body: JSON.stringify(rows),
  })

  if (!res.ok) {
    say(`  WARN: match upsert failed — ${await res.text()}`)
    return
  }

  say(`  Upserted ${rows.length} match row(s)`)
}

// ─── Per-match processing ────────────────────────────────────────────────────

async function processMatch(match, env, say) {
  if (!match.api_match_id) {
    say('  No api_match_id — skipping (add it manually to the matches table)')
    return
  }

  // 1. Fetch scorecard from CricAPI
  say(`  Fetching scorecard for api_match_id=${match.api_match_id}`)
  const url = `https://api.cricapi.com/v1/match_scorecard?apikey=${env.CRICKET_DATA_API_KEY}&id=${match.api_match_id}`
  const res = await fetch(url)
  const json = await res.json()

  if (json.status !== 'success') {
    throw new Error(`CricAPI error: ${JSON.stringify(json)}`)
  }

  // 2. Parse scorecard into per-player stats
  const parsedPlayers = parseScorecard(json.data) // Map<apiPlayerId, stats>
  say(`  Parsed ${parsedPlayers.size} players from scorecard`)

  // 3. Fetch all players from our DB to match api_player_id or name
  const dbPlayers = await dbGet(env, 'players?select=id,name,ipl_team,role,api_player_id')

  // Build lookup maps
  const byApiId   = new Map(dbPlayers.filter(p => p.api_player_id).map(p => [p.api_player_id, p]))
  const byName    = new Map(dbPlayers.map(p => [p.name.toLowerCase(), p]))

  // 4. Fetch all draft picks for this league (to know who owns which player)
  const draftPicks = await dbGet(env,
    `draft_picks?league_id=eq.${match.league_id}&select=player_id,league_member_id`
  )
  const pickMap = new Map() // player_id → league_member_id
  for (const pick of draftPicks) {
    pickMap.set(pick.player_id, pick.league_member_id)
  }

  say(`  ${draftPicks.length} draft picks in this league`)

  // 5. Build point rows
  const rows = []

  for (const [apiPlayerId, stats] of parsedPlayers) {
    // Resolve to our internal player row
    let dbPlayer = byApiId.get(apiPlayerId)
    if (!dbPlayer) {
      // Fall back to name match
      dbPlayer = byName.get(stats.api_player_name?.toLowerCase())
    }

    if (!dbPlayer) {
      say(`  WARN: no DB player for "${stats.api_player_name}" (api_id=${apiPlayerId}) — skipping`)
      continue
    }

    const leagueMemberId = pickMap.get(dbPlayer.id)
    if (!leagueMemberId) {
      // Player exists in DB but wasn't drafted in this league — ignore
      continue
    }

    const fantasy_points = calculateFantasyPoints(stats, dbPlayer.role)

    rows.push({
      match_id:          match.id,
      player_id:         dbPlayer.id,
      league_member_id:  leagueMemberId,
      runs:              stats.runs,
      balls_faced:       stats.balls_faced,
      fours:             stats.fours,
      sixes:             stats.sixes,
      wickets:           stats.wickets,
      lbw_bowled_count:  stats.lbw_bowled_count,
      maiden_overs:      stats.maiden_overs,
      overs_bowled:      stats.overs_bowled,
      runs_conceded:     stats.runs_conceded,
      catches:           stats.catches,
      stumpings:         stats.stumpings,
      runouts_direct:    stats.runouts_direct,
      runouts_indirect:  stats.runouts_indirect,
      did_play:          stats.did_play,
      fantasy_points,
    })

    say(`    ${dbPlayer.name} (${dbPlayer.role}): ${fantasy_points.toFixed(1)} pts`)
  }

  if (!rows.length) {
    say('  No drafted players found in scorecard.')
  } else {
    // 6. Upsert point rows (safe to re-run)
    await dbPost(env, 'player_match_points', rows, 'match_id,player_id,league_member_id')
    say(`  Inserted/updated ${rows.length} point rows`)
  }

  // 7. Mark match as processed
  await dbPatch(env, `matches?id=eq.${match.id}`, { points_processed: true })
  say('  Marked as processed ✓')
}

// ─── Supabase REST helpers ───────────────────────────────────────────────────

function headers(env) {
  return {
    'apikey':        env.SUPABASE_SERVICE_ROLE_KEY,
    'Authorization': `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
    'Content-Type':  'application/json',
  }
}

async function dbGet(env, path) {
  const res = await fetch(`${env.SUPABASE_URL}/rest/v1/${path}`, {
    headers: headers(env),
  })
  if (!res.ok) throw new Error(`DB GET ${path} failed: ${await res.text()}`)
  return res.json()
}

async function dbPost(env, table, rows, onConflict) {
  const res = await fetch(`${env.SUPABASE_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: {
      ...headers(env),
      'Prefer': `resolution=merge-duplicates`,
    },
    body: JSON.stringify(rows),
  })
  if (!res.ok) throw new Error(`DB POST ${table} failed: ${await res.text()}`)
}

async function dbPatch(env, path, body) {
  const res = await fetch(`${env.SUPABASE_URL}/rest/v1/${path}`, {
    method: 'PATCH',
    headers: {
      ...headers(env),
      'Prefer': 'return=minimal',
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`DB PATCH ${path} failed: ${await res.text()}`)
}
