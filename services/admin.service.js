// Admin service — bulk entry, edit picks, backfill management

import { makePick, removePick, replacePick, getPicksByLeague } from '@/lib/db/draft_picks'
import { getMember, getMembersByLeague, updateDraftOrders } from '@/lib/db/league_members'

/**
 * Admin adds a pick on behalf of any participant.
 * Bypasses snake order — admin chooses the target member explicitly.
 */
export async function adminAddPick(supabase, { leagueId, playerId, targetMemberId, requestingUserId }) {
  const requestor = await getMember(supabase, leagueId, requestingUserId)
  if (!requestor.data?.is_admin) return { error: { message: 'Admin access required.' } }

  const { data: picks } = await getPicksByLeague(supabase, leagueId)
  const { data: league } = await supabase.from('leagues').select('*').eq('id', leagueId).single()
  const { data: members } = await getMembersByLeague(supabase, leagueId)

  if (!league) return { error: { message: 'League not found.' } }
  if (league.season_status !== 'draft_phase') return { error: { message: 'Cannot edit picks after season has started.' } }

  // Check player not already drafted
  const alreadyPicked = picks?.some(p => p.player_id === playerId)
  if (alreadyPicked) return { error: { message: 'Player already drafted in this league.' } }

  // Check target member's team isn't full
  const memberPicks = picks?.filter(p => p.league_member_id === targetMemberId) ?? []
  if (memberPicks.length >= league.players_per_team) {
    return { error: { message: 'This team already has a full squad.' } }
  }

  // Pick number is appended at the end of existing picks (no snake enforcement)
  const pickNumber = (picks?.length ?? 0) + 1
  const roundNumber = Math.ceil(memberPicks.length + 1)

  const { error } = await makePick(supabase, {
    leagueId,
    playerId,
    leagueMemberId: targetMemberId,
    pickNumber,
    roundNumber,
    pickedBy: 'admin',
  })

  return { error }
}

/**
 * Admin removes a pick — player returns to available pool.
 */
export async function adminRemovePick(supabase, { leagueId, pickId, requestingUserId }) {
  const requestor = await getMember(supabase, leagueId, requestingUserId)
  if (!requestor.data?.is_admin) return { error: { message: 'Admin access required.' } }

  const { data: league } = await supabase.from('leagues').select('season_status').eq('id', leagueId).single()
  if (league?.season_status !== 'draft_phase') {
    return { error: { message: 'Cannot edit picks after season has started.' } }
  }

  return removePick(supabase, pickId)
}

/**
 * Admin replaces a player in a draft pick with an undrafted player.
 * Allowed during draft_phase OR in_season (unlike add/remove).
 * Old player is marked unavailable. Past points stay credited to the member.
 */
export async function adminReplacePick(supabase, { leagueId, pickId, newPlayerId, reason, requestingUserId }) {
  const requestor = await getMember(supabase, leagueId, requestingUserId)
  if (!requestor.data?.is_admin) return { error: { message: 'Admin access required.' } }

  if (!newPlayerId) return { error: { message: 'newPlayerId is required.' } }

  // Verify pick belongs to this league
  const { data: picks } = await getPicksByLeague(supabase, leagueId)
  const pick = picks?.find(p => p.id === pickId)
  if (!pick) return { error: { message: 'Pick not found in this league.' } }

  return replacePick(supabase, { pickId, newPlayerId, reason })
}

/**
 * Admin clears the backfill flag for a member once their picks are filled.
 */
export async function clearBackfill(supabase, { leagueId, memberId, requestingUserId }) {
  const requestor = await getMember(supabase, leagueId, requestingUserId)
  if (!requestor.data?.is_admin) return { error: { message: 'Admin access required.' } }

  const { error } = await supabase
    .from('league_members')
    .update({ has_pending_backfill: false })
    .eq('id', memberId)

  return { error }
}
