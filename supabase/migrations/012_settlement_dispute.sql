-- Allow 'rejected' and 'cancelled' settlement statuses for dispute/cancel flow.
-- Debtor can cancel their own pending; creditor can reject a pending payment.

-- Add check constraint for valid status values (idempotent via drop-recreate)
alter table public.settlements
  drop constraint if exists settlements_status_check;

alter table public.settlements
  add constraint settlements_status_check
  check (status in ('pending', 'completed', 'rejected', 'cancelled'));
