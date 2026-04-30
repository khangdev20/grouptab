-- Allow group members to update settlement messages (e.g. confirm payment)
-- This is needed so the payee can update the message metadata when confirming
create policy "Group members can update settlement messages"
  on public.messages for update to authenticated
  using (
    group_id in (
      select group_id from public.group_members where user_id = auth.uid()
    )
  )
  with check (
    group_id in (
      select group_id from public.group_members where user_id = auth.uid()
    )
  );
