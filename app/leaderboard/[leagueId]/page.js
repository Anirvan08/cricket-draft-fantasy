import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase-server'
import { getLeagueById } from '@/lib/db/leagues'
import { getMembersByLeague } from '@/lib/db/league_members'
import { getMatchesByLeague } from '@/lib/db/matches'
import { getPointsByLeague } from '@/lib/db/player_match_points'
import NavBar from '@/components/nav/NavBar'
import Leaderboard from '@/components/leaderboard/Leaderboard'

export default async function LeaderboardPage({ params }) {
  const { leagueId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const [{ data: league }, { data: members }, { data: matches }, { data: points }] = await Promise.all([
    getLeagueById(supabase, leagueId),
    getMembersByLeague(supabase, leagueId),
    getMatchesByLeague(supabase, leagueId),
    getPointsByLeague(supabase, leagueId),
  ])

  if (!league) redirect('/lobby')

  const currentMember = members?.find(m => m.user_id === user.id)
  if (!currentMember) redirect('/lobby')

  return (
    <>
      <NavBar leagueId={leagueId} isAdmin={currentMember.is_admin} />
      <Leaderboard
        league={league}
        members={members ?? []}
        matches={matches ?? []}
        points={points ?? []}
        currentUserId={user.id}
      />
    </>
  )
}
