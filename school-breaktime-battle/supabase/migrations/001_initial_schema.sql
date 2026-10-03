-- School Breaktime Battle: initial schema.
-- Realtime gameplay uses Supabase Realtime *broadcast* on channels named `room:{roomCode}`,
-- which needs no table replication. These tables keep room, player and result records.

create extension if not exists pgcrypto;

create table if not exists rooms (
  id uuid primary key default gen_random_uuid(),
  -- 4-digit code. Not globally unique: the app only reuses a code once the previous room
  -- with that code is closed or more than 12 hours old.
  room_code text not null check (room_code ~ '^[0-9]{4}$'),
  host_name text not null check (char_length(host_name) between 2 and 16),
  status text not null default 'waiting' check (status in ('waiting', 'playing', 'finished', 'closed')),
  max_players integer not null default 8 check (max_players between 2 and 8),
  match_duration integer not null default 120 check (match_duration in (60, 120, 180)),
  created_at timestamp with time zone default now(),
  started_at timestamp with time zone,
  ended_at timestamp with time zone
);

create index if not exists rooms_room_code_created_at_idx on rooms (room_code, created_at desc);

create table if not exists players (
  id uuid primary key default gen_random_uuid(),
  room_id uuid references rooms(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 2 and 16),
  character_key text,
  score integer not null default 0,
  is_host boolean not null default false,
  is_connected boolean not null default true,
  joined_at timestamp with time zone default now()
);

create index if not exists players_room_id_idx on players (room_id);

create table if not exists match_results (
  id uuid primary key default gen_random_uuid(),
  room_id uuid references rooms(id) on delete cascade,
  player_id uuid references players(id) on delete cascade,
  final_score integer not null default 0,
  rank integer not null,
  snacks_collected integer not null default 0,
  caught_count integer not null default 0,
  returned_to_class boolean not null default false,
  created_at timestamp with time zone default now()
);

create index if not exists match_results_room_id_idx on match_results (room_id);

-- Row level security.
-- Version 1 has no user accounts, so the browser uses the anon key for everything. These
-- policies let anonymous clients read and write game records and nothing else. Tighten them
-- (or move writes behind an API route) before using this beyond a classroom event.
alter table rooms enable row level security;
alter table players enable row level security;
alter table match_results enable row level security;

create policy "anon read rooms" on rooms for select to anon using (true);
create policy "anon create rooms" on rooms for insert to anon with check (true);
create policy "anon update rooms" on rooms for update to anon using (true) with check (true);

create policy "anon read players" on players for select to anon using (true);
create policy "anon create players" on players for insert to anon with check (true);
create policy "anon update players" on players for update to anon using (true) with check (true);
create policy "anon delete players" on players for delete to anon using (true);

create policy "anon read results" on match_results for select to anon using (true);
create policy "anon create results" on match_results for insert to anon with check (true);
