-- Supabase Realtime needs REPLICA IDENTITY FULL to include all columns
-- in UPDATE/DELETE events (required for row-level filters to work correctly).

alter table leagues        replica identity full;
alter table draft_picks    replica identity full;
alter table league_members replica identity full;
