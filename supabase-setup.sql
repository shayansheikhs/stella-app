-- Supabase SQL Editor mein yeh poora paste karo aur RUN dabao

create table if not exists app_users (
  id text primary key,
  name text not null,
  email text unique not null,
  password_hash text not null,
  role text default 'user',
  message_count int default 0,
  last_login bigint,
  created_at bigint
);

create table if not exists conversations (
  id text primary key,
  user_id text,
  user_name text,
  user_email text,
  admin_live boolean default false,
  messages jsonb default '[]'::jsonb,
  unread_admin int default 0,
  unread_user int default 0,
  last_update bigint
);

alter table app_users enable row level security;
alter table conversations enable row level security;

drop policy if exists "public app_users" on app_users;
drop policy if exists "public conversations" on conversations;

create policy "public app_users" on app_users for all using (true) with check (true);
create policy "public conversations" on conversations for all using (true) with check (true);

-- Realtime (messages turant sync hon)
alter table conversations replica identity full;
