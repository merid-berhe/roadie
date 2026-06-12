-- v5.3 — Glovebox collection fix + the public Radio (run in Supabase SQL editor)

-- 1. glovebox_entries had no created_at; the Glovebox query ordered by it and
--    silently returned nothing.
alter table glovebox_entries add column if not exists created_at timestamptz default now();

-- 2. Both riders saving the same ride created duplicate song rows. The track
--    file URL is the ride's natural key — dedupe on it.
create unique index if not exists songs_audio_url_key on songs (audio_url);
create unique index if not exists treasures_song_id_key on treasures (song_id);

-- 3. The Radio: songs are public, anonymous artifacts (glyphs only, no PII) —
--    readable by everyone, including visitors who haven't "gotten in" yet.
drop policy if exists "songs: read all" on songs;
create policy "songs: read all" on songs for select using (true);
