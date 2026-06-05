import { useEffect, useState } from 'react';
import SceneCanvas from '../scene/SceneCanvas';
import { getPalette } from '../scene/palette';
import { getActualPositionSec, nudgePlayback } from '../audio/player';
import { useRoom } from '../state/room';
import { useSession } from '../state/session';

// Ride duration matching the server's durationSec (§5: 120s, decided 2026-06-05)
const RIDE_DURATION_SEC = 120;

export default function Riding() {
  const identity = useSession((s) => s.identity);
  const riders = useRoom((s) => s.riders);
  const recipe = useRoom((s) => s.recipe);
  const rideStartAt = useRoom((s) => s.rideStartAt);
  const clockOffset = useRoom((s) => s.clockOffset);
  const syncPositionSec = useRoom((s) => s.syncPositionSec);

  // Clock-synced ride position, updated every animation frame
  const [positionSec, setPositionSec] = useState(0);

  useEffect(() => {
    let raf: number;
    function tick() {
      if (!rideStartAt) { raf = requestAnimationFrame(tick); return; }
      const pos = Math.max(0, (Date.now() + clockOffset - rideStartAt) / 1000);
      setPositionSec(pos);
      raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [rideStartAt, clockOffset]);

  // Drift correction: when server sync arrives, compare with actual audio position (§9)
  useEffect(() => {
    if (syncPositionSec == null) return;
    const actual = getActualPositionSec();
    if (actual == null) return;
    const drift = actual - syncPositionSec;
    if (Math.abs(drift) > 0.25) nudgePlayback(drift);
  }, [syncPositionSec]);

  const driver = riders.find((r) => r.role === 'driver');
  const passenger = riders.find((r) => r.role === 'passenger');
  const youRider = riders.find((r) => r.glyph === identity?.glyph);

  const palette = getPalette(recipe?.driver.seed, recipe?.passenger.seed);
  const progress = Math.min(1, positionSec / RIDE_DURATION_SEC);

  return (
    <div
      className="relative h-screen overflow-hidden"
      style={{ background: `linear-gradient(to bottom, ${palette.skyTop}, ${palette.skyBottom})` }}
    >
      {/* PixiJS scene fills the container */}
      <SceneCanvas
        palette={palette}
        positionSec={positionSec}
        driverGlyph={driver?.glyph ?? '▲'}
        driverColor={driver?.color ?? '#F5A623'}
        passengerGlyph={passenger?.glyph ?? '●'}
        passengerColor={passenger?.color ?? '#1FB6C4'}
      />

      {/* Minimal HUD — anchored to the cabin frame bottom area */}
      <div className="pointer-events-none absolute bottom-0 left-0 right-0 flex flex-col items-center gap-2 pb-6 pt-4">
        <a
          href={location.pathname}
          className="pointer-events-auto text-xs text-white/20 underline-offset-2 hover:text-white/40"
        >
          new ride
        </a>
        {/* Progress bar */}
        <div className="h-0.5 w-3/4 rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-white/40 transition-all"
            style={{ width: `${progress * 100}%` }}
          />
        </div>

        {/* Rider attribution */}
        <div className="flex items-center gap-4">
          {driver && (
            <span className="text-xs" style={{ color: driver.color }}>
              {driver.glyph} {recipe?.driver.seed}
            </span>
          )}
          <span className="text-xs text-white/20">×</span>
          {passenger && (
            <span className="text-xs" style={{ color: passenger.color }}>
              {passenger.glyph} {recipe?.passenger.seed}
            </span>
          )}
        </div>

        {/* Your role label */}
        {youRider && (
          <p className="text-xs text-white/30">you're the {youRider.role}</p>
        )}
      </div>
    </div>
  );
}
