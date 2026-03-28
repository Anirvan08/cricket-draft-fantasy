import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { adminAddPick, adminRemovePick } from '@/services/admin.service'

// POST — admin adds a pick on behalf of any member
export async function POST(request, { params }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { leagueId } = await params
  const { playerId, targetMemberId } = await request.json()

  if (!playerId || !targetMemberId) {
    return NextResponse.json({ error: 'playerId and targetMemberId are required' }, { status: 400 })
  }

  const { error } = await adminAddPick(supabase, {
    leagueId,
    playerId,
    targetMemberId,
    requestingUserId: user.id,
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ success: true }, { status: 201 })
}

// DELETE — admin removes a pick, player returns to pool
export async function DELETE(request, { params }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { leagueId } = await params
  const { pickId } = await request.json()

  if (!pickId) return NextResponse.json({ error: 'pickId is required' }, { status: 400 })

  const { error } = await adminRemovePick(supabase, {
    leagueId,
    pickId,
    requestingUserId: user.id,
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ success: true })
}
