// League service — business logic for creating, joining, and managing leagues

import { createLeague, getLeagueByInviteCode, updateLeagueStatus } from '@/lib/db/leagues'
import { addMember, getMember, getMembersByLeague, updateDraftOrders } from '@/lib/db/league_members'

function generateInviteCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase()
}

export async function createNewLeague(supabase, userId, { name, maxParticipants, playersPerTeam = 11 }) {
  const invite_code = generateInviteCode()

  const { data: league, error: leagueError } = await createLeague(supabase, {
    name: name.trim(),
    players_per_team: playersPerTeam,
    max_participants: maxParticipants,
    invite_code,
  })

  if (leagueError) return { error: leagueError }

  // Creator is automatically the admin
  const { error: memberError } = await addMember(supabase, {
    league_id: league.id,
    user_id: userId,
    is_admin: true,
  })

  if (memberError) return { error: memberError }

  return { data: league }
}

export async function joinLeagueByCode(supabase, userId, inviteCode) {
  const { data: league, error: findError } = await getLeagueByInviteCode(supabase, inviteCode.trim().toUpperCase())

  if (findError || !league) return { error: { message: 'Invalid invite code. Check with your league admin.' } }

  if (league.draft_status !== 'locked') {
    return { error: { message: 'This league has already started its draft.' } }
  }

  const { data: members, error: membersError } = await getMembersByLeague(supabase, league.id)
  if (membersError) return { error: membersError }

  if (members.length >= league.max_participants) {
    return { error: { message: 'This league is full.' } }
  }

  const { data: existing } = await getMember(supabase, league.id, userId)
  if (existing) return { error: { message: 'You are already in this league.' } }

  const { error: joinError } = await addMember(supabase, {
    league_id: league.id,
    user_id: userId,
    is_admin: false,
  })

  if (joinError) return { error: joinError }

  return { data: league }
}

export async function shuffleDraftOrder(supabase, leagueId, requestingUserId) {
  const { data: requestor } = await getMember(supabase, leagueId, requestingUserId)
  if (!requestor?.is_admin) return { error: { message: 'Only the admin can shuffle draft order.' } }

  const { data: members, error } = await getMembersByLeague(supabase, leagueId)
  if (error) return { error }

  const shuffled = [...members].sort(() => Math.random() - 0.5)
  const updates = shuffled.map((m, i) => ({ id: m.id, draft_order: i + 1 }))

  return updateDraftOrders(supabase, updates)
}

export async function setDraftStatus(supabase, leagueId, status, requestingUserId) {
  const { data: requestor } = await getMember(supabase, leagueId, requestingUserId)
  if (!requestor?.is_admin) return { error: { message: 'Only the admin can change draft status.' } }

  return updateLeagueStatus(supabase, leagueId, { draft_status: status })
}
