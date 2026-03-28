import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase-server'
import { getMembersByLeague } from '@/lib/db/league_members'
import { getPicksByLeague } from '@/lib/db/draft_picks'
import { getAllPlayers } from '@/lib/db/players'
import DraftRoom from '@/components/draft/DraftRoom'

export default async function DraftPage({ params }) {
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

  // Only allow access while draft is active or backfill
  if (league.draft_status === 'locked') redirect('/lobby')
  if (league.draft_status === 'completed') redirect(`/squad/${leagueId}`)

  return (
    <DraftRoom
      league={league}
      members={membersRes.data ?? []}
      initialPicks={picksRes.data ?? []}
      allPlayers={playersRes.data ?? []}
      currentUserId={user.id}
    />
  )
}
