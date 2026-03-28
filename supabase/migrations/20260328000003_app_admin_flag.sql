-- Add app-level admin flag to users.
-- Only app admins can create leagues. Everyone else can only join.

alter table users add column if not exists is_app_admin boolean not null default false;
