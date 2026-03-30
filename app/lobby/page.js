import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase-server'
import { getLeaguesByUser } from '@/lib/db/leagues'
import { getMembersByLeague } from '@/lib/db/league_members'
import { isAppAdmin } from '@/lib/db/users'
import NoLeague from '@/components/lobby/NoLeague'
import LeagueLobby from '@/components/lobby/LeagueLobby'

export default async function LobbyPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [{ data: memberships }, appAdmin] = await Promise.all([
    getLeaguesByUser(supabase, user.id),
    isAppAdmin(supabase, user.id),
  ])

  if (!memberships || memberships.length === 0) {
    return <NoLeague canCreate={appAdmin} />
  }

  const membership = memberships[memberships.length - 1]
  const league = membership.league

  // If draft is done, go straight to leaderboard
  if (league.draft_status === 'completed') {
    redirect(`/leaderboard/${league.id}`)
  }

  const { data: members } = await getMembersByLeague(supabase, league.id)

  return (
    <LeagueLobby
      league={league}
      members={members ?? []}
      currentUserId={user.id}
    />
  )
}
