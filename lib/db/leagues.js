// Data access layer — raw DB queries for leagues

export async function getLeaguesByUser(supabase, userId) {
  const { data, error } = await supabase
    .from('league_members')
    .select(`
      *,
      league:leagues(*)
    `)
    .eq('user_id', userId)

  return { data, error }
}

export async function getLeagueById(supabase, leagueId) {
  const { data, error } = await supabase
    .from('leagues')
    .select('*')
    .eq('id', leagueId)
    .single()

  return { data, error }
}

export async function getLeagueByInviteCode(supabase, inviteCode) {
  const { data, error } = await supabase
    .from('leagues')
    .select('*')
    .eq('invite_code', inviteCode)
    .single()

  return { data, error }
}

export async function createLeague(supabase, { name, players_per_team, max_participants, invite_code }) {
  const { data, error } = await supabase
    .from('leagues')
    .insert({ name, players_per_team, max_participants, invite_code })
    .select()
    .single()

  return { data, error }
}

export async function updateLeagueStatus(supabase, leagueId, { draft_status, season_status } = {}) {
  const updates = {}
  if (draft_status) updates.draft_status = draft_status
  if (season_status) updates.season_status = season_status

  const { data, error } = await supabase
    .from('leagues')
    .update(updates)
    .eq('id', leagueId)
    .select()
    .single()

  return { data, error }
}
