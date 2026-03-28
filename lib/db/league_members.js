// Data access layer — raw DB queries for league members

export async function getMembersByLeague(supabase, leagueId) {
  const { data, error } = await supabase
    .from('league_members')
    .select(`
      *,
      user:users(id, display_name, email)
    `)
    .eq('league_id', leagueId)
    .order('draft_order', { ascending: true, nullsFirst: false })

  return { data, error }
}

export async function getMember(supabase, leagueId, userId) {
  const { data, error } = await supabase
    .from('league_members')
    .select('*')
    .eq('league_id', leagueId)
    .eq('user_id', userId)
    .single()

  return { data, error }
}

export async function addMember(supabase, { league_id, user_id, is_admin = false }) {
  const { data, error } = await supabase
    .from('league_members')
    .insert({ league_id, user_id, is_admin })
    .select()
    .single()

  return { data, error }
}

export async function updateDraftOrders(supabase, updates) {
  // updates = [{ id: memberId, draft_order: n }, ...]
  const results = await Promise.all(
    updates.map(({ id, draft_order }) =>
      supabase.from('league_members').update({ draft_order }).eq('id', id)
    )
  )
  const failed = results.find(r => r.error)
  return { error: failed?.error ?? null }
}
