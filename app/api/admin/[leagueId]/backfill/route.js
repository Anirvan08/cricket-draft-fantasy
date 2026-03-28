import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { clearBackfill } from '@/services/admin.service'

// DELETE — mark a member's backfill as complete
export async function DELETE(request, { params }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { leagueId } = await params
  const { memberId } = await request.json()

  if (!memberId) return NextResponse.json({ error: 'memberId is required' }, { status: 400 })

  const { error } = await clearBackfill(supabase, {
    leagueId,
    memberId,
    requestingUserId: user.id,
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ success: true })
}
