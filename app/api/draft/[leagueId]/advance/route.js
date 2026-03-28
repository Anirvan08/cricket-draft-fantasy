import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { getMembersByLeague } from '@/lib/db/league_members'
import { skipCurrentTurn } from '@/services/draft.service'

export async function POST(request, { params }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { leagueId } = await params

  const [leagueRes, membersRes] = await Promise.all([
    supabase.from('leagues').select('*').eq('id', leagueId).single(),
    getMembersByLeague(supabase, leagueId),
  ])

  if (leagueRes.error) return NextResponse.json({ error: 'League not found' }, { status: 404 })

  const { error } = await skipCurrentTurn(supabase, {
    leagueId,
    requestingUserId: user.id,
    league:  leagueRes.data,
    members: membersRes.data ?? [],
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ success: true })
}
