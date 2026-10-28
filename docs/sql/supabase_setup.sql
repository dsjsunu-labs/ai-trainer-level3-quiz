-- AI训练师三级刷题站：学习进度表与行级权限
-- 可重复执行前请先确认表和策略是否已经存在。

create table public.user_progress (
  user_id uuid primary key references auth.users(id) on delete cascade,
  progress jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.user_progress enable row level security;

create policy "Users can read own progress"
on public.user_progress
for select
to authenticated
using (auth.uid() = user_id);

create policy "Users can insert own progress"
on public.user_progress
for insert
to authenticated
with check (auth.uid() = user_id);

create policy "Users can update own progress"
on public.user_progress
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

grant select, insert, update on public.user_progress to authenticated;
