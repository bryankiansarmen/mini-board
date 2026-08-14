-- workspace_invite_codes table, RLS, and grants.
-- Writes go through the Route Handler with the service-role key (collision-
-- checked code generation + atomic accept), so no client INSERT/DELETE policy.

-- Invite codes (MVP invite mechanism — see DECISIONS.md)
create table workspace_invite_codes (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references workspaces(id) on delete cascade,
  code text not null unique,
  created_by uuid references auth.users not null,
  expires_at timestamptz not null default (now() + interval '7 days'),
  created_at timestamptz default now()
);

create unique index idx_invite_codes_code on workspace_invite_codes(code);

-- Grant Data API access. New entities in `public` are NOT auto-exposed to the
-- API roles when `api.auto_expose_new_tables` is unset (new default), so tables
-- must be granted explicitly or PostgREST returns 403 for every operation.
grant select, insert, update, delete on workspace_invite_codes to anon, authenticated, service_role;

alter table workspace_invite_codes enable row level security;

-- Members of a workspace can view its invite codes.
create policy "members can view codes" on workspace_invite_codes for select
  using (is_workspace_member(workspace_id, auth.uid()));
-- No insert/update/delete policy: RLS denies by default; all writes go through
-- the Route Handler using the service-role key.