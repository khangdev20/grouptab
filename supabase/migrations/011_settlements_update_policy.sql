-- Fix missing UPDATE policy for settlements
create policy "Group members can update settlements"
  on public.settlements for update to authenticated
  using (
    group_id in (select public.get_my_group_ids())
    and (to_user = auth.uid() or from_user = auth.uid())
  );
