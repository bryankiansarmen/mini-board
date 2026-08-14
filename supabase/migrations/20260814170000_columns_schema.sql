-- columns table + RLS policies, index, and grants.
-- Only the table this task needs, mirroring boards_schema.sql.

-- Columns
create table columns (
  id uuid primary key default gen_random_uuid(),
  board_id uuid references boards(id) on delete cascade,
  title text not null,
  position float not null,
  created_at timestamptz default now()
);

create index idx_columns_board on columns(board_id, position);

-- Grant Data API access (new entities are NOT auto-exposed when
-- api.auto_expose_new_tables is unset — see workspaces migration).
grant select, insert, update, delete on columns to anon, authenticated, service_role;

-- RLS
alter table columns enable row level security;

-- Any workspace member can view columns on accessible boards.
create policy "select columns on accessible boards" on columns for select
  using (exists (
    select 1 from boards
    where boards.id = columns.board_id
    and is_workspace_member(boards.workspace_id, auth.uid())
  ));

-- Any workspace member can create columns.
create policy "members can write columns" on columns for insert
  with check (exists (
    select 1 from boards
    where boards.id = columns.board_id
    and is_workspace_member(boards.workspace_id, auth.uid())
  ));

-- Any workspace member can update columns.
create policy "members can update columns" on columns for update
  using (exists (
    select 1 from boards
    where boards.id = columns.board_id
    and is_workspace_member(boards.workspace_id, auth.uid())
  ));

-- Any workspace member can delete columns.
create policy "members can delete columns" on columns for delete
  using (exists (
    select 1 from boards
    where boards.id = columns.board_id
    and is_workspace_member(boards.workspace_id, auth.uid())
  ));
