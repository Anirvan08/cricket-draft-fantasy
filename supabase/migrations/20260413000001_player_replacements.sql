-- Player availability + replacement support
-- Admin can mark a player unavailable (injured, dropped) and swap them
-- in a squad with an undrafted player. Past points stay credited.

alter table players
  add column if not exists is_available boolean not null default true;

alter table draft_picks
  add column if not exists replaced_from_player_id uuid references players(id),
  add column if not exists replaced_at timestamptz,
  add column if not exists replacement_reason text;

-- Atomic swap RPC — admin only, can run during in_season
create or replace function replace_draft_pick(
  p_pick_id uuid,
  p_new_player_id uuid,
  p_reason text
) returns void
language plpgsql
security definer
as $$
declare
  v_league_id uuid;
  v_old_player_id uuid;
  v_already_drafted boolean;
begin
  -- Look up the pick
  select league_id, player_id
    into v_league_id, v_old_player_id
    from draft_picks
    where id = p_pick_id;

  if v_league_id is null then
    raise exception 'Pick not found';
  end if;

  if v_old_player_id = p_new_player_id then
    raise exception 'New player must be different from current player';
  end if;

  -- Ensure new player isn't already drafted in this league
  select exists(
    select 1 from draft_picks
    where league_id = v_league_id and player_id = p_new_player_id
  ) into v_already_drafted;

  if v_already_drafted then
    raise exception 'New player is already drafted in this league';
  end if;

  -- Mark old player unavailable
  update players set is_available = false where id = v_old_player_id;

  -- Swap on the draft_pick row
  update draft_picks
    set player_id = p_new_player_id,
        replaced_from_player_id = v_old_player_id,
        replaced_at = now(),
        replacement_reason = p_reason
    where id = p_pick_id;
end;
$$;

grant execute on function replace_draft_pick(uuid, uuid, text) to authenticated;
