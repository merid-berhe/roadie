// v7.0 — the world map is Home. Bars (cities) are pins; you pick one to enter.
// Rough pass: a clean stylized map panel with lat/lon-placed pins + real song
// counts. A mini-car rolls to your pick (delight + masks the room load). The
// beautiful illustrated map is Phase 2.
import { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { Archive, Car, MapPin, Music2, Radio } from 'lucide-react';
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

// equirectangular projection → percentage position on the map panel
const px = (lon: number) => ((lon + 180) / 360) * 100;
const py = (lat: number) => ((90 - lat) / 180) * 100;

export default function WorldMap({ onOpenRadio, onGlovebox }: { onOpenRadio: () => void; onGlovebox: () => void }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const carRef = useRef<HTMLDivElement>(null);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [traveling, setTraveling] = useState<string | null>(null);

  useEffect(() => {
    if (!supabase) return;
    supabase.from('songs').select('destination_id').then(({ data }) => {
      const tally: Record<string, number> = {};
      for (const r of (data ?? []) as { destination_id: string | null }[]) {
        if (r.destination_id) tally[r.destination_id] = (tally[r.destination_id] ?? 0) + 1;
      }
      setCounts(tally);
    });
  }, []);

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.from('[data-pin]', { scale: 0, opacity: 0, duration: 0.5, ease: 'back.out(2)', stagger: 0.06, delay: 0.2 });
      gsap.from('[data-hd]', { y: -16, opacity: 0, duration: 0.6, ease: 'power3.out' });
    }, rootRef);
    return () => ctx.revert();
  }, []);

  function enterBar(barId: string, lon: number, lat: number) {
    if (traveling) return;
    setTraveling(barId);
    track('bar_entered', { bar: barId });
    const go = () => {
      const url = new URL(window.location.href);
      url.searchParams.set('room', `${barId}__${randomCode()}`);
      window.location.href = url.toString();
    };
    // roll the mini-car to the pin, then navigate (delight + load mask)
    if (carRef.current && rootRef.current) {
      gsap.set(carRef.current, { opacity: 1 });
      gsap.to(carRef.current, {
        left: `${px(lon)}%`, top: `${py(lat)}%`, duration: 1.0, ease: 'power2.inOut',
        onComplete: () => setTimeout(go, 250),
      });
    } else {
      setTimeout(go, 200);
    }
  }

  return (
    <main ref={rootRef} className="flex min-h-full flex-col bg-cream">
      {/* nav */}
      <nav className="sticky top-0 z-30 border-b border-ink/5 bg-cream/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-3">
          <div data-hd>
            <span className="font-display text-xl font-semibold tracking-tight text-ink">Roadie</span>
            <span className="road-dashes mt-0.5 block w-12" />
          </div>
          <div className="flex items-center gap-1 sm:gap-2">
            <NavLink onClick={onOpenRadio} icon={<Radio size={14} />} label="Listen" />
            <NavLink onClick={onGlovebox} icon={<Archive size={14} />} label="Glovebox" />
          </div>
        </div>
      </nav>

      <div className="mx-auto w-full max-w-5xl px-5 py-6">
        <div data-hd className="mb-5 text-center">
          <h1 className="font-display text-2xl font-semibold text-ink sm:text-3xl">Pick a bar. Make a song with someone there.</h1>
          <p className="mt-1 text-sm text-ink-soft">every bar collects the music made in it — drop in and add yours</p>
        </div>

        {/* the (rough) map */}
        <div
          className="relative w-full overflow-hidden rounded-3xl border border-ink/10 shadow-card"
          style={{
            aspectRatio: '2 / 1',
            background: 'linear-gradient(180deg, #bfe0ee 0%, #a8d2e6 55%, #9ec7df 100%)',
            backgroundImage:
              'repeating-linear-gradient(0deg, rgba(255,255,255,0.18) 0 1px, transparent 1px 12.5%), repeating-linear-gradient(90deg, rgba(255,255,255,0.18) 0 1px, transparent 1px 8.33%), linear-gradient(180deg, #bfe0ee, #9ec7df)',
          }}
        >
          {/* mini traveler */}
          <div
            ref={carRef}
            className="pointer-events-none absolute z-20 -translate-x-1/2 -translate-y-1/2 text-sunset opacity-0"
            style={{ left: '50%', top: '60%' }}
          >
            <Car size={26} />
          </div>

          {BARS.map((b) => {
            const songs = counts[b.id] ?? 0;
            return (
              <button
                key={b.id}
                data-pin
                onClick={() => enterBar(b.id, b.lon, b.lat)}
                className="group absolute z-10 flex -translate-x-1/2 -translate-y-full flex-col items-center"
                style={{ left: `${px(b.lon)}%`, top: `${py(b.lat)}%` }}
              >
                <span className="whitespace-nowrap rounded-full bg-paper px-2.5 py-1 text-xs font-display font-semibold text-ink shadow-card transition group-hover:-translate-y-0.5">
                  {b.name}
                  <span className="ml-1.5 inline-flex items-center gap-0.5 font-normal text-ink-soft">
                    <Music2 size={10} className="text-sunset" />{songs}
                  </span>
                </span>
                <MapPin size={20} className="mt-0.5 fill-sunset text-sunset-deep drop-shadow" />
              </button>
            );
          })}
        </div>

        <div className="mt-4 flex items-center justify-center gap-2 text-xs text-ink-soft">
          <MapPin size={13} className="text-sunset" /> tap a bar to head there
          <span className="text-ink-faint">·</span>
          <Music2 size={13} className="text-sunset" /> songs made there
        </div>

        {traveling && (
          <p className="mt-3 text-center text-sm font-display font-semibold text-sunset-deep">
            heading to {BARS.find((b) => b.id === traveling)?.name}…
          </p>
        )}
      </div>
    </main>
  );
}

function NavLink({ onClick, icon, label }: { onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <Button variant="ghost" onClick={onClick} className="flex items-center gap-1.5 px-3 py-2 text-sm">
      {icon}
      {label}
    </Button>
  );
}
