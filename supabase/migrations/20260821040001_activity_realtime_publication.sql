-- Enable Realtime for activity_log (RLS-filtered server-side).
alter publication supabase_realtime add table public.activity_log;
