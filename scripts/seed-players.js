/**
 * Seed IPL player pool from CricketData.org API.
 *
 * Usage:
 *   node scripts/seed-players.js
 *
 * Uses IPL 2025 squads (latest available). Re-run each season with the new series ID.
 * Safe to re-run — skips players already in the DB (upsert on api_player_id).
 */

require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const CRICKET_API_KEY = process.env.CRICKET_DATA_API_KEY

// IPL 2025 series ID from CricketData.org
// Update this each season: https://api.cricapi.com/v1/series?apikey=KEY&search=IPL
const IPL_SERIES_ID = 'd5a498c8-7596-4b93-8ab0-e0efc3345312'

const ROLE_MAP = {
  'Batsman': 'BAT',
  'Batting Allrounder': 'AR',
  'Bowling Allrounder': 'AR',
  'Bowler': 'BOWL',
  'WK-Batsman': 'WK',
}

async function fetchSquads() {
  const url = `https://api.cricapi.com/v1/series_squad?apikey=${CRICKET_API_KEY}&id=${IPL_SERIES_ID}`
  const res = await fetch(url)
  const json = await res.json()

  if (json.status !== 'success') {
    throw new Error(`API error: ${JSON.stringify(json)}`)
  }

  return json.data // array of { teamName, shortname, players[] }
}

async function seed() {
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

  console.log('Fetching squads from CricketData.org...')
  const teams = await fetchSquads()
  console.log(`Got ${teams.length} teams`)

  const players = []

  for (const team of teams) {
    for (const player of team.players) {
      const role = ROLE_MAP[player.role]
      if (!role) {
        console.warn(`  Unknown role "${player.role}" for ${player.name} — skipping`)
        continue
      }

      players.push({
        name: player.name,
        ipl_team: team.shortname,
        role,
        api_player_id: player.id,
      })
    }
  }

  console.log(`Upserting ${players.length} players...`)

  // Upsert in batches of 50 to stay well under API limits
  const BATCH = 50
  let inserted = 0

  for (let i = 0; i < players.length; i += BATCH) {
    const batch = players.slice(i, i + BATCH)
    const { error } = await supabase
      .from('players')
      .upsert(batch, { onConflict: 'api_player_id' })

    if (error) {
      console.error(`Error on batch ${i / BATCH + 1}:`, error.message)
      process.exit(1)
    }

    inserted += batch.length
    console.log(`  ${inserted}/${players.length} done`)
  }

  console.log(`\nDone. ${players.length} players seeded.`)

  // Print summary by team
  const byTeam = {}
  for (const p of players) {
    byTeam[p.ipl_team] = (byTeam[p.ipl_team] || 0) + 1
  }
  console.log('\nPlayers per team:')
  Object.entries(byTeam).sort().forEach(([team, count]) => {
    console.log(`  ${team}: ${count}`)
  })
}

seed().catch(err => {
  console.error(err)
  process.exit(1)
})
