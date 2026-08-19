-- Add comments to the supabase_realtime publication so a comment on an open
-- card propagates to other clients viewing the same card.
alter publication supabase_realtime add table public.comments;
