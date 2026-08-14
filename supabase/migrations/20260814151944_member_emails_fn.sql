-- Member emails for the member-management
--
-- auth.users is not readable by the `authenticated` role, so this joins it in
-- a security-definer function. This keeps the member list page free of
-- service-role imports. The is_workspace_member(ws_id, auth.uid()) guard means a caller only ever sees
-- members of a workspace they themselves belong to.

create or replace function get_workspace_member_emails(ws_id uuid)
returns table (
  user_id uuid,
  email text,
  role text,
  joined_at timestamptz
)
language sql
security definer
stable
as $$
  select wm.user_id, u.email, wm.role, wm.joined_at
  from workspace_members wm
  join auth.users u on u.id = wm.user_id
  where wm.workspace_id = ws_id
    and is_workspace_member(ws_id, auth.uid())
  order by wm.joined_at asc;
$$;

-- Expose to the API roles so it can be called via supabase.rpc().
grant execute on function get_workspace_member_emails(uuid) to anon, authenticated, service_role;