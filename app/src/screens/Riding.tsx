import { Suspense, lazy, useEffect, useState } from 'react';
import { getPalette } from '../scene/palette';
import type { RoadId } from '../scene/scenes';
import { getActualPositionSec, nudgePlayback } from '../audio/player';
import { useRoom } from '../state/room';
import { useSession } from '../state/session';

const RIDE_DURATION_SEC = 120;
const PixiSceneCanvas = lazy(() => import('../scene/SceneCanvas'));
const PlayCanvasRideScene = lazy(() => import('../scene/PlayCanvasRideScene'));

// v5.1 — the ride is the calm payoff: scenery, the song, the two of you.
// Gesture/firework buttons removed (user verdict: they read as dead weight);
// live presence lives in the Meeting's dance-off (§8d).
export default function Riding() {
  const identity = useSession((s) => s.identity);
  const riders    = useRoom((s) => s.riders);
  const recipe    = useRoom((s) => s.recipe);
  const rideStartAt   = useRoom((s) => s.rideStartAt);
  const clockOffset   = useRoom((s) => s.clockOffset);
  const syncPositionSec = useRoom((s) => s.syncPositionSec);
  const selectedRoad    = useRoom((s) => s.selectedRoad) as RoadId;
  const destination     = useRoom((s) => s.destination);

  const [positionSec, setPositionSec] = useState(0);

  // rAF position loop (clock-synced)
  useEffect(() => {
    let raf: number;
    const tick = () => {
      if (rideStartAt) {
        setPositionSec(Math.max(0, (Date.now() + clockOffset - rideStartAt) / 1000));
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [rideStartAt, clockOffset]);

  // Drift correction on sync message (§9)
  useEffect(() => {
    if (syncPositionSec == null) return;
    const actual = getActualPositionSec();
    if (actual != null && Math.abs(actual - syncPositionSec) > 0.25) nudgePlayback(actual - syncPositionSec);
  }, [syncPositionSec]);

  const driver   = riders.find((r) => r.role === 'driver');
  const passenger = riders.find((r) => r.role === 'passenger');
  const youRider = riders.find((r) => r.glyph === identity?.glyph);

  const palette  = getPalette(recipe?.driver.seed, recipe?.passenger.seed);
  const progress = Math.min(1, positionSec / RIDE_DURATION_SEC);
  const rideRoad = (destination?.theme ?? selectedRoad) as RoadId;

  const sceneEngine = new URLSearchParams(window.location.search).get('engine');
  const usePixiScene = sceneEngine === 'pixi';

  return (
    <div
      className="relative h-screen overflow-hidden"
      style={{ background: `linear-gradient(to bottom, ${palette.skyTop}, ${palette.skyBottom})` }}
    >
      {usePixiScene ? (
        <Suspense fallback={<div className="absolute inset-0 bg-[#0b1020]" />}>
          <PixiSceneCanvas
            road={rideRoad}
            positionSec={positionSec}
            driverGlyph={driver?.glyph ?? '▲'}
            driverColor={driver?.color ?? '#F5A623'}
            passengerGlyph={passenger?.glyph ?? '●'}
            passengerColor={passenger?.color ?? '#1FB6C4'}
            driverGestureKind={null}
            passengerGestureKind={null}
            firework={null}
          />
        </Suspense>
      ) : (
        <Suspense fallback={<div className="absolute inset-0 bg-[#0b1020]" />}>
          <PlayCanvasRideScene
            road={rideRoad}
            positionSec={positionSec}
            driverColor={driver?.color ?? '#F5A623'}
            passengerColor={passenger?.color ?? '#1FB6C4'}
          />
        </Suspense>
      )}

      {/* HUD */}
      <div className="pointer-events-none absolute bottom-0 left-0 right-0 flex flex-col items-center gap-3 pb-4 pt-2">
        {/* Progress bar */}
        <div className="h-0.5 w-3/4 rounded-full bg-white/10">
          <div className="h-full rounded-full bg-white/40 transition-all" style={{ width: `${progress * 100}%` }} />
        </div>

        {/* Attribution + role */}
        <div className="flex items-center gap-4">
          {driver && <span className="text-xs" style={{ color: driver.color }}>{driver.glyph} {recipe?.driver.seed}</span>}
          <span className="text-xs text-white/20">×</span>
          {passenger && <span className="text-xs" style={{ color: passenger.color }}>{passenger.glyph} {recipe?.passenger.seed}</span>}
        </div>
        {destination && (
          <p className="max-w-[18rem] truncate text-xs text-white/35">
            {destination.name}, {destination.country}
          </p>
        )}
        {youRider && <p className="text-xs text-white/30">you're the {youRider.role}</p>}

        <a href={location.pathname} className="pointer-events-auto text-xs text-white/20 hover:text-white/40">
          new ride
        </a>
      </div>
    </div>
  );
}
