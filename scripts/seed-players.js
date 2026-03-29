/**
 * Seed IPL player pool into Supabase.
 *
 * Usage:
 *   node scripts/seed-players.js           — seed from local 2026 JSON (default)
 *   node scripts/seed-players.js --api     — seed from CricketData.org API (when 2026 is available)
 *
 * Safe to re-run — upserts on name+ipl_team, so existing rows are updated not duplicated.
 */

require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')
const path = require('path')

const SUPABASE_URL      = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_ROLE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY
const CRICKET_API_KEY   = process.env.CRICKET_DATA_API_KEY

// Update this when IPL 2026 series appears in the API
const IPL_SERIES_ID = '87c62aac-bc3c-4738-ab93-19da0690488f' // IPL 2026

const ROLE_MAP = {
  'Batsman':            'BAT',
  'Batting Allrounder': 'AR',
  'Bowling Allrounder': 'AR',
  'Bowler':             'BOWL',
  'WK-Batsman':         'WK',
}

async function fetchFromApi() {
  console.log('Fetching squads from CricketData.org...')
  const url = `https://api.cricapi.com/v1/series_squad?apikey=${CRICKET_API_KEY}&id=${IPL_SERIES_ID}`
  const res = await fetch(url)
  const json = await res.json()

  if (json.status !== 'success') throw new Error(`API error: ${JSON.stringify(json)}`)

  const players = []
  for (const team of json.data) {
    for (const player of team.players) {
      const role = ROLE_MAP[player.role]
      if (!role) { console.warn(`  Unknown role "${player.role}" for ${player.name} — skipping`); continue }
      players.push({ name: player.name, ipl_team: team.shortname, role, api_player_id: player.id })
    }
  }
  return players
}

function fetchFromLocal() {
  console.log('Loading players from scripts/data/players-2026.json...')
  return require(path.join(__dirname, 'data', 'players-2026.json'))
}

async function seed() {
  const useApi = process.argv.includes('--api')
  const players = useApi ? await fetchFromApi() : fetchFromLocal()

  console.log(`${players.length} players loaded from ${useApi ? 'API' : 'local file'}`)

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

  const BATCH = 50
  let done = 0

  for (let i = 0; i < players.length; i += BATCH) {
    const batch = players.slice(i, i + BATCH)
    const { error } = await supabase
      .from('players')
      .upsert(batch, { onConflict: 'name,ipl_team', ignoreDuplicates: false })

    if (error) { console.error('Batch error:', error.message); process.exit(1) }
    done += batch.length
    console.log(`  ${done}/${players.length}`)
  }

  console.log(`\nDone. ${players.length} players seeded.`)

  const byTeam = players.reduce((acc, p) => { acc[p.ipl_team] = (acc[p.ipl_team] || 0) + 1; return acc }, {})
  console.log('\nPlayers per team:')
  Object.entries(byTeam).sort().forEach(([t, n]) => console.log(`  ${t}: ${n}`))
}

seed().catch(err => { console.error(err); process.exit(1) })
