-- Add checklist_items to the supabase_realtime publication so checklist
-- changes on an open card propagate to other clients viewing the same card.
alter publication supabase_realtime add table public.checklist_items;
