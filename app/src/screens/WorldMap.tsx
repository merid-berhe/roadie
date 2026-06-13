// v7.0 Phase 2 — the world map is Home. A real-geography world (equirectangular
// SVG, recoloured to our palette), full-screen, with bar pins; picking one drives
// the cicada there and zooms in to reveal the bar before you enter. (If we later
// swap in illustrated/isometric art, only the base layer + pin coords change.)
import { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { Archive, Music2, Radio } from 'lucide-react';
import { BARS } from '@roadie/shared';
import { supabase } from '../lib/supabase';
import { track } from '../lib/analytics';
import { Button } from '../components/ui';

const ALPHABET = 'abcdefghijkmnpqrstuvwxyz23456789';
function randomCode(n = 5): string {
  const b = crypto.getRandomValues(new Uint8Array(n));
  let s = '';
  for (let i = 0; i < n; i++) s += ALPHABET[b[i] % ALPHABET.length];
  return s;
}

// equirectangular → percent within the map plate
const px = (lon: number) => ((lon + 180) / 360) * 100;
const py = (lat: number) => ((90 - lat) / 180) * 100;

export default function WorldMap({ onOpenRadio, onGlovebox }: { onOpenRadio: () => void; onGlovebox: () => void }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const plateRef = useRef<HTMLDivElement>(null);
  const carRef = useRef<HTMLImageElement>(null);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [traveling, setTraveling] = useState<string | null>(null);

  useEffect(() => {
    if (!supabase) return;
    supabase.from('songs').select('destination_id').then(({ data }) => {
      const t: Record<string, number> = {};
      for (const r of (data ?? []) as { destination_id: string | null }[]) {
        if (r.destination_id) t[r.destination_id] = (t[r.destination_id] ?? 0) + 1;
      }
      setCounts(t);
    });
  }, []);

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.from('[data-pin]', { scale: 0, opacity: 0, duration: 0.5, ease: 'back.out(2)', stagger: 0.05, delay: 0.3 });
    }, rootRef);
    return () => ctx.revert();
  }, []);

  function enterBar(barId: string, lon: number, lat: number) {
    if (traveling) return;
    setTraveling(barId);
    track('bar_entered', { bar: barId });
    const x = px(lon), y = py(lat);
    const go = () => {
      const url = new URL(window.location.href);
      url.searchParams.set('room', `${barId}__${randomCode()}`);
      window.location.href = url.toString();
    };
    const tl = gsap.timeline({ onComplete: () => setTimeout(go, 350) });
    if (carRef.current) {
      gsap.set(carRef.current, { opacity: 1 });
      tl.to(carRef.current, { left: `${x}%`, top: `${y}%`, duration: 1.1, ease: 'power2.inOut' }, 0);
    }
    if (plateRef.current) {
      tl.to(plateRef.current, { scale: 3, transformOrigin: `${x}% ${y}%`, duration: 1.4, ease: 'power2.inOut' }, 0.2);
    }
  }

  return (
    <div ref={rootRef} className="relative h-screen w-screen overflow-hidden" style={{ background: 'linear-gradient(180deg,#bfe0ee,#9ec7df)' }}>
      {/* nav */}
      <nav className="absolute inset-x-0 top-0 z-30 flex items-center justify-between px-5 py-3">
        <div className="rounded-full bg-paper/85 px-3 py-1.5 shadow-card backdrop-blur-md">
          <span className="font-display text-lg font-semibold tracking-tight text-ink">Roadie</span>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={onOpenRadio} className="flex items-center gap-1.5 px-3 py-2 text-sm"><Radio size={14} /> Listen</Button>
          <Button variant="secondary" onClick={onGlovebox} className="flex items-center gap-1.5 px-3 py-2 text-sm"><Archive size={14} /> Glovebox</Button>
        </div>
      </nav>

      <div className="absolute inset-x-0 top-16 z-20 text-center">
        <p className="font-display text-base font-semibold text-ink drop-shadow-sm sm:text-lg">Pick a bar. Make a song with someone there.</p>
      </div>

      {/* the map plate (zoom target) */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div ref={plateRef} className="worldplate relative w-full" style={{ aspectRatio: '2754 / 1398' }}>
          {/* base world — its own styling (land/borders) over our ocean; warm-tinted */}
          <img
            src="/assets/world.svg"
            alt=""
            className="pointer-events-none absolute inset-0 h-full w-full"
            style={{ filter: 'sepia(0.5) saturate(1.1) brightness(1.02) hue-rotate(-8deg)' }}
          />

          {/* mini cicada traveler */}
          <img
            ref={carRef}
            src="/assets/cicada-map.png"
            alt=""
            className="pointer-events-none absolute z-20 -translate-x-1/2 -translate-y-1/2 opacity-0"
            style={{ left: '50%', top: '58%', width: '7%' }}
          />

          {BARS.map((b) => {
            const songs = counts[b.id] ?? 0;
            return (
              <button
                key={b.id}
                data-pin
                onClick={() => enterBar(b.id, b.lon, b.lat)}
                className="group absolute z-10 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center"
                style={{ left: `${px(b.lon)}%`, top: `${py(b.lat)}%` }}
              >
                <span className="mb-0.5 whitespace-nowrap rounded-full bg-paper px-2 py-0.5 text-[11px] font-display font-semibold text-ink shadow-card transition group-hover:-translate-y-0.5">
                  {b.name}
                  <span className="ml-1 inline-flex items-center gap-0.5 font-normal text-ink-soft">
                    <Music2 size={9} className="text-sunset" />{songs}
                  </span>
                </span>
                <span className="h-3 w-3 rounded-full border-2 border-paper bg-sunset shadow ring-1 ring-sunset-deep/40 transition group-hover:scale-125" />
              </button>
            );
          })}
        </div>
      </div>

      {traveling && (
        <p className="absolute inset-x-0 bottom-6 z-30 text-center font-display text-sm font-semibold text-sunset-deep">
          driving to {BARS.find((b) => b.id === traveling)?.name}…
        </p>
      )}
    </div>
  );
}
