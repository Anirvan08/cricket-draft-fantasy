// Data access layer — raw DB queries for player match points

// Returns all points rows for a league, joined with match + player info
export async function getPointsByLeague(supabase, leagueId) {
  const { data, error } = await supabase
    .from('player_match_points')
    .select(`
      *,
      player:players(id, name, ipl_team, role),
      match:matches(id, team_a, team_b, match_date)
    `)
    .eq('match.league_id', leagueId)

  return { data, error }
}

// Returns all points rows for a single member (for squad breakdown)
export async function getPointsByMember(supabase, leagueMemberId) {
  const { data, error } = await supabase
    .from('player_match_points')
    .select(`
      *,
      player:players(id, name, ipl_team, role),
      match:matches(id, team_a, team_b, match_date)
    `)
    .eq('league_member_id', leagueMemberId)
    .order('match.match_date', { ascending: false })

  return { data, error }
}
