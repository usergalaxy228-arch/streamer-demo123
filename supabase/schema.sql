-- Clipify — database schema
-- Paste this into the Supabase dashboard: SQL Editor → New query → Run.
--
-- Users are handled entirely by Supabase Auth (the built-in `auth.users`
-- table), so we don't create a `users` table ourselves. We only add `clips`
-- and reference `auth.users(id)` for ownership.

-- ---------------------------------------------------------------------------
-- clips
-- ---------------------------------------------------------------------------
create table if not exists public.clips (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references auth.users (id) on delete cascade,
  original_stream_url text not null,
  start_time          double precision not null,  -- seconds from stream start
  end_time            double precision not null,  -- seconds from stream start
  file_url            text,                        -- URL to the rendered clip
  created_at          timestamptz not null default now()
);

-- Fast lookups of a user's clips, newest first.
create index if not exists clips_user_id_created_at_idx
  on public.clips (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Row Level Security: each user can only see and manage their own clips.
-- ---------------------------------------------------------------------------
alter table public.clips enable row level security;

create policy "Users can view their own clips"
  on public.clips for select
  using (auth.uid() = user_id);

create policy "Users can insert their own clips"
  on public.clips for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own clips"
  on public.clips for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete their own clips"
  on public.clips for delete
  using (auth.uid() = user_id);
