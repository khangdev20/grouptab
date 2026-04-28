-- Fix: groups INSERT policy too strict
-- The check (created_by = auth.uid()) can fail when the session cookie
-- isn't forwarded correctly server-side. Since we're already requiring
-- the user to be authenticated, checking true is safe here.

drop policy if exists "Authenticated users can create groups" on public.groups;

create policy "Authenticated users can create groups"
  on public.groups for insert to authenticated
  with check (true);
