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

-- Real-world destinations used by rooms and treasure drops
create table if not exists destinations (
  id                text primary key,
  name              text not null,
  country           text not null,
  region            text not null,
  lat               double precision not null,
  lon               double precision not null,
  theme             text not null,             -- desert|coast|mountain|city
  tags              text[] default '{}',
  fact              text not null,
  fact_source_title text not null,
  fact_source_url   text not null,
  prompt_flavor     text not null,
  created_at        timestamptz default now()
);

insert into destinations (id, name, country, region, lat, lon, theme, tags, fact, fact_source_title, fact_source_url, prompt_flavor) values
  ('big-sur-ca', 'Big Sur', 'United States', 'California', 36.2704, -121.8081, 'coast', array['cliffs','pacific','highway'], 'Big Sur is a rugged stretch of California coast where the Santa Lucia Mountains rise directly from the Pacific.', 'California State Parks - Big Sur', 'https://www.parks.ca.gov/?page_id=570', 'a cliffside Pacific road with salt air, wide turns, and late sun'),
  ('chefchaouen-ma', 'Chefchaouen', 'Morocco', 'Tangier-Tetouan-Al Hoceima', 35.1688, -5.2636, 'mountain', array['rif-mountains','blue-city','medina'], 'Chefchaouen sits in the Rif Mountains and is known for the blue-painted lanes of its old medina.', 'UNESCO World Heritage Centre - Chefchaouen Medina', 'https://whc.unesco.org/en/tentativelists/6063/', 'a blue mountain medina road with soft echoes and close stone alleys'),
  ('seligman-route-66-us', 'Route 66 near Seligman', 'United States', 'Arizona', 35.3256, -112.8741, 'desert', array['desert','route-66','americana'], 'Seligman helped preserve historic Route 66 culture after interstate traffic bypassed many Arizona main streets.', 'National Park Service - Route 66 Corridor Preservation', 'https://www.nps.gov/subjects/travelroute66/index.htm', 'a dusty Route 66 desert cruise with neon motel signs and open horizon'),
  ('lofoten-no', 'Lofoten', 'Norway', 'Nordland', 68.2096, 13.9578, 'coast', array['islands','arctic','fishing-villages'], 'Lofoten is an Arctic island chain known for sharp mountains, sheltered bays, and fishing villages.', 'Visit Norway - Lofoten', 'https://www.visitnorway.com/places-to-go/northern-norway/the-lofoten-islands/', 'an Arctic island road beside cold water, red cabins, and jagged peaks'),
  ('kyoto-jp', 'Kyoto', 'Japan', 'Kansai', 35.0116, 135.7681, 'city', array['temples','lanterns','old-streets'], 'Kyoto was Japan''s imperial capital for more than a thousand years and is known for historic temples and gardens.', 'UNESCO World Heritage Centre - Historic Monuments of Ancient Kyoto', 'https://whc.unesco.org/en/list/688/', 'a quiet lantern-lit city ride past old wooden streets and garden walls'),
  ('atacama-cl', 'Atacama Desert', 'Chile', 'Antofagasta', -23.8634, -69.1328, 'desert', array['desert','salt-flats','stars'], 'The Atacama is one of the driest non-polar deserts on Earth and a major site for astronomy observatories.', 'European Southern Observatory - Atacama Desert', 'https://www.eso.org/public/teles-instr/sites/atacama/', 'a high desert night drive under huge stars and pale salt flats'),
  ('amalfi-it', 'Amalfi Coast', 'Italy', 'Campania', 40.6333, 14.6029, 'coast', array['coast','villages','switchbacks'], 'The Amalfi Coast is a UNESCO-listed cultural landscape of steep coastal towns, terraces, and winding roads.', 'UNESCO World Heritage Centre - Costiera Amalfitana', 'https://whc.unesco.org/en/list/830/', 'a bright Mediterranean switchback road above terraced towns and blue water'),
  ('banff-ca', 'Banff National Park', 'Canada', 'Alberta', 51.4968, -115.9281, 'mountain', array['rockies','lakes','forests'], 'Banff is Canada''s first national park and protects mountain landscapes in the Canadian Rockies.', 'Parks Canada - Banff National Park', 'https://parks.canada.ca/pn-np/ab/banff', 'a Rockies mountain road with blue lakes, dark pines, and clean cold air')
on conflict (id) do update set
  name = excluded.name,
  country = excluded.country,
  region = excluded.region,
  lat = excluded.lat,
  lon = excluded.lon,
  theme = excluded.theme,
  tags = excluded.tags,
  fact = excluded.fact,
  fact_source_title = excluded.fact_source_title,
  fact_source_url = excluded.fact_source_url,
  prompt_flavor = excluded.prompt_flavor;

-- Rides
create table if not exists rides (
  id            uuid primary key default gen_random_uuid(),
  room_code     text,
  destination_id text references destinations(id),
  driver_id     uuid references users(id),
  passenger_id  uuid references users(id),
  status        text default 'composing',     -- composing|generating|riding|completed|abandoned
  music_source  text,                         -- own|borrowed (§16 contamination flag)
  recipe        jsonb,
  created_at    timestamptz default now(),
  completed_at  timestamptz
);

alter table rides add column if not exists destination_id text references destinations(id);

-- Songs (saved to Glovebox)
create table if not exists songs (
  id                uuid primary key default gen_random_uuid(),
  ride_id           uuid references rides(id),
  destination_id    text references destinations(id),
  audio_url         text not null,
  title             text,
  recipe            jsonb,
  contributor_glyphs text[],
  road              text default 'coast',
  created_at        timestamptz default now()
);

alter table songs add column if not exists destination_id text references destinations(id);

-- Treasures: public discovery record for songs dropped at a destination
create table if not exists treasures (
  id                    uuid primary key default gen_random_uuid(),
  song_id               uuid references songs(id) on delete cascade,
  destination_id        text references destinations(id),
  title                 text,
  lat                   double precision not null,
  lon                   double precision not null,
  contributor_glyphs    text[],
  recipe                jsonb,
  fact_snapshot         text,
  source_title_snapshot text,
  source_url_snapshot   text,
  created_at            timestamptz default now()
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
alter table destinations    enable row level security;
alter table rides           enable row level security;
alter table songs           enable row level security;
alter table treasures       enable row level security;
alter table glovebox_entries enable row level security;
alter table reports         enable row level security;
alter table events          enable row level security;

-- Destinations and treasures are public discovery data
create policy "destinations: read all" on destinations for select using (true);
create policy "treasures: read all" on treasures for select using (true);
create policy "treasures: insert authenticated" on treasures for insert with check (auth.role() = 'authenticated');

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
create policy "songs: read via treasures" on songs for select using (
  exists (
    select 1 from treasures
    where treasures.song_id = songs.id
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
