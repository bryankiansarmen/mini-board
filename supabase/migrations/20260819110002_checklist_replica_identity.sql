-- checklist_items uses the same card-scoped realtime channel filter
-- (card_id=eq.<id>) as comments, so it needs full replica identity too:
-- DELETE/UPDATE events must carry card_id or the filter silently drops them
-- and other clients never see an item disappear. Latent bug found while
-- adding the comments realtime test (same root cause, same one-line fix).
alter table checklist_items replica identity full;
