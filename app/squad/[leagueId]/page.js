import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase-server'
import { getLeagueById } from '@/lib/db/leagues'
import { getMembersByLeague } from '@/lib/db/league_members'
import { getPicksByLeague } from '@/lib/db/draft_picks'
import { getPointsByMember } from '@/lib/db/player_match_points'
import NavBar from '@/components/nav/NavBar'
import MySquad from '@/components/squad/MySquad'

export default async function SquadPage({ params }) {
  const { leagueId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const [{ data: league }, { data: members }, { data: picks }] = await Promise.all([
    getLeagueById(supabase, leagueId),
    getMembersByLeague(supabase, leagueId),
    getPicksByLeague(supabase, leagueId),
  ])

  if (!league) redirect('/lobby')

  const currentMember = members?.find(m => m.user_id === user.id)
  if (!currentMember) redirect('/lobby')

  const myPicks = (picks ?? []).filter(p => p.league_member_id === currentMember.id)

  // Fetch points for this member's players
  const { data: memberPoints } = await getPointsByMember(supabase, currentMember.id)

  // Aggregate total points per player
  const playerPoints = {}
  ;(memberPoints ?? []).forEach(p => {
    playerPoints[p.player_id] = (playerPoints[p.player_id] ?? 0) + p.fantasy_points
  })

  const totalPoints = Object.values(playerPoints).reduce((sum, v) => sum + v, 0)

  // Released players: those who earned points for this member but aren't in current squad
  const currentPlayerIds = new Set(myPicks.map(p => p.player_id))
  const releasedPlayerMap = {}
  ;(memberPoints ?? []).forEach(p => {
    if (!currentPlayerIds.has(p.player_id) && p.player) {
      if (!releasedPlayerMap[p.player_id]) {
        releasedPlayerMap[p.player_id] = { player: p.player, total: 0 }
      }
      releasedPlayerMap[p.player_id].total += p.fantasy_points
    }
  })
  const releasedPlayers = Object.values(releasedPlayerMap).sort((a, b) => b.total - a.total)

  return (
    <>
      <NavBar leagueId={leagueId} isAdmin={currentMember.is_admin} />
      <MySquad
        league={league}
        member={currentMember}
        picks={myPicks}
        playerPoints={playerPoints}
        totalPoints={totalPoints}
        releasedPlayers={releasedPlayers}
      />
    </>
  )
}
