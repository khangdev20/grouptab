-- ============================================================
-- Migration 004: Fix all schema/RLS mismatches
-- Run this in Supabase SQL Editor (it is idempotent)
-- ============================================================

-- ── 1. Auto-create profile when a user signs up ─────────────
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, name)
  values (new.id, coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1), 'User'))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ── 2. Fix groups INSERT RLS ────────────────────────────────
drop policy if exists "Authenticated users can create groups" on public.groups;
create policy "Authenticated users can create groups"
  on public.groups for insert to authenticated
  with check (true);

-- ── 3. Fix messages: rename user_id → sender_id ─────────────
do $$ begin
  if exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='messages' and column_name='user_id'
  ) then
    alter table public.messages rename column user_id to sender_id;
  end if;
end $$;

-- Fix messages RLS policies that referenced user_id
drop policy if exists "Group members can send messages" on public.messages;
create policy "Group members can send messages"
  on public.messages for insert to authenticated
  with check (
    group_id in (select public.get_my_group_ids())
    and sender_id = auth.uid()
  );

-- ── 4. Fix receipts: add ocr_data, fix status constraint ─────
alter table public.receipts add column if not exists ocr_data jsonb;

alter table public.receipts drop constraint if exists receipts_status_check;
alter table public.receipts add constraint receipts_status_check
  check (status in ('pending', 'confirmed'));

-- ── 5. Fix settlements: rename columns, add status ───────────
do $$ begin
  if exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='settlements' and column_name='from_user_id'
  ) then
    alter table public.settlements rename column from_user_id to from_user;
  end if;
end $$;

do $$ begin
  if exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='settlements' and column_name='to_user_id'
  ) then
    alter table public.settlements rename column to_user_id to to_user;
  end if;
end $$;

alter table public.settlements add column if not exists status text default 'completed';

-- Fix settlements RLS (referenced old column names)
drop policy if exists "Group members can create settlements" on public.settlements;
create policy "Group members can create settlements"
  on public.settlements for insert to authenticated
  with check (
    group_id in (select public.get_my_group_ids())
    and from_user = auth.uid()
  );

-- ── 6. Fix expenses: rename title → description, add split_type
do $$ begin
  if exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='expenses' and column_name='title'
  ) then
    alter table public.expenses rename column title to description;
  end if;
end $$;

alter table public.expenses add column if not exists split_type text default 'custom';

-- Fix expenses INSERT RLS (paid_by = auth.uid() is fine)
drop policy if exists "Group members can create expenses" on public.expenses;
create policy "Group members can create expenses"
  on public.expenses for insert to authenticated
  with check (group_id in (select public.get_my_group_ids()));

-- ── 7. Ensure get_my_group_ids() function exists ────────────
create or replace function public.get_my_group_ids()
returns setof uuid language sql security definer stable set search_path = public as $$
  select group_id from public.group_members where user_id = auth.uid()
$$;

-- ── 8. Fix group_members RLS recursion (idempotent) ─────────
drop policy if exists "Group members can view members" on public.group_members;
create policy "Group members can view members"
  on public.group_members for select to authenticated
  using (group_id in (select public.get_my_group_ids()));

drop policy if exists "Admins can manage members" on public.group_members;
create policy "Admins can manage members"
  on public.group_members for delete to authenticated
  using (
    group_id in (
      select gm.group_id from public.group_members gm
      where gm.user_id = auth.uid() and gm.role = 'admin'
    ) or user_id = auth.uid()
  );

-- ── 9. Fix groups SELECT RLS to use helper function ──────────
drop policy if exists "Group members can view groups" on public.groups;
create policy "Group members can view groups"
  on public.groups for select to authenticated
  using (id in (select public.get_my_group_ids()));

-- ── Done ─────────────────────────────────────────────────────
