-- Atomic function: insert draft pick + increment current_pick_number in one transaction.
-- Also marks draft complete when all picks are done.
-- Called from the API via supabase.rpc('make_draft_pick', {...})

create or replace function make_draft_pick(
  p_league_id        uuid,
  p_player_id        uuid,
  p_league_member_id uuid,
  p_pick_number      int,
  p_round_number     int,
  p_picked_by        text
)
returns void
language plpgsql
security definer
as $$
declare
  v_total_picks int;
  v_next_pick   int;
begin
  -- Prevent duplicate picks for this player in this league
  if exists (
    select 1 from draft_picks
    where league_id = p_league_id and player_id = p_player_id
  ) then
    raise exception 'Player already drafted in this league';
  end if;

  -- Insert the pick
  insert into draft_picks (league_id, league_member_id, player_id, round_number, pick_number, picked_by)
  values (p_league_id, p_league_member_id, p_player_id, p_round_number, p_pick_number, p_picked_by);

  -- Calculate total picks for this league
  select max_participants * players_per_team into v_total_picks
  from leagues where id = p_league_id;

  v_next_pick := p_pick_number + 1;

  -- Advance pick counter; mark complete if all picks are done
  update leagues
  set
    current_pick_number = v_next_pick,
    draft_status = case when v_next_pick > v_total_picks then 'completed' else draft_status end
  where id = p_league_id;
end;
$$;

-- Advance turn without making a pick (admin skip / timer expiry)
create or replace function advance_draft_turn(
  p_league_id        uuid,
  p_league_member_id uuid  -- member whose turn is being skipped
)
returns void
language plpgsql
security definer
as $$
begin
  -- Mark skipped member as needing backfill
  update league_members
  set has_pending_backfill = true
  where id = p_league_member_id;

  -- Advance pick counter
  update leagues
  set current_pick_number = current_pick_number + 1
  where id = p_league_id;
end;
$$;
