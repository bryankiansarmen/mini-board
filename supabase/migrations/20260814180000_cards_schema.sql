-- cards table + RLS policies, index, and grants.
-- Only the table this task needs, mirroring columns_schema.sql.
-- description / due_date / assignee_id / labels exist on the table but are
-- only surfaced in the UI from the card detail modal.

-- Cards
create table cards (
  id uuid primary key default gen_random_uuid(),
  column_id uuid references columns(id) on delete cascade,
  title text not null,
  description text,
  position float not null,
  due_date date,
  assignee_id uuid references auth.users,
  labels text[] default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index idx_cards_column on cards(column_id, position);

-- Grant Data API access (new entities are NOT auto-exposed when
-- api.auto_expose_new_tables is unset; see the workspaces migration).
grant select, insert, update, delete on cards to anon, authenticated, service_role;

-- RLS
alter table cards enable row level security;

-- Any workspace member can view cards on accessible boards (scoped via
-- columns -> boards.workspace_id).
create policy "select cards on accessible boards" on cards for select
  using (exists (
    select 1 from columns join boards on boards.id = columns.board_id
    where columns.id = cards.column_id
    and is_workspace_member(boards.workspace_id, auth.uid())
  ));

-- Any workspace member can create cards.
create policy "members can write cards" on cards for insert
  with check (exists (
    select 1 from columns join boards on boards.id = columns.board_id
    where columns.id = cards.column_id
    and is_workspace_member(boards.workspace_id, auth.uid())
  ));

-- Any workspace member can update cards.
create policy "members can update cards" on cards for update
  using (exists (
    select 1 from columns join boards on boards.id = columns.board_id
    where columns.id = cards.column_id
    and is_workspace_member(boards.workspace_id, auth.uid())
  ));

-- Any workspace member can delete cards.
create policy "members can delete cards" on cards for delete
  using (exists (
    select 1 from columns join boards on boards.id = columns.board_id
    where columns.id = cards.column_id
    and is_workspace_member(boards.workspace_id, auth.uid())
  ));
