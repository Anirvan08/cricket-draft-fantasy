import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { createNewLeague } from '@/services/league.service'
import { isAppAdmin } from '@/lib/db/users'

export async function POST(request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = await isAppAdmin(supabase, user.id)
  if (!admin) return NextResponse.json({ error: 'Only the app admin can create leagues.' }, { status: 403 })

  const { name, maxParticipants, playersPerTeam } = await request.json()

  if (!name?.trim()) {
    return NextResponse.json({ error: 'League name is required' }, { status: 400 })
  }
  if (!maxParticipants || maxParticipants < 2 || maxParticipants > 16) {
    return NextResponse.json({ error: 'Participants must be between 2 and 16' }, { status: 400 })
  }
  if (!playersPerTeam || playersPerTeam < 1 || playersPerTeam > 25) {
    return NextResponse.json({ error: 'Players per team must be between 1 and 25' }, { status: 400 })
  }

  const { data, error } = await createNewLeague(supabase, user.id, { name, maxParticipants, playersPerTeam })

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ data }, { status: 201 })
}
