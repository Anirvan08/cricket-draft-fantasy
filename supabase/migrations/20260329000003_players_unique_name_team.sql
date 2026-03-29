-- Ensure re-running the seed script doesn't create duplicate players.
-- api_player_id is null for locally-seeded players, so we need name+team as the unique key.

alter table players
  add constraint players_name_team_unique unique (name, ipl_team);
