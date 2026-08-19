-- Add the realtime tables to the `supabase_realtime` publication so Postgres
-- Changes events (INSERT/UPDATE/DELETE) are broadcast to board-scoped
-- channels. Supabase's default publication is empty; without membership
-- here, no changes flow to subscribed clients even though Realtime is enabled.
-- Cards live under columns (column_id -> columns.board_id), so the board-scoped
-- channel subscribes to columns by board_id and to cards by column_id=in.(...).
alter publication supabase_realtime add table public.cards;
alter publication supabase_realtime add table public.columns;
