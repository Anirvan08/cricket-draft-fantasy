-- IPL Fantasy Draft App — Full Schema
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor → New Query)

-- =====================
-- TABLES
-- =====================

create table leagues (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  invite_code text unique not null,
  players_per_team int not null default 11,
  max_participants int not null default 8,
  draft_status text not null default 'locked' check (draft_status in ('locked', 'active', 'backfill', 'completed')),
  current_pick_number int not null default 1,
  season_status text not null default 'draft_phase' check (season_status in ('draft_phase', 'in_season', 'completed')),
  created_at timestamptz default now()
);

create table users (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  email text not null
);

create table league_members (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references leagues(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  draft_order int,
  team_name text,
  is_admin boolean not null default false,
  has_pending_backfill boolean not null default false,
  unique(league_id, user_id)
);

create table players (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  ipl_team text not null,
  role text not null check (role in ('BAT', 'BOWL', 'AR', 'WK')),
  api_player_id text unique
);

create table draft_picks (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references leagues(id) on delete cascade,
  league_member_id uuid not null references league_members(id) on delete cascade,
  player_id uuid not null references players(id) on delete cascade,
  round_number int not null,
  pick_number int not null,
  picked_by text not null default 'participant' check (picked_by in ('participant', 'admin')),
  created_at timestamptz default now(),
  unique(league_id, player_id),
  unique(league_id, pick_number)
);

create table matches (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references leagues(id) on delete cascade,
  team_a text not null,
  team_b text not null,
  match_date date not null,
  api_match_id text,
  points_processed boolean not null default false
);

create table player_match_points (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references matches(id) on delete cascade,
  player_id uuid not null references players(id) on delete cascade,
  league_member_id uuid not null references league_members(id) on delete cascade,
  runs int not null default 0,
  balls_faced int not null default 0,
  fours int not null default 0,
  sixes int not null default 0,
  wickets int not null default 0,
  lbw_bowled_count int not null default 0,
  maiden_overs int not null default 0,
  overs_bowled float not null default 0,
  runs_conceded int not null default 0,
  catches int not null default 0,
  stumpings int not null default 0,
  runouts_direct int not null default 0,
  runouts_indirect int not null default 0,
  did_play boolean not null default false,
  fantasy_points float not null default 0,
  unique(match_id, player_id, league_member_id)
);

-- =====================
-- INDEXES
-- =====================

create index on league_members(league_id);
create index on league_members(user_id);
create index on draft_picks(league_id);
create index on draft_picks(league_member_id);
create index on player_match_points(match_id);
create index on player_match_points(league_member_id);
create index on matches(league_id, match_date);

-- =====================
-- REALTIME
-- =====================

-- Enable realtime on draft_picks and leagues tables
-- (Do this in Supabase Dashboard → Database → Replication, or via:)
alter publication supabase_realtime add table draft_picks;
alter publication supabase_realtime add table leagues;

-- =====================
-- ROW LEVEL SECURITY
-- =====================

alter table leagues enable row level security;
alter table users enable row level security;
alter table league_members enable row level security;
alter table players enable row level security;
alter table draft_picks enable row level security;
alter table matches enable row level security;
alter table player_match_points enable row level security;

-- users: can read/write own row
create policy "users can read own profile"
  on users for select using (auth.uid() = id);

create policy "users can insert own profile"
  on users for insert with check (auth.uid() = id);

create policy "users can update own profile"
  on users for update using (auth.uid() = id);

-- leagues: members can read their leagues
create policy "league members can read league"
  on leagues for select using (
    exists (
      select 1 from league_members
      where league_members.league_id = leagues.id
      and league_members.user_id = auth.uid()
    )
  );

-- leagues: anyone can read a league by invite_code (for joining)
create policy "anyone can read league by invite code"
  on leagues for select using (true);

-- leagues: admin can update their league
create policy "admin can update league"
  on leagues for update using (
    exists (
      select 1 from league_members
      where league_members.league_id = leagues.id
      and league_members.user_id = auth.uid()
      and league_members.is_admin = true
    )
  );

-- leagues: authenticated users can create a league
create policy "authenticated users can create league"
  on leagues for insert with check (auth.uid() is not null);

-- league_members: members can read their own league's members
create policy "members can read league members"
  on league_members for select using (
    user_id = auth.uid() or
    exists (
      select 1 from league_members lm2
      where lm2.league_id = league_members.league_id
      and lm2.user_id = auth.uid()
    )
  );

-- league_members: user can join a league (insert own row)
create policy "user can join league"
  on league_members for insert with check (auth.uid() = user_id);

-- league_members: admin can update any member in their league
create policy "admin can update league members"
  on league_members for update using (
    exists (
      select 1 from league_members lm
      where lm.league_id = league_members.league_id
      and lm.user_id = auth.uid()
      and lm.is_admin = true
    )
  );

-- players: everyone can read
create policy "anyone can read players"
  on players for select using (true);

-- draft_picks: league members can read picks in their league
create policy "league members can read draft picks"
  on draft_picks for select using (
    exists (
      select 1 from league_members
      where league_members.league_id = draft_picks.league_id
      and league_members.user_id = auth.uid()
    )
  );

-- draft_picks: league members can insert picks (enforced further in app logic)
create policy "league members can insert draft picks"
  on draft_picks for insert with check (
    exists (
      select 1 from league_members
      where league_members.league_id = draft_picks.league_id
      and league_members.user_id = auth.uid()
    )
  );

-- draft_picks: admin can delete picks (for edit/swap)
create policy "admin can delete draft picks"
  on draft_picks for delete using (
    exists (
      select 1 from league_members
      where league_members.league_id = draft_picks.league_id
      and league_members.user_id = auth.uid()
      and league_members.is_admin = true
    )
  );

-- matches: league members can read
create policy "league members can read matches"
  on matches for select using (
    exists (
      select 1 from league_members
      where league_members.league_id = matches.league_id
      and league_members.user_id = auth.uid()
    )
  );

-- player_match_points: league members can read
create policy "league members can read points"
  on player_match_points for select using (
    exists (
      select 1 from league_members lm
      join matches m on m.league_id = lm.league_id
      where m.id = player_match_points.match_id
      and lm.user_id = auth.uid()
    )
  );
