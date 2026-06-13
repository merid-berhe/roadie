// v6.1 — the Home page, reframed as a music app: a sticky nav, a hero where
// the car is the star, and the Radio front-and-center (the coolest feature).
// This is the link you send a colleague.
import { Suspense, lazy, useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { Archive, ArrowRight, Car, Disc3, Mic, PenLine, Play, Radio, Route } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { track } from '../lib/analytics';
import { CharacterFace, characterName } from '../components/CharacterFace';
import { Button } from '../components/ui';

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

// the trip, as four stops on one road
const STOPS = [
  [Car, 'get in', 'open a ride link with a friend — one drives, one rides shotgun'],
  [PenLine, 'write the song', 'an instrument each, a direction each — the studio fuses them into one track'],
  [Disc3, 'meet & press', 'dance by the car while your song is pressed'],
  [Route, 'ride', 'cruise a real place together to a song that exists nowhere else'],
] as const;

export default function Home({ onOpenRadio, onGlovebox }: { onOpenRadio: () => void; onGlovebox: () => void }) {
  const rootRef = useRef<HTMLElement>(null);
  const howRef = useRef<HTMLDivElement>(null);
  const [songs, setSongs] = useState<RadioSong[]>([]);
  const [loading, setLoading] = useState(true);

  // a small taste of the Radio — the full hangout lives on its own page (v6.3)
  useEffect(() => {
    if (!supabase) { setLoading(false); return; }
    supabase
      .from('songs')
      .select('id, title, audio_url, contributor_glyphs, road, created_at, recipe, destinations(name, country)')
      .order('created_at', { ascending: false })
      .limit(4)
      .then(({ data, error }) => {
        if (error) console.warn('[radio]', error.message);
        setSongs((data as unknown as RadioSong[]) ?? []);
        setLoading(false);
      });
  }, []);

  // entrance + scroll reveals (static sections only — song rows arrive async)
  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.from('[data-hero]', {
        y: 24, opacity: 0, duration: 0.8, ease: 'power3.out', stagger: 0.1, delay: 0.15,
      });
      gsap.utils.toArray<HTMLElement>('[data-reveal]').forEach((el) => {
        gsap.from(el, {
          y: 24, opacity: 0, duration: 0.6, ease: 'power2.out',
          scrollTrigger: { trigger: el, start: 'top 90%' },
        });
      });
    }, rootRef);
    return () => ctx.revert();
  }, []);

  function startRide() {
    const url = new URL(window.location.href);
    url.searchParams.set('room', randomCode());
    track('ride_link_created');
    window.location.href = url.toString();
  }

  function scrollTo(ref: React.RefObject<HTMLElement | null>) {
    ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  return (
    <main ref={rootRef} className="min-h-full bg-cream pb-20">
      {/* Sticky nav */}
      <nav className="sticky top-0 z-30 border-b border-ink/5 bg-cream/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-3">
          <button onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} className="text-left">
            <span className="font-display text-xl font-semibold tracking-tight text-ink">Roadie</span>
            <span className="road-dashes mt-0.5 block w-12" />
          </button>
          <div className="flex items-center gap-1 sm:gap-2">
            <NavLink onClick={onOpenRadio} icon={<Radio size={14} />} label="Listen" />
            <NavLink onClick={() => scrollTo(howRef)} icon={<Route size={14} />} label="How it works" />
            <NavLink onClick={onGlovebox} icon={<Archive size={14} />} label="Glovebox" />
            <Button onClick={startRide} className="ml-1 flex items-center gap-2 px-4 py-2 text-sm sm:px-5">
              <Car size={16} />
              <span className="hidden sm:inline">start a ride</span>
              <span className="sm:hidden">ride</span>
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero — the car is the star; headline sits to the left so it never covers it */}
      <section className="relative h-[56vh] min-h-[380px] overflow-hidden">
        <HeroScene />
        {/* left scrim keeps the headline legible without hiding the center car */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-cream via-cream/55 to-transparent sm:via-cream/35" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-28 bg-gradient-to-b from-transparent to-cream" />

        <div className="absolute inset-0 flex items-center">
          <div className="mx-auto flex w-full max-w-5xl px-5">
            <div className="max-w-md">
              <p data-hero className="font-display text-xs font-medium uppercase tracking-[0.18em] text-sunset-deep">
                a two-seater music game
              </p>
              <h1 data-hero className="mt-2 font-display text-4xl font-semibold leading-[1.05] text-ink sm:text-5xl">
                Make a song
                <br />
                with someone.
                <br />
                <span className="text-sunset">Then ride to it.</span>
              </h1>
              <div data-hero className="mt-5 flex flex-col items-start gap-1.5">
                <Button onClick={startRide} className="flex items-center gap-2 px-7 text-lg">
                  <Car size={20} />
                  start a ride
                </Button>
                <p className="text-xs text-ink-soft">you'll get a link to send your co-rider</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* The Radio — a taste; the full listening hangout is its own page (v6.3) */}
      <section className="mx-auto mt-8 max-w-3xl px-5">
        <button
          onClick={onOpenRadio}
          className="block w-full rounded-3xl bg-paper p-5 text-left shadow-card transition hover:-translate-y-0.5 sm:p-6"
        >
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-teal/12 text-teal">
                <Radio size={17} />
              </span>
              <div>
                <p className="font-display text-lg font-semibold text-ink">The Radio</p>
                <p className="text-xs text-ink-soft">every song made by two people on one ride</p>
              </div>
            </div>
            <span className="flex items-center gap-1 font-display text-sm font-semibold text-sunset">
              open the radio <ArrowRight size={15} />
            </span>
          </div>

          <div className="flex flex-col gap-1">
            {loading && <p className="py-2 text-sm text-ink-faint">tuning…</p>}
            {!loading && !supabase && (
              <p className="py-2 text-sm text-ink-faint">the radio needs Supabase keys (app/.env.local)</p>
            )}
            {!loading && supabase && songs.length === 0 && (
              <p className="py-2 text-sm text-ink-faint">silence so far — be the first two on the air</p>
            )}

            {songs.map((song) => {
              const place = song.destinations
                ? `${song.destinations.name}, ${song.destinations.country}`
                : song.road ?? 'the road';
              return (
                <div key={song.id} className="flex items-center gap-3 rounded-xl px-2 py-2">
                  <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-sunset/12 text-sunset">
                    <Play size={16} className="ml-0.5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-1.5 truncate font-display text-sm font-semibold text-ink">
                      {song.title ?? 'untitled'}
                      {song.recipe?.vocals && <Mic size={12} className="flex-shrink-0 text-teal" />}
                    </p>
                    <p className="truncate text-xs text-ink-soft">
                      {(song.contributor_glyphs ?? []).map((c) => characterName(c) ?? c).join(' + ') || 'two riders'} · {place}
                    </p>
                  </div>
                  <div className="flex flex-shrink-0 -space-x-2">
                    {(song.contributor_glyphs ?? []).slice(0, 2).map((c, i) => (
                      <CharacterFace key={i} id={c} size={28} />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </button>
      </section>

      {/* How it works — four stops on one road */}
      <section ref={howRef} className="mx-auto mt-16 max-w-4xl scroll-mt-20 px-5">
        <div data-reveal className="mb-8 text-center">
          <p className="font-display text-xs font-medium uppercase tracking-[0.18em] text-ink-faint">the trip</p>
          <h2 className="mt-1 font-display text-2xl font-semibold text-ink">four stops, one road</h2>
        </div>
        <div className="relative">
          {/* the road the stops sit on */}
          <div className="road-dashes absolute left-0 right-0 top-7 hidden md:block" aria-hidden />
          <ol className="grid grid-cols-1 gap-5 sm:grid-cols-2 md:grid-cols-4">
            {STOPS.map(([Icon, name, blurb], i) => (
              <li key={name} data-reveal className="relative flex flex-col items-center text-center">
                <span className="relative z-10 flex h-14 w-14 items-center justify-center rounded-full border-4 border-cream bg-sunset text-paper shadow-warm">
                  <Icon size={22} />
                  <span className="absolute -right-1 -top-1 flex h-6 w-6 items-center justify-center rounded-full bg-gold font-display text-xs font-bold text-ink">
                    {i + 1}
                  </span>
                </span>
                <p className="mt-3 font-display text-base font-semibold text-ink">{name}</p>
                <p className="mt-1 text-sm leading-5 text-ink-soft">{blurb}</p>
              </li>
            ))}
          </ol>
        </div>
        <div data-reveal className="mt-10 flex justify-center">
          <Button onClick={startRide} className="flex items-center gap-2 px-8 text-lg">
            <Car size={20} />
            start a ride
          </Button>
        </div>
      </section>

      <footer className="mt-16 flex flex-col items-center gap-2 px-5">
        <span className="road-dashes w-24" aria-hidden />
        <p className="text-xs text-ink-faint">made by two riders at a time</p>
      </footer>
    </main>
  );
}

function NavLink({ onClick, icon, label }: { onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      onClick={onClick}
      className="hidden items-center gap-1.5 rounded-full px-3 py-2 text-sm font-semibold text-ink-soft transition hover:bg-sand/60 hover:text-ink sm:flex"
    >
      {icon}
      {label}
    </button>
  );
}

// the hero is a real drive — same scene the game runs, dragging orbits the car
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
        road="mountain"
        positionSec={t}
        driverColor="#C23A2B"
        passengerColor="#1F7A74"
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
