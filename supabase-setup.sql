-- Run this in your Supabase SQL editor
-- https://supabase.com → your project → SQL Editor

create table if not exists contact_messages (
  id          bigint generated always as identity primary key,
  name        text not null,
  email       text not null,
  project_type text,
  message     text not null,
  created_at  timestamptz default now()
);

-- Optional: enable Row Level Security
alter table contact_messages enable row level security;

-- Allow the server (using anon key) to insert rows
create policy "Allow inserts" on contact_messages
  for insert with check (true);

-- Prevent public reads (only you can read via Supabase dashboard or service role key)
create policy "Block public reads" on contact_messages
  for select using (false);
