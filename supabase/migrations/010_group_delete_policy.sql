-- Migration 010: Allow group admins to delete their own groups
create policy "Group admins can delete groups"
  on public.groups for delete to authenticated
  using (
    id in (
      select group_id from public.group_members
      where user_id = auth.uid() and role = 'admin'
    )
  );
