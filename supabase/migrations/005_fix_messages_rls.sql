-- Fix messages SELECT policy to use security-definer helper (avoids potential session sync issues)
drop policy if exists "Group members can view messages" on public.messages;
create policy "Group members can view messages"
  on public.messages for select to authenticated
  using (group_id in (select public.get_my_group_ids()));

-- Also bump limit — allow realtime replication for members
alter publication supabase_realtime add table public.messages;
