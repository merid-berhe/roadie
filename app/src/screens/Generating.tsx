import { useEffect } from 'react';
import { fadeBedIn, startBedSilent } from '../audio/bed';
import { useRoom } from '../state/room';

// "Tuning the radio" — the latency mask between composition and the ride (§1 step 4).
// The bed fades in here; crossfade to the track fires from RideScreen when rideStart arrives.
export default function Generating() {
  const riders = useRoom((s) => s.riders);

  useEffect(() => {
    startBedSilent(); // safe no-op if already started during compose
    fadeBedIn(2);     // car pulls out — bed becomes audible
  }, []);

  const driverGlyph = riders.find((r) => r.role === 'driver');
  const passengerGlyph = riders.find((r) => r.role === 'passenger');

  return (
    <main className="flex min-h-full flex-col items-center justify-center gap-8 bg-[#0b1020] px-6 text-white">
      {/* Rider glyphs */}
      <div className="flex items-center gap-8">
        {driverGlyph && (
          <span className="text-5xl" style={{ color: driverGlyph.color }}>{driverGlyph.glyph}</span>
        )}
        {passengerGlyph && (
          <span className="text-5xl" style={{ color: passengerGlyph.color }}>{passengerGlyph.glyph}</span>
        )}
      </div>

      {/* Tuning animation */}
      <div className="flex flex-col items-center gap-3">
        <div className="flex gap-1">
          {[0, 1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-8 w-1 rounded-full bg-amber-400"
              style={{
                animation: `pulse 1.2s ease-in-out ${i * 0.15}s infinite alternate`,
                opacity: 0.4 + i * 0.12,
              }}
            />
          ))}
        </div>
        <p className="text-sm text-white/60">tuning your station…</p>
        <p className="text-xs text-white/30">your song is being made</p>
      </div>
      <a
        href={location.pathname}
        className="mt-8 text-xs text-white/20 underline-offset-2 hover:text-white/40"
      >
        new ride
      </a>

      <style>{`
        @keyframes pulse {
          from { transform: scaleY(0.4); }
          to   { transform: scaleY(1.0); }
        }
      `}</style>
    </main>
  );
}
