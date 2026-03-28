import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { shuffleDraftOrder } from '@/services/league.service'

export async function POST(request, { params }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { error } = await shuffleDraftOrder(supabase, params.id, user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ success: true })
}
