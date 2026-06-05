-- Roadie — §14 data model
-- Run this in the Supabase SQL editor (or via supabase db push) to set up the schema.

-- Users: anonymous, no PII
create table if not exists users (
  id            uuid primary key,             -- = supabase anon auth uid
  glyph         text not null,
  color         text not null,
  reports_received int default 0,
  created_at    timestamptz default now()
);

-- Rides
create table if not exists rides (
  id            uuid primary key default gen_random_uuid(),
  room_code     text,
  driver_id     uuid references users(id),
  passenger_id  uuid references users(id),
  status        text default 'composing',     -- composing|generating|riding|completed|abandoned
  music_source  text,                         -- own|borrowed (§16 contamination flag)
  recipe        jsonb,
  created_at    timestamptz default now(),
  completed_at  timestamptz
);

-- Songs (saved to Glovebox)
create table if not exists songs (
  id                uuid primary key default gen_random_uuid(),
  ride_id           uuid references rides(id),
  audio_url         text not null,
  title             text,
  recipe            jsonb,
  contributor_glyphs text[],
  road              text default 'coast',
  created_at        timestamptz default now()
);

-- Glovebox: which users have which songs
create table if not exists glovebox_entries (
  user_id  uuid references users(id),
  song_id  uuid references songs(id),
  primary key (user_id, song_id)
);

-- Reports
create table if not exists reports (
  id          uuid primary key default gen_random_uuid(),
  ride_id     uuid references rides(id),
  reporter_id uuid references users(id),
  created_at  timestamptz default now()
);

-- Events (§13 instrumentation — fallback if PostHog is not configured)
create table if not exists events (
  id         bigserial primary key,
  user_id    uuid,
  ride_id    uuid,
  name       text not null,
  props      jsonb,
  created_at timestamptz default now()
);

-- Row Level Security
alter table users           enable row level security;
alter table rides           enable row level security;
alter table songs           enable row level security;
alter table glovebox_entries enable row level security;
alter table reports         enable row level security;
alter table events          enable row level security;

-- Users: read own row only
create policy "users: read own" on users for select using (auth.uid() = id);
create policy "users: insert own" on users for insert with check (auth.uid() = id);
create policy "users: update own" on users for update using (auth.uid() = id);

-- Glovebox: each user reads only their own entries
create policy "glovebox: read own" on glovebox_entries for select using (auth.uid() = user_id);
create policy "glovebox: insert own" on glovebox_entries for insert with check (auth.uid() = user_id);

-- Songs: readable if you have a glovebox entry for it
create policy "songs: read via glovebox" on songs for select using (
  exists (
    select 1 from glovebox_entries
    where glovebox_entries.song_id = songs.id
      and glovebox_entries.user_id = auth.uid()
  )
);
create policy "songs: insert authenticated" on songs for insert with check (auth.role() = 'authenticated');

-- Rides: readable by participants
create policy "rides: read own" on rides for select using (
  auth.uid() = driver_id or auth.uid() = passenger_id
);
create policy "rides: insert authenticated" on rides for insert with check (auth.role() = 'authenticated');
create policy "rides: update own" on rides for update using (
  auth.uid() = driver_id or auth.uid() = passenger_id
);

-- Reports: insert only
create policy "reports: insert own" on reports for insert with check (auth.uid() = reporter_id);

-- Events: insert own
create policy "events: insert own" on events for insert with check (auth.uid() = user_id or user_id is null);
