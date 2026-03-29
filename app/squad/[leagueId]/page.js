import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase-server'
import { getLeagueById } from '@/lib/db/leagues'
import { getMembersByLeague } from '@/lib/db/league_members'
import { getPicksByLeague } from '@/lib/db/draft_picks'
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

  return (
    <MySquad
      league={league}
      member={currentMember}
      picks={myPicks}
    />
  )
}
