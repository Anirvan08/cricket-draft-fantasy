// Data access layer — raw DB queries for matches

export async function getMatchesByLeague(supabase, leagueId) {
  const { data, error } = await supabase
    .from('matches')
    .select('*')
    .eq('league_id', leagueId)
    .order('match_date', { ascending: false })

  return { data, error }
}

export async function createMatch(supabase, { leagueId, teamA, teamB, matchDate, apiMatchId }) {
  const { data, error } = await supabase
    .from('matches')
    .insert({
      league_id:    leagueId,
      team_a:       teamA,
      team_b:       teamB,
      match_date:   matchDate,
      api_match_id: apiMatchId ?? null,
    })
    .select()
    .single()

  return { data, error }
}
