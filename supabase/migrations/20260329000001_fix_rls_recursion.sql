-- Fix infinite recursion in league_members RLS policies.
--
-- Root cause: policies on league_members subqueried league_members again,
-- causing Postgres to recurse infinitely.
--
-- Fix: security definer helper functions query league_members WITHOUT RLS,
-- then policies call those functions instead.

-- =====================
-- HELPER FUNCTIONS
-- =====================

create or replace function is_league_member(p_league_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from league_members
    where league_id = p_league_id
      and user_id = auth.uid()
  )
$$;

create or replace function is_league_admin(p_league_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from league_members
    where league_id = p_league_id
      and user_id = auth.uid()
      and is_admin = true
  )
$$;

-- =====================
-- REWRITE league_members POLICIES
-- =====================

drop policy if exists "members can read league members"    on league_members;
drop policy if exists "admin can update league members"    on league_members;
drop policy if exists "user can join league"               on league_members;

-- Members can read all rows in leagues they belong to
create policy "members can read league members"
  on league_members for select using (
    user_id = auth.uid() or is_league_member(league_id)
  );

-- Members can insert their own row (joining a league)
create policy "user can join league"
  on league_members for insert with check (
    auth.uid() = user_id
  );

-- Only league admins can update member rows (draft order, backfill flag, etc.)
create policy "admin can update league members"
  on league_members for update using (
    is_league_admin(league_id)
  );

-- =====================
-- REWRITE leagues POLICIES (also referenced league_members inline)
-- =====================

drop policy if exists "league members can read league"    on leagues;
drop policy if exists "admin can update league"           on leagues;
drop policy if exists "anyone can read league by invite code" on leagues;

-- Anyone authenticated can read a league by invite code (needed for join flow)
create policy "authenticated users can read leagues"
  on leagues for select using (
    auth.uid() is not null
  );

-- Only league admins can update their league
create policy "admin can update league"
  on leagues for update using (
    is_league_admin(id)
  );

-- =====================
-- REWRITE other tables that referenced league_members inline
-- =====================

drop policy if exists "league members can read draft picks" on draft_picks;
drop policy if exists "league members can insert draft picks" on draft_picks;
drop policy if exists "admin can delete draft picks" on draft_picks;

create policy "league members can read draft picks"
  on draft_picks for select using (
    is_league_member(league_id)
  );

create policy "league members can insert draft picks"
  on draft_picks for insert with check (
    is_league_member(league_id)
  );

create policy "admin can delete draft picks"
  on draft_picks for delete using (
    is_league_admin(league_id)
  );

drop policy if exists "league members can read matches" on matches;

create policy "league members can read matches"
  on matches for select using (
    is_league_member(league_id)
  );

drop policy if exists "league members can read points" on player_match_points;

create policy "league members can read points"
  on player_match_points for select using (
    exists (
      select 1 from matches m
      where m.id = player_match_points.match_id
        and is_league_member(m.league_id)
    )
  );
