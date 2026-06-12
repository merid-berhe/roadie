// v5.3 — the Home page: intro to the game + the Radio (every song anyone has
// made, playable). This is the link you send a colleague.
import { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { track } from '../lib/analytics';
import { CharacterFace, characterName } from '../components/CharacterFace';

type RadioSong = {
  id: string;
  title: string | null;
  audio_url: string;
  contributor_glyphs: string[] | null;
  destinations: { name: string; country: string } | null;
  road: string | null;
  created_at: string;
  recipe: { vocals?: boolean; brief?: string } | null;
};

const STEPS = [
  ['🚗', 'get in', 'open a ride link with a friend — one of you drives, one rides shotgun'],
  ['✍️', 'write the song', 'a mood each, a prompt each — the studio fuses them into one track'],
  ['🕺', 'meet & press', 'dance by the car while your song is pressed'],
  ['🛣', 'ride', 'cruise a real place together to a song that exists nowhere else'],
] as const;

export default function Home({ onGlovebox }: { onGlovebox: () => void }) {
  const [songs, setSongs] = useState<RadioSong[]>([]);
  const [loading, setLoading] = useState(true);
  const [playingIdx, setPlayingIdx] = useState<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (!supabase) { setLoading(false); return; }
    supabase
      .from('songs')
      .select('id, title, audio_url, contributor_glyphs, road, created_at, recipe, destinations(name, country)')
      .order('created_at', { ascending: false })
      .limit(50)
      .then(({ data, error }) => {
        if (error) console.warn('[radio]', error.message);
        setSongs((data as unknown as RadioSong[]) ?? []);
        setLoading(false);
      });
    return () => { audioRef.current?.pause(); };
  }, []);

  // the running playlist: play one, and it keeps going down the list
  function playFrom(idx: number | null) {
    audioRef.current?.pause();
    audioRef.current = null;
    setPlayingIdx(idx);
    if (idx == null || !songs[idx]) return;
    const audio = new Audio(songs[idx].audio_url);
    audio.play().catch(() => setPlayingIdx(null));
    audio.onended = () => playFrom(idx + 1 < songs.length ? idx + 1 : null);
    audioRef.current = audio;
    track('radio_played', { song_id: songs[idx].id });
  }

  function startRide() {
    const url = new URL(window.location.href);
    url.searchParams.set('room', randomCode());
    track('ride_link_created');
    window.location.href = url.toString();
  }

  const nowPlaying = playingIdx != null ? songs[playingIdx] : null;

  return (
    <main className="min-h-full bg-[#0b1020] px-5 pb-24 pt-10 text-white">
      {/* Hero */}
      <div className="mx-auto max-w-md text-center">
        <p className="text-5xl">🚗</p>
        <h1 className="mt-2 text-4xl font-bold tracking-tight">Roadie</h1>
        <p className="mt-2 text-white/55">
          make a song with someone, then ride to it.
        </p>
        <button
          onClick={startRide}
          className="mt-6 w-full max-w-xs rounded-full bg-amber-400 py-4 text-lg font-semibold text-black transition active:scale-95"
        >
          start a ride
        </button>
        <p className="mt-2 text-xs text-white/35">you'll get a link to send your co-rider</p>
        <button onClick={onGlovebox} className="mt-4 text-sm text-white/45 underline-offset-4 hover:text-white/70">
          🧤 your glovebox
        </button>
      </div>

      {/* How it works */}
      <div className="mx-auto mt-10 grid max-w-md grid-cols-2 gap-3">
        {STEPS.map(([icon, name, blurb]) => (
          <div key={name} className="rounded-xl bg-white/[0.04] px-3 py-3">
            <p className="text-xl">{icon}</p>
            <p className="mt-1 text-sm font-semibold">{name}</p>
            <p className="mt-1 text-xs leading-5 text-white/45">{blurb}</p>
          </div>
        ))}
      </div>

      {/* The Radio */}
      <div className="mx-auto mt-12 max-w-md">
        <div className="mb-3 flex items-baseline justify-between">
          <p className="text-sm font-semibold uppercase tracking-widest text-white/50">📻 the radio</p>
          {songs.length > 0 && (
            <button
              onClick={() => playFrom(playingIdx == null ? 0 : null)}
              className="rounded-full bg-white/10 px-3 py-1 text-xs text-white/75 active:scale-95"
            >
              {playingIdx == null ? '▶ play all' : '⏸ stop'}
            </button>
          )}
        </div>
        <p className="mb-4 text-xs text-white/35">
          every song here was made by two people on one ride — nowhere else, never again
        </p>

        {loading && <p className="text-sm text-white/30">tuning…</p>}
        {!loading && !supabase && (
          <p className="text-sm text-white/30">the radio needs Supabase keys (app/.env.local)</p>
        )}
        {!loading && supabase && songs.length === 0 && (
          <p className="text-sm text-white/30">silence so far — be the first two on the air</p>
        )}

        <div className="flex flex-col gap-2">
          {songs.map((song, idx) => {
            const isPlaying = playingIdx === idx;
            const place = song.destinations
              ? `${song.destinations.name}, ${song.destinations.country}`
              : song.road ?? 'the road';
            return (
              <button
                key={song.id}
                onClick={() => playFrom(isPlaying ? null : idx)}
                className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-left transition active:bg-white/10"
                style={{ background: isPlaying ? 'rgba(245,166,35,0.12)' : 'rgba(255,255,255,0.04)' }}
              >
                <div
                  className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full border text-sm"
                  style={{ borderColor: isPlaying ? '#F5A623' : 'rgba(255,255,255,0.15)' }}
                >
                  {isPlaying ? '⏸' : '▶'}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {song.title ?? 'untitled'}
                    {song.recipe?.vocals ? ' 🎤' : ''}
                  </p>
                  <p className="truncate text-xs text-white/40">
                    {(song.contributor_glyphs ?? []).map((c) => characterName(c) ?? c).join(' + ') || 'two riders'} · {place} ·{' '}
                    {new Date(song.created_at).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex flex-shrink-0 -space-x-2">
                  {(song.contributor_glyphs ?? []).slice(0, 2).map((c, i) => (
                    <CharacterFace key={i} id={c} size={26} />
                  ))}
                </div>
              </button>
            );
          })}
        </div>

        {nowPlaying?.recipe?.brief && (
          <p className="mt-4 text-center text-xs italic text-white/40">“{nowPlaying.recipe.brief}”</p>
        )}
      </div>
    </main>
  );
}

const ALPHABET = 'abcdefghijkmnpqrstuvwxyz23456789';
function randomCode(length = 6): string {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  let code = '';
  for (let i = 0; i < length; i++) code += ALPHABET[bytes[i] % ALPHABET.length];
  return code;
}
