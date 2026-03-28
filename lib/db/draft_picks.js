// Data access layer — raw DB queries for draft picks

export async function getPicksByLeague(supabase, leagueId) {
  const { data, error } = await supabase
    .from('draft_picks')
    .select(`
      *,
      player:players(*),
      league_member:league_members(id, draft_order, team_name, user:users(id, display_name))
    `)
    .eq('league_id', leagueId)
    .order('pick_number', { ascending: true })

  return { data, error }
}

export async function makePick(supabase, { leagueId, playerId, leagueMemberId, pickNumber, roundNumber, pickedBy }) {
  const { error } = await supabase.rpc('make_draft_pick', {
    p_league_id:        leagueId,
    p_player_id:        playerId,
    p_league_member_id: leagueMemberId,
    p_pick_number:      pickNumber,
    p_round_number:     roundNumber,
    p_picked_by:        pickedBy,
  })

  return { error }
}

export async function removePick(supabase, pickId) {
  const { error } = await supabase
    .from('draft_picks')
    .delete()
    .eq('id', pickId)

  return { error }
}

export async function advanceTurn(supabase, { leagueId, leagueMemberId }) {
  const { error } = await supabase.rpc('advance_draft_turn', {
    p_league_id:        leagueId,
    p_league_member_id: leagueMemberId,
  })

  return { error }
}
