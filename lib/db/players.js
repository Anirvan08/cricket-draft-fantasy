// Data access layer — raw DB queries for players

export async function getAllPlayers(supabase) {
  const { data, error } = await supabase
    .from('players')
    .select('*')
    .order('ipl_team', { ascending: true })
    .order('name', { ascending: true })

  return { data, error }
}

// Fetch picked IDs first, then filter in JS — avoids raw SQL string interpolation
export async function getAvailablePlayers(supabase, leagueId) {
  const [playersRes, picksRes] = await Promise.all([
    supabase.from('players').select('*').order('ipl_team').order('name'),
    supabase.from('draft_picks').select('player_id').eq('league_id', leagueId),
  ])

  if (playersRes.error) return { data: null, error: playersRes.error }

  const pickedIds = new Set((picksRes.data ?? []).map(p => p.player_id))
  const data = playersRes.data.filter(p => !pickedIds.has(p.id))

  return { data, error: null }
}
