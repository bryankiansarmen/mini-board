-- Activity log (append-only audit trail for key board actions)
create table activity_log (
  id uuid primary key default gen_random_uuid(),
  board_id uuid references boards(id) on delete cascade,
  actor_id uuid references auth.users,
  action text not null,
  metadata jsonb default '{}',
  created_at timestamptz default now()
);

create index idx_activity_log_board on activity_log(board_id, created_at desc);

-- Grants: authenticated users can read and insert (RLS-scoped).
grant select, insert on public.activity_log to authenticated;
grant select, insert on public.activity_log to service_role;

alter table activity_log enable row level security;

-- SELECT: workspace members can read activity for boards they belong to.
create policy "select activity on accessible boards" on activity_log for select
  using (exists (
    select 1 from boards
    where boards.id = activity_log.board_id
    and is_workspace_member(boards.workspace_id, auth.uid())
  ));

-- INSERT: workspace members can insert activity for boards they belong to;
-- actor_id must match the authenticated user.
create policy "members can insert activity" on activity_log for insert
  with check (
    actor_id = auth.uid() and exists (
      select 1 from boards
      where boards.id = activity_log.board_id
      and is_workspace_member(boards.workspace_id, auth.uid())
    )
  );

-- No update/delete policy defined for activity_log: immutable by design (PRD business rules).

-- Full replica identity so Realtime DELETE events carry the board_id for
-- channel filtering (same lesson as comments/checklist).
alter table activity_log replica identity full;
