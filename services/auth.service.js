// Auth service — business logic for signup/login flows

export async function signUp(supabase, { email, password, displayName }) {
  // display_name is passed in metadata so the DB trigger can pick it up
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { display_name: displayName.trim() } },
  })

  if (error) return { error }
  return { data }
}

export async function signIn(supabase, { email, password }) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  return { data, error }
}

export async function signOut(supabase) {
  const { error } = await supabase.auth.signOut()
  return { error }
}
