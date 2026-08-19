-- comments table + RLS policies, index, and grants, mirroring
-- checklist_items_schema.sql. Backs the card detail modal's comment thread.

-- Comments
create table comments (
  id uuid primary key default gen_random_uuid(),
  card_id uuid references cards(id) on delete cascade,
  author_id uuid references auth.users,
  body text not null,
  created_at timestamptz default now()
);

create index idx_comments_card on comments(card_id, created_at);

-- Grant Data API access (new entities are NOT auto-exposed when
-- api.auto_expose_new_tables is unset; see the workspaces migration).
grant select, insert, delete on comments to anon, authenticated, service_role;

-- RLS
alter table comments enable row level security;

-- Any workspace member can view comments on accessible cards (scoped via
-- cards -> columns -> boards.workspace_id).
create policy "select comments on accessible cards" on comments for select
  using (exists (
    select 1 from cards
    join columns on columns.id = cards.column_id
    join boards on boards.id = columns.board_id
    where cards.id = comments.card_id
    and is_workspace_member(boards.workspace_id, auth.uid())
  ));

-- A member can only write a comment whose author_id is their own uid.
create policy "members can insert own comments" on comments for insert
  with check (
    author_id = auth.uid() and exists (
      select 1 from cards
      join columns on columns.id = cards.column_id
      join boards on boards.id = columns.board_id
      where cards.id = comments.card_id
      and is_workspace_member(boards.workspace_id, auth.uid())
    )
  );

-- Only the author can delete their own comment. No update policy exists:
-- comments are immutable by design (PRD FR-9 grants add/delete only).
create policy "author can delete own comment" on comments for delete
  using (author_id = auth.uid());

-- Full replica identity: without it, Realtime DELETE/UPDATE events carry only
-- the primary key, so the channel's card_id=eq.<id> filter can never match a
-- deleted row and other clients never see a comment disappear.
alter table comments replica identity full;
