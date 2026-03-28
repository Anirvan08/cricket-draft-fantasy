// Draft service — snake order logic, pick validation, turn management

import { makePick, advanceTurn } from '@/lib/db/draft_picks'
import { getMember, getMembersByLeague } from '@/lib/db/league_members'
import { getActivePickerOrder, getRoundNumber } from '@/lib/draft-utils'

export { getActivePickerOrder, getRoundNumber }

/**
 * Make a draft pick.
 * Validates turn ownership, team size, and delegates atomics to the DB function.
 */
export async function submitPick(supabase, { leagueId, playerId, requestingUserId, league, members, picks }) {
  if (league.draft_status !== 'active') {
    return { error: { message: 'Draft is not active.' } }
  }

  const totalPicks = members.length * league.players_per_team
  if (league.current_pick_number > totalPicks) {
    return { error: { message: 'Draft is already complete.' } }
  }

  const activePickerOrder = getActivePickerOrder(league.current_pick_number, members.length)
  const activeMember = members.find(m => m.draft_order === activePickerOrder)

  if (!activeMember) {
    return { error: { message: 'Could not determine active picker.' } }
  }

  // Check if request is from the active picker or an admin
  const requestor = members.find(m => m.user_id === requestingUserId)
  const isAdmin = requestor?.is_admin ?? false
  const isActivePicker = activeMember.user_id === requestingUserId

  if (!isActivePicker && !isAdmin) {
    return { error: { message: "It's not your turn." } }
  }

  // Check team size — the picker's team must not be full
  const targetMemberId = isAdmin && !isActivePicker
    ? activeMember.id   // admin bulk-picking on behalf of active picker
    : activeMember.id

  const pickerPicks = picks.filter(p => p.league_member_id === targetMemberId)
  if (pickerPicks.length >= league.players_per_team) {
    return { error: { message: 'This team already has a full squad.' } }
  }

  const roundNumber = getRoundNumber(league.current_pick_number, members.length)

  const { error } = await makePick(supabase, {
    leagueId,
    playerId,
    leagueMemberId:  targetMemberId,
    pickNumber:      league.current_pick_number,
    roundNumber,
    pickedBy:        isAdmin && !isActivePicker ? 'admin' : 'participant',
  })

  return { error }
}

/**
 * Admin skips the current turn (timer expired or manual advance).
 * Marks the skipped member for backfill.
 */
export async function skipCurrentTurn(supabase, { leagueId, requestingUserId, league, members }) {
  if (league.draft_status !== 'active') {
    return { error: { message: 'Draft is not active.' } }
  }

  const requestor = members.find(m => m.user_id === requestingUserId)
  if (!requestor?.is_admin) {
    return { error: { message: 'Only the admin can skip a turn.' } }
  }

  const activePickerOrder = getActivePickerOrder(league.current_pick_number, members.length)
  const activeMember = members.find(m => m.draft_order === activePickerOrder)

  if (!activeMember) return { error: { message: 'Could not determine active picker.' } }

  return advanceTurn(supabase, { leagueId, leagueMemberId: activeMember.id })
}
