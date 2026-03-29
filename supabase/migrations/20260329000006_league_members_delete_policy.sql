-- Allow league admin to remove members (no DELETE policy existed before).
-- Uses the existing is_league_admin() security definer function to avoid recursion.

create policy "admin can remove league members"
  on league_members for delete using (
    is_league_admin(league_id)
  );
