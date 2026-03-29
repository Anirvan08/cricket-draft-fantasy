import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { getMembersByLeague, getMember } from '@/lib/db/league_members'

export async function GET(request, { params }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const { data, error } = await getMembersByLeague(supabase, id)

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ data })
}

export async function DELETE(request, { params }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const { memberId } = await request.json()

  // Only admin can remove members
  const { data: requestor } = await getMember(supabase, id, user.id)
  if (!requestor?.is_admin) return NextResponse.json({ error: 'Admin access required' }, { status: 403 })

  // Cannot remove yourself (the admin)
  if (requestor.id === memberId) return NextResponse.json({ error: 'Cannot remove yourself' }, { status: 400 })

  const { error } = await supabase
    .from('league_members')
    .delete()
    .eq('id', memberId)
    .eq('league_id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}
