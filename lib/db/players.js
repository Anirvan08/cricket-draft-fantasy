// Data access layer — raw DB queries for players

export async function getAllPlayers(supabase) {
  const { data, error } = await supabase
    .from('players')
    .select('*')
    .order('ipl_team', { ascending: true })
    .order('name', { ascending: true })

  return { data, error }
}

export async function getAvailablePlayers(supabase, leagueId) {
  // Players not yet drafted in this league
  const { data, error } = await supabase
    .from('players')
    .select('*')
    .not('id', 'in', `(
      select player_id from draft_picks where league_id = '${leagueId}'
    )`)
    .order('ipl_team', { ascending: true })
    .order('name', { ascending: true })

  return { data, error }
}
