// v6.0 — the Home page: a bright travel-poster front door. Live desert drive
// as the hero, how-it-works, and the Radio (every song anyone has made).
// This is the link you send a colleague.
import { Suspense, lazy, useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { Archive, Car, Disc3, Mic, Pause, PenLine, Play, Radio, Route } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { track } from '../lib/analytics';
import { CharacterFace, characterName } from '../components/CharacterFace';
import { Button, Glass, RoadDivider, SignLabel } from '../components/ui';

gsap.registerPlugin(ScrollTrigger);

const PlayCanvasRideScene = lazy(() => import('../scene/PlayCanvasRideScene'));

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
  [Car, 'get in', 'open a ride link with a friend — one of you drives, one rides shotgun'],
  [PenLine, 'write the song', 'an instrument each, a direction each — the studio fuses them into one track'],
  [Disc3, 'meet & press', 'dance by the car while your song is pressed'],
  [Route, 'ride', 'cruise a real place together to a song that exists nowhere else'],
] as const;

export default function Home({ onGlovebox }: { onGlovebox: () => void }) {
  const rootRef = useRef<HTMLElement>(null);
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

  // Entrance + scroll reveals — static sections only (song rows arrive async)
  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.from('[data-hero]', {
        y: 28, opacity: 0, duration: 0.8, ease: 'power3.out', stagger: 0.12, delay: 0.2,
      });
      gsap.utils.toArray<HTMLElement>('[data-reveal]').forEach((el) => {
        gsap.from(el, {
          y: 26, opacity: 0, duration: 0.7, ease: 'power2.out',
          scrollTrigger: { trigger: el, start: 'top 88%' },
        });
      });
    }, rootRef);
    return () => ctx.revert();
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
    <main ref={rootRef} className="min-h-full bg-cream pb-20">
      {/* Hero — a live drive through the desert, drag to look around */}
      <div className="relative h-[58vh] min-h-[440px] overflow-hidden">
        <HeroScene />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-32 bg-gradient-to-b from-transparent to-cream" />

        <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between px-6 pt-5">
          <div data-hero className="pointer-events-auto">
            <p className="font-display text-2xl font-semibold tracking-tight text-ink drop-shadow-sm">Roadie</p>
            <div className="road-dashes mt-1 w-14" />
          </div>
          <button
            data-hero
            onClick={onGlovebox}
            className="pointer-events-auto flex items-center gap-2 rounded-full bg-paper/80 px-4 py-2 text-sm font-semibold text-ink shadow-card backdrop-blur-md transition hover:bg-paper"
          >
            <Archive size={15} className="text-sunset" />
            your glovebox
          </button>
        </div>

        <div className="absolute inset-x-0 bottom-6 flex justify-center px-5">
          <Glass className="pointer-events-auto flex max-w-xl flex-col items-center gap-3 px-8 py-6 text-center" >
            <div data-hero>
              <SignLabel>a two-seater music game</SignLabel>
            </div>
            <h1 data-hero className="font-display text-3xl font-semibold leading-tight text-ink sm:text-4xl">
              Make a song with someone.
              <br />
              Then ride to it.
            </h1>
            <div data-hero className="flex flex-col items-center gap-1.5">
              <Button onClick={startRide} className="flex items-center gap-2 px-8 text-lg">
                <Car size={20} />
                start a ride
              </Button>
              <p className="text-xs text-ink-soft">you'll get a link to send your co-rider</p>
            </div>
          </Glass>
        </div>
      </div>

      {/* How it works */}
      <section className="mx-auto mt-10 max-w-3xl px-5">
        <div data-reveal className="flex flex-col items-center gap-3 text-center">
          <SignLabel>how it works</SignLabel>
          <RoadDivider className="max-w-[160px]" />
        </div>
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {STEPS.map(([Icon, name, blurb]) => (
            <div key={name} data-reveal className="rounded-2xl bg-paper px-4 py-4 shadow-card">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-sunset/12 text-sunset">
                <Icon size={18} />
              </span>
              <p className="mt-2 font-display text-sm font-semibold text-ink">{name}</p>
              <p className="mt-1 text-xs leading-5 text-ink-soft">{blurb}</p>
            </div>
          ))}
        </div>
      </section>

      {/* The Radio */}
      <section className="mx-auto mt-14 max-w-2xl px-5">
        <div data-reveal className="mb-1 flex items-center justify-between">
          <SignLabel className="flex items-center gap-1.5">
            <Radio size={13} className="text-teal" />
            the radio
          </SignLabel>
          {songs.length > 0 && (
            <Button
              variant="secondary"
              onClick={() => playFrom(playingIdx == null ? 0 : null)}
              className="flex items-center gap-1.5 px-4 py-1.5 text-sm"
            >
              {playingIdx == null ? <Play size={14} /> : <Pause size={14} />}
              {playingIdx == null ? 'play all' : 'stop'}
            </Button>
          )}
        </div>
        <p data-reveal className="mb-5 text-sm text-ink-soft">
          every song here was made by two people on one ride — nowhere else, never again
        </p>

        {loading && <p className="text-sm text-ink-faint">tuning…</p>}
        {!loading && !supabase && (
          <p className="text-sm text-ink-faint">the radio needs Supabase keys (app/.env.local)</p>
        )}
        {!loading && supabase && songs.length === 0 && (
          <p className="text-sm text-ink-faint">silence so far — be the first two on the air</p>
        )}

        <div className="flex flex-col gap-2.5">
          {songs.map((song, idx) => {
            const isPlaying = playingIdx === idx;
            const place = song.destinations
              ? `${song.destinations.name}, ${song.destinations.country}`
              : song.road ?? 'the road';
            return (
              <button
                key={song.id}
                onClick={() => playFrom(isPlaying ? null : idx)}
                className={`flex items-center gap-3 rounded-2xl bg-paper px-4 py-3 text-left shadow-card transition hover:-translate-y-0.5 ${
                  isPlaying ? 'ring-2 ring-sunset' : ''
                }`}
              >
                <span
                  className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full transition ${
                    isPlaying ? 'bg-sunset text-paper' : 'bg-sunset/12 text-sunset'
                  }`}
                >
                  {isPlaying ? <Pause size={16} /> : <Play size={16} className="ml-0.5" />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 truncate font-display text-sm font-semibold text-ink">
                    {song.title ?? 'untitled'}
                    {song.recipe?.vocals && <Mic size={12} className="flex-shrink-0 text-teal" />}
                  </p>
                  <p className="truncate text-xs text-ink-soft">
                    {(song.contributor_glyphs ?? []).map((c) => characterName(c) ?? c).join(' + ') || 'two riders'} · {place} ·{' '}
                    {new Date(song.created_at).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex flex-shrink-0 -space-x-2">
                  {(song.contributor_glyphs ?? []).slice(0, 2).map((c, i) => (
                    <CharacterFace key={i} id={c} size={28} />
                  ))}
                </div>
              </button>
            );
          })}
        </div>

        {nowPlaying?.recipe?.brief && (
          <p className="mt-5 text-center text-sm italic text-ink-soft">“{nowPlaying.recipe.brief}”</p>
        )}
      </section>

      <footer className="mt-16 flex flex-col items-center gap-2 px-5">
        <RoadDivider className="max-w-[120px]" />
        <p className="text-xs text-ink-faint">made by two riders at a time</p>
      </footer>
    </main>
  );
}

// The hero is a real drive — same scene the game runs, dragging orbits the car.
function HeroScene() {
  const [t, setT] = useState(0);
  useEffect(() => {
    let raf: number;
    const start = performance.now();
    const tick = (now: number) => {
      setT((now - start) / 1000);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);
  return (
    <Suspense fallback={<div className="absolute inset-0 bg-gradient-to-b from-sky to-cream" />}>
      <PlayCanvasRideScene
        road="desert"
        positionSec={t}
        driverColor="#E85D2F"
        passengerColor="#18A39A"
        driverCharacter="moss"
        passengerCharacter="juno"
      />
    </Suspense>
  );
}

const ALPHABET = 'abcdefghijkmnpqrstuvwxyz23456789';
function randomCode(length = 6): string {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  let code = '';
  for (let i = 0; i < length; i++) code += ALPHABET[bytes[i] % ALPHABET.length];
  return code;
}
