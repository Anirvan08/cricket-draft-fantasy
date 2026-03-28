// Data access layer — raw DB queries for users, no business logic here

export async function insertUser(supabase, { id, display_name, email }) {
  const { data, error } = await supabase
    .from('users')
    .insert({ id, display_name, email })
    .select()
    .single()

  return { data, error }
}

export async function getUserById(supabase, id) {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', id)
    .single()

  return { data, error }
}

export async function isAppAdmin(supabase, id) {
  const { data } = await supabase
    .from('users')
    .select('is_app_admin')
    .eq('id', id)
    .single()

  return data?.is_app_admin === true
}
