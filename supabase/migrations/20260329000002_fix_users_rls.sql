-- Fix: league members couldn't read each other's display names because
-- the users RLS policy only allowed reading your own row.
-- For a closed friend group app, any authenticated user can read all profiles.

drop policy if exists "users can read own profile" on users;

create policy "authenticated users can read profiles"
  on users for select using (
    auth.uid() is not null
  );

-- Backfill any auth users who don't have a public.users row yet
-- (created before the trigger was in place)
insert into public.users (id, display_name, email)
select
  a.id,
  coalesce(a.raw_user_meta_data->>'display_name', split_part(a.email, '@', 1)),
  a.email
from auth.users a
where not exists (select 1 from public.users u where u.id = a.id);
