-- Fix: infinite recursion in group_members RLS policy

-- 1. Drop the recursive policy
drop policy if exists "Group members can view members" on public.group_members;

-- 2. Helper function with security definer (bypasses RLS, no recursion)
create or replace function public.get_my_group_ids()
returns setof uuid
language sql
security definer
stable
set search_path = public
as $$
  select group_id from public.group_members where user_id = auth.uid()
$$;

-- 3. Recreate policy using the function instead of a subquery on the same table
create policy "Group members can view members"
  on public.group_members for select to authenticated
  using (group_id in (select public.get_my_group_ids()));

-- 4. Also fix the delete policy which has the same issue
drop policy if exists "Admins can manage members" on public.group_members;

create policy "Admins can manage members"
  on public.group_members for delete to authenticated
  using (
    group_id in (
      select gm.group_id from public.group_members gm
      where gm.user_id = auth.uid() and gm.role = 'admin'
    ) or user_id = auth.uid()
  );
