-- Add 'image' to messages type check constraint
alter table public.messages drop constraint if exists messages_type_check;
alter table public.messages add constraint messages_type_check
  check (type in ('text', 'expense', 'settlement', 'receipt_pending', 'image'));
