import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase-server'
import { getMembersByLeague } from '@/lib/db/league_members'
import { getPicksByLeague } from '@/lib/db/draft_picks'
import { getAllPlayers } from '@/lib/db/players'
import AdminPanel from '@/components/admin/AdminPanel'

export default async function AdminPage({ params }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { leagueId } = await params

  const [leagueRes, membersRes, picksRes, playersRes] = await Promise.all([
    supabase.from('leagues').select('*').eq('id', leagueId).single(),
    getMembersByLeague(supabase, leagueId),
    getPicksByLeague(supabase, leagueId),
    getAllPlayers(supabase),
  ])

  if (!leagueRes.data) redirect('/lobby')

  const league = leagueRes.data
  const members = membersRes.data ?? []

  // Only admins can access this page
  const currentMember = members.find(m => m.user_id === user.id)
  if (!currentMember?.is_admin) redirect('/lobby')

  return (
    <AdminPanel
      league={league}
      members={members}
      initialPicks={picksRes.data ?? []}
      allPlayers={playersRes.data ?? []}
      currentUserId={user.id}
    />
  )
}
