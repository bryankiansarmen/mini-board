-- boards table + RLS policies, index, and grants.
-- Only the table this task needs.

-- Boards
create table boards (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references workspaces(id) on delete cascade,
  title text not null,
  position float not null default 0,
  created_at timestamptz default now()
);

create index idx_boards_workspace on boards(workspace_id, position);

-- Grant Data API access (new entities are NOT auto-exposed when
-- api.auto_expose_new_tables is unset — see workspaces migration).
grant select, insert, update, delete on boards to anon, authenticated, service_role;

-- RLS
alter table boards enable row level security;

-- Any workspace member can view boards.
create policy "select boards in own workspaces" on boards for select
  using (is_workspace_member(workspace_id, auth.uid()));

-- Any workspace member can create boards.
create policy "members can create boards" on boards for insert
  with check (is_workspace_member(workspace_id, auth.uid()));

-- Any workspace member can rename boards.
create policy "members can update boards" on boards for update
  using (is_workspace_member(workspace_id, auth.uid()));

-- Only Owner/Admin can delete boards.
create policy "admin can delete boards" on boards for delete
  using (is_workspace_admin(workspace_id, auth.uid()));
