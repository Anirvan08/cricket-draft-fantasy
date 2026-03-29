-- Fix make_draft_pick to use actual member count instead of max_participants.
-- max_participants is a ceiling for joining; once the draft starts the real
-- participant count is what determines total picks and snake order length.

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
  v_players_per_team int;
  v_member_count     int;
  v_total_picks      int;
  v_next_pick        int;
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

  -- Use actual member count, not max_participants
  select players_per_team into v_players_per_team
  from leagues where id = p_league_id;

  select count(*) into v_member_count
  from league_members where league_id = p_league_id;

  v_total_picks := v_players_per_team * v_member_count;
  v_next_pick   := p_pick_number + 1;

  -- Advance pick counter; mark complete if all picks are done
  update leagues
  set
    current_pick_number = v_next_pick,
    draft_status = case when v_next_pick > v_total_picks then 'completed' else draft_status end
  where id = p_league_id;
end;
$$;
