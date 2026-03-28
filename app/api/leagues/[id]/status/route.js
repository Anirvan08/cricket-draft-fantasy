import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { setDraftStatus } from '@/services/league.service'

const VALID_STATUSES = ['locked', 'active', 'backfill', 'completed']

export async function PATCH(request, { params }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { status } = await request.json()

  if (!VALID_STATUSES.includes(status)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
  }

  const { id } = await params
  const { data, error } = await setDraftStatus(supabase, id, status, user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ data })
}
