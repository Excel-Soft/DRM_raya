-- drm.user_team_members was never created on this database (no DDL exists in
-- ensure.ts or any migration), so GET /api/users/:id/team-members (and the
-- POST/DELETE add/remove member endpoints used by the User List "Team" dialog
-- and Account GM Entries) failed with
-- "relation drm.user_team_members does not exist".
-- Shape taken from the columns UsersController.getTeamMembers/addTeamMember/
-- removeTeamMember use (manager_id, member_id, added_at,
-- ON CONFLICT (manager_id, member_id)). Additive only.
-- Rollback: create-user-team-members.rollback.sql
CREATE TABLE IF NOT EXISTS drm.user_team_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  manager_id uuid NOT NULL REFERENCES drm.users(id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES drm.users(id) ON DELETE CASCADE,
  added_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT user_team_members_manager_member_uq UNIQUE (manager_id, member_id)
);
CREATE INDEX IF NOT EXISTS idx_user_team_members_member ON drm.user_team_members (member_id);
