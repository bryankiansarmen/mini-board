-- workspaces + workspace_members schema, auth helpers, and RLS.
-- Only the tables this task needs

-- Workspaces
create table workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_id uuid references auth.users not null,
  created_at timestamptz default now()
);

-- Workspace membership
create table workspace_members (
  workspace_id uuid references workspaces(id) on delete cascade,
  user_id uuid references auth.users,
  role text check (role in ('admin','member')) default 'member',
  joined_at timestamptz default now(),
  primary key (workspace_id, user_id)
);

create index idx_workspace_members_user on workspace_members(user_id);

-- Grant Data API access. New entities in `public` are NOT auto-exposed to the
-- API roles when `api.auto_expose_new_tables` is unset (new default), so tables
-- must be granted explicitly or PostgREST returns 403 for every operation.
grant select, insert, update, delete on workspaces to anon, authenticated, service_role;
grant select, insert, update, delete on workspace_members to anon, authenticated, service_role;

-- Authorization helper functions (security definer so policies on other tables
-- can read workspace_members without recursive RLS evaluation).
create or replace function is_workspace_member(ws_id uuid, uid uuid)
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from workspace_members
    where workspace_id = ws_id and user_id = uid
  );
$$;

create or replace function is_workspace_admin(ws_id uuid, uid uuid)
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from workspace_members
    where workspace_id = ws_id and user_id = uid and role = 'admin'
  ) or exists (
    select 1 from workspaces
    where id = ws_id and owner_id = uid
  );
$$;

-- RLS
alter table workspaces enable row level security;
alter table workspace_members enable row level security;

-- workspaces
-- Owners must be able to select a workspace they just created (INSERT ...
-- RETURNING is filtered by the SELECT policy), so the policy also allows the
-- owner even before their workspace_members row exists.
create policy "select own workspaces" on workspaces for select
  using (is_workspace_member(id, auth.uid()) or owner_id = auth.uid());
create policy "insert own workspace" on workspaces for insert
  with check (owner_id = auth.uid());
create policy "owner can update workspace" on workspaces for update
  using (owner_id = auth.uid());
create policy "owner can delete workspace" on workspaces for delete
  using (owner_id = auth.uid());

-- workspace_members
create policy "select members of own workspaces" on workspace_members for select
  using (is_workspace_member(workspace_id, auth.uid()));
create policy "admin can insert member" on workspace_members for insert
  with check (is_workspace_admin(workspace_id, auth.uid()));
create policy "admin can update member role" on workspace_members for update
  using (is_workspace_admin(workspace_id, auth.uid()));
create policy "admin can remove member" on workspace_members for delete
  using (is_workspace_admin(workspace_id, auth.uid()));