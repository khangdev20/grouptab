-- Enable necessary extensions
create extension if not exists "uuid-ossp";

-- Profiles (extends auth.users)
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  name text not null,
  avatar_url text,
  created_at timestamptz default now() not null
);

-- Groups
create table public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  avatar_url text,
  theme_color text default '#6366f1',
  created_by uuid references public.profiles(id) on delete set null,
  invite_code text unique default substr(md5(random()::text), 1, 8),
  created_at timestamptz default now() not null
);

-- Group Members
create table public.group_members (
  id uuid primary key default gen_random_uuid(),
  group_id uuid references public.groups(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  role text default 'member' check (role in ('admin', 'member')),
  nickname text,
  joined_at timestamptz default now() not null,
  unique(group_id, user_id)
);

-- Messages
create table public.messages (
  id uuid primary key default gen_random_uuid(),
  group_id uuid references public.groups(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete set null,
  type text default 'text' check (type in ('text', 'expense', 'settlement', 'receipt_pending')),
  content text,
  metadata jsonb default '{}',
  created_at timestamptz default now() not null
);

-- Receipts
create table public.receipts (
  id uuid primary key default gen_random_uuid(),
  group_id uuid references public.groups(id) on delete cascade not null,
  uploaded_by uuid references public.profiles(id) on delete set null,
  image_url text,
  merchant_name text,
  receipt_date date,
  total_amount numeric(10,2),
  status text default 'review' check (status in ('review', 'confirmed')),
  created_at timestamptz default now() not null
);

-- Receipt Items
create table public.receipt_items (
  id uuid primary key default gen_random_uuid(),
  receipt_id uuid references public.receipts(id) on delete cascade not null,
  name text not null,
  price numeric(10,2) not null,
  quantity numeric(10,2) default 1,
  excluded boolean default false,
  position int default 0
);

-- Receipt Item Assignments
create table public.receipt_item_assignments (
  id uuid primary key default gen_random_uuid(),
  receipt_item_id uuid references public.receipt_items(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  unique(receipt_item_id, user_id)
);

-- Expenses
create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  group_id uuid references public.groups(id) on delete cascade not null,
  receipt_id uuid references public.receipts(id) on delete set null,
  message_id uuid references public.messages(id) on delete set null,
  title text not null,
  total_amount numeric(10,2) not null,
  paid_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz default now() not null
);

-- Expense Shares
create table public.expense_shares (
  id uuid primary key default gen_random_uuid(),
  expense_id uuid references public.expenses(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  amount numeric(10,2) not null,
  settled boolean default false
);

-- Settlements
create table public.settlements (
  id uuid primary key default gen_random_uuid(),
  group_id uuid references public.groups(id) on delete cascade not null,
  from_user_id uuid references public.profiles(id) on delete set null,
  to_user_id uuid references public.profiles(id) on delete set null,
  amount numeric(10,2) not null,
  message_id uuid references public.messages(id) on delete set null,
  created_at timestamptz default now() not null
);

-- ==================
-- Row Level Security
-- ==================

alter table public.profiles enable row level security;
alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.messages enable row level security;
alter table public.receipts enable row level security;
alter table public.receipt_items enable row level security;
alter table public.receipt_item_assignments enable row level security;
alter table public.expenses enable row level security;
alter table public.expense_shares enable row level security;
alter table public.settlements enable row level security;

-- Profiles policies
create policy "Public profiles are viewable by authenticated users"
  on public.profiles for select to authenticated using (true);
create policy "Users can update own profile"
  on public.profiles for update to authenticated using (auth.uid() = id);
create policy "Users can insert own profile"
  on public.profiles for insert to authenticated with check (auth.uid() = id);

-- Groups policies
create policy "Group members can view groups"
  on public.groups for select to authenticated
  using (id in (select group_id from public.group_members where user_id = auth.uid()));
create policy "Authenticated users can create groups"
  on public.groups for insert to authenticated with check (created_by = auth.uid());
create policy "Group admins can update groups"
  on public.groups for update to authenticated
  using (id in (select group_id from public.group_members where user_id = auth.uid() and role = 'admin'));

-- Group Members policies
create policy "Group members can view members"
  on public.group_members for select to authenticated
  using (group_id in (select group_id from public.group_members where user_id = auth.uid()));
create policy "Anyone authenticated can join via invite"
  on public.group_members for insert to authenticated with check (user_id = auth.uid());
create policy "Admins can manage members"
  on public.group_members for delete to authenticated
  using (group_id in (select group_id from public.group_members where user_id = auth.uid() and role = 'admin') or user_id = auth.uid());

-- Messages policies
create policy "Group members can view messages"
  on public.messages for select to authenticated
  using (group_id in (select group_id from public.group_members where user_id = auth.uid()));
create policy "Group members can send messages"
  on public.messages for insert to authenticated
  with check (group_id in (select group_id from public.group_members where user_id = auth.uid()) and user_id = auth.uid());

-- Receipts policies
create policy "Group members can view receipts"
  on public.receipts for select to authenticated
  using (group_id in (select group_id from public.group_members where user_id = auth.uid()));
create policy "Group members can upload receipts"
  on public.receipts for insert to authenticated
  with check (group_id in (select group_id from public.group_members where user_id = auth.uid()) and uploaded_by = auth.uid());
create policy "Uploader can update receipt"
  on public.receipts for update to authenticated
  using (uploaded_by = auth.uid());

-- Receipt Items policies
create policy "Group members can view receipt items"
  on public.receipt_items for select to authenticated
  using (receipt_id in (select id from public.receipts where group_id in (select group_id from public.group_members where user_id = auth.uid())));
create policy "Uploader can manage receipt items"
  on public.receipt_items for all to authenticated
  using (receipt_id in (select id from public.receipts where uploaded_by = auth.uid()));

-- Receipt Item Assignments policies
create policy "Group members can view assignments"
  on public.receipt_item_assignments for select to authenticated
  using (receipt_item_id in (select ri.id from public.receipt_items ri join public.receipts r on ri.receipt_id = r.id where r.group_id in (select group_id from public.group_members where user_id = auth.uid())));
create policy "Uploader can manage assignments"
  on public.receipt_item_assignments for all to authenticated
  using (receipt_item_id in (select ri.id from public.receipt_items ri join public.receipts r on ri.receipt_id = r.id where r.uploaded_by = auth.uid()));

-- Expenses policies
create policy "Group members can view expenses"
  on public.expenses for select to authenticated
  using (group_id in (select group_id from public.group_members where user_id = auth.uid()));
create policy "Group members can create expenses"
  on public.expenses for insert to authenticated
  with check (group_id in (select group_id from public.group_members where user_id = auth.uid()) and paid_by = auth.uid());

-- Expense Shares policies
create policy "Group members can view expense shares"
  on public.expense_shares for select to authenticated
  using (expense_id in (select id from public.expenses where group_id in (select group_id from public.group_members where user_id = auth.uid())));
create policy "System can manage expense shares"
  on public.expense_shares for all to authenticated
  using (expense_id in (select id from public.expenses where group_id in (select group_id from public.group_members where user_id = auth.uid())));

-- Settlements policies
create policy "Group members can view settlements"
  on public.settlements for select to authenticated
  using (group_id in (select group_id from public.group_members where user_id = auth.uid()));
create policy "Group members can create settlements"
  on public.settlements for insert to authenticated
  with check (group_id in (select group_id from public.group_members where user_id = auth.uid()) and from_user_id = auth.uid());

-- Realtime
alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.expenses;
alter publication supabase_realtime add table public.settlements;

-- Storage bucket for receipt images
insert into storage.buckets (id, name, public) values ('receipts', 'receipts', true);
create policy "Group members can upload receipt images"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'receipts');
create policy "Anyone can view receipt images"
  on storage.objects for select to authenticated
  using (bucket_id = 'receipts');

-- ============================================================
-- Recurring payments / reminders
-- ============================================================
create table if not exists public.recurring_payments (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  created_by uuid references public.profiles(id) on delete set null,
  title text not null,
  amount numeric(12,2) not null,
  frequency text not null,          -- 'daily' | 'weekly' | 'fortnightly' | 'monthly' | 'quarterly' | 'yearly'
  frequency_config jsonb default '{}', -- e.g. {"days_of_week":[1,5]} or {"day_of_month":15}
  next_due_date date,
  payer_id uuid references public.profiles(id) on delete set null,
  involved_members uuid[] default '{}',
  notes text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.recurring_payments enable row level security;

create policy "Members can view group recurring payments"
  on public.recurring_payments for select
  using (exists (
    select 1 from public.group_members
    where group_id = recurring_payments.group_id and user_id = auth.uid()
  ));

create policy "Members can create recurring payments"
  on public.recurring_payments for insert
  with check (exists (
    select 1 from public.group_members
    where group_id = recurring_payments.group_id and user_id = auth.uid()
  ));

create policy "Creator can update recurring payments"
  on public.recurring_payments for update
  using (created_by = auth.uid());

create policy "Creator can delete recurring payments"
  on public.recurring_payments for delete
  using (created_by = auth.uid());
