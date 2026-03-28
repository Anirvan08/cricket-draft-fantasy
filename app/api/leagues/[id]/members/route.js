import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { getMembersByLeague } from '@/lib/db/league_members'

export async function GET(request, { params }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const { data, error } = await getMembersByLeague(supabase, id)

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ data })
}
