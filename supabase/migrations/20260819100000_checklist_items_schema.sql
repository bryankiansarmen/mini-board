-- checklist_items table + RLS policies, index, and grants, mirroring
-- cards_schema.sql. Backs the card detail modal's checklist.

-- Checklist items
create table checklist_items (
  id uuid primary key default gen_random_uuid(),
  card_id uuid references cards(id) on delete cascade,
  content text not null,
  is_complete boolean not null default false,
  position float not null,
  created_at timestamptz default now()
);

create index idx_checklist_items_card on checklist_items(card_id, position);

-- Grant Data API access (new entities are NOT auto-exposed when
-- api.auto_expose_new_tables is unset; see the workspaces migration).
grant select, insert, update, delete on checklist_items to anon, authenticated, service_role;

-- RLS
alter table checklist_items enable row level security;

-- Any workspace member can view checklist items on accessible cards (scoped
-- via cards -> columns -> boards.workspace_id).
create policy "select checklist items on accessible cards" on checklist_items for select
  using (exists (
    select 1 from cards
    join columns on columns.id = cards.column_id
    join boards on boards.id = columns.board_id
    where cards.id = checklist_items.card_id
    and is_workspace_member(boards.workspace_id, auth.uid())
  ));

-- Any workspace member can create checklist items.
create policy "members can write checklist items" on checklist_items for insert
  with check (exists (
    select 1 from cards
    join columns on columns.id = cards.column_id
    join boards on boards.id = columns.board_id
    where cards.id = checklist_items.card_id
    and is_workspace_member(boards.workspace_id, auth.uid())
  ));

-- Any workspace member can update checklist items.
create policy "members can update checklist items" on checklist_items for update
  using (exists (
    select 1 from cards
    join columns on columns.id = cards.column_id
    join boards on boards.id = columns.board_id
    where cards.id = checklist_items.card_id
    and is_workspace_member(boards.workspace_id, auth.uid())
  ));

-- Any workspace member can delete checklist items.
create policy "members can delete checklist items" on checklist_items for delete
  using (exists (
    select 1 from cards
    join columns on columns.id = cards.column_id
    join boards on boards.id = columns.board_id
    where cards.id = checklist_items.card_id
    and is_workspace_member(boards.workspace_id, auth.uid())
  ));
