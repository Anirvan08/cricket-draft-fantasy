import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { joinLeagueByCode } from '@/services/league.service'

export async function POST(request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { inviteCode } = await request.json()

  if (!inviteCode?.trim()) {
    return NextResponse.json({ error: 'Invite code is required' }, { status: 400 })
  }

  const { data, error } = await joinLeagueByCode(supabase, user.id, inviteCode)

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ data })
}
