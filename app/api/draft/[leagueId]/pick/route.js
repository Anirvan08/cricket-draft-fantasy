import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { getMembersByLeague } from '@/lib/db/league_members'
import { getPicksByLeague } from '@/lib/db/draft_picks'
import { submitPick } from '@/services/draft.service'

export async function POST(request, { params }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { playerId } = await request.json()
  if (!playerId) return NextResponse.json({ error: 'playerId is required' }, { status: 400 })

  const { leagueId } = await params

  // Fetch current league state, members, and picks in parallel
  const [leagueRes, membersRes, picksRes] = await Promise.all([
    supabase.from('leagues').select('*').eq('id', leagueId).single(),
    getMembersByLeague(supabase, leagueId),
    getPicksByLeague(supabase, leagueId),
  ])

  if (leagueRes.error) return NextResponse.json({ error: 'League not found' }, { status: 404 })

  const { error } = await submitPick(supabase, {
    leagueId,
    playerId,
    requestingUserId: user.id,
    league:  leagueRes.data,
    members: membersRes.data ?? [],
    picks:   picksRes.data ?? [],
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ success: true })
}
