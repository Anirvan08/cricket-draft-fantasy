-- Ensure re-running the Worker doesn't create duplicate match rows.
alter table matches
  add constraint matches_league_api_match_unique unique (league_id, api_match_id);
