-- Kakeibo app: cloud data storage schema
-- Run this once in the Supabase project's SQL Editor
-- (Dashboard → SQL Editor → New query → paste → Run)

-- ========== entries: each income/expense record ==========
create table if not exists public.kakeibo_entries (
  id           text primary key,
  user_id      uuid not null references auth.users(id) on delete cascade,
  date         date not null,
  asset        text not null default '',
  category     text not null default '',
  subcategory  text not null default '',
  description  text not null default '',
  amount       numeric not null default 0,
  type         text not null default '',
  memo         text not null default '',
  currency     text not null default 'JPY',
  source       text not null default '',
  created_at   timestamptz not null default now()
);

create index if not exists kakeibo_entries_user_id_idx on public.kakeibo_entries(user_id);
create index if not exists kakeibo_entries_date_idx on public.kakeibo_entries(date);

alter table public.kakeibo_entries enable row level security;

drop policy if exists "select own entries" on public.kakeibo_entries;
create policy "select own entries" on public.kakeibo_entries
  for select using (auth.uid() = user_id);

drop policy if exists "insert own entries" on public.kakeibo_entries;
create policy "insert own entries" on public.kakeibo_entries
  for insert with check (auth.uid() = user_id);

drop policy if exists "update own entries" on public.kakeibo_entries;
create policy "update own entries" on public.kakeibo_entries
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "delete own entries" on public.kakeibo_entries;
create policy "delete own entries" on public.kakeibo_entries
  for delete using (auth.uid() = user_id);

-- ========== per-user settings: category map ==========
create table if not exists public.kakeibo_settings (
  user_id       uuid primary key references auth.users(id) on delete cascade,
  category_map  jsonb not null default '{}'::jsonb,
  updated_at    timestamptz not null default now()
);

alter table public.kakeibo_settings enable row level security;

drop policy if exists "select own settings" on public.kakeibo_settings;
create policy "select own settings" on public.kakeibo_settings
  for select using (auth.uid() = user_id);

drop policy if exists "insert own settings" on public.kakeibo_settings;
create policy "insert own settings" on public.kakeibo_settings
  for insert with check (auth.uid() = user_id);

drop policy if exists "update own settings" on public.kakeibo_settings;
create policy "update own settings" on public.kakeibo_settings
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
