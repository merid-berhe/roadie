import { Suspense, lazy, useEffect, useRef, useState } from 'react';
import type { GestureKind } from '@roadie/shared';
import { getPalette } from '../scene/palette';
import type { RoadId } from '../scene/scenes';
import { getActualPositionSec, nudgePlayback } from '../audio/player';
import { isBeatSound, playFireworkAccent, playGestureSound } from '../audio/gestures';
import { useRoom } from '../state/room';
import { useSession } from '../state/session';

const RIDE_DURATION_SEC = 120;
const FIREWORK_THRESHOLD = RIDE_DURATION_SEC * 0.8; // show firework button at 80%
const PixiSceneCanvas = lazy(() => import('../scene/SceneCanvas'));
const PlayCanvasRideScene = lazy(() => import('../scene/PlayCanvasRideScene'));

// Warm reactions (visual) | Beat-locked sounds (audio) — §8
const WARM: { kind: GestureKind; label: string }[] = [
  { kind: 'wave',       label: '👋' },
  { kind: 'headlights', label: '✦'  },
  { kind: 'heart',      label: '♥'  },
];
const SOUNDS: { kind: GestureKind; label: string }[] = [
  { kind: 'tambourine', label: '♪' },
  { kind: 'shaker',     label: '≈' },
  { kind: 'chime',      label: '♫' },
];

export default function Riding() {
  const identity = useSession((s) => s.identity);
  const riders    = useRoom((s) => s.riders);
  const recipe    = useRoom((s) => s.recipe);
  const rideStartAt   = useRoom((s) => s.rideStartAt);
  const clockOffset   = useRoom((s) => s.clockOffset);
  const syncPositionSec = useRoom((s) => s.syncPositionSec);
  const selectedRoad    = useRoom((s) => s.selectedRoad) as RoadId;
  const destination     = useRoom((s) => s.destination);
  const peerGestureKind = useRoom((s) => s.peerGestureKind);
  const peerGestureAt   = useRoom((s) => s.peerGestureAt);
  const fireworkSynced  = useRoom((s) => s.fireworkSynced);
  const fireworkAt      = useRoom((s) => s.fireworkAt);
  const send = useRoom((s) => s.send);

  const [positionSec, setPositionSec] = useState(0);
  const [ownGestureKind, setOwnGestureKind] = useState<GestureKind | null>(null);
  const [fireworkTrigger, setFireworkTrigger] = useState<{ synced: boolean } | null>(null);

  const lastGestureSentRef = useRef(0);
  const ownGestureTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fireworkSentRef    = useRef(false);
  const prevPeerGestureAt  = useRef(0);
  const prevFireworkAt     = useRef(0);

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

  // Peer gesture display — clear after 1.5s
  useEffect(() => {
    if (peerGestureAt <= prevPeerGestureAt.current) return;
    prevPeerGestureAt.current = peerGestureAt;
  }, [peerGestureKind, peerGestureAt]);

  // Firework reaction — audio accent for server-confirmed synced blooms
  useEffect(() => {
    if (fireworkAt <= prevFireworkAt.current || fireworkSynced == null) return;
    prevFireworkAt.current = fireworkAt;
    setFireworkTrigger({ synced: fireworkSynced });
    if (fireworkSynced) playFireworkAccent();
    setTimeout(() => setFireworkTrigger(null), 100);
  }, [fireworkSynced, fireworkAt]);

  function sendGesture(kind: GestureKind) {
    const now = Date.now();
    if (now - lastGestureSentRef.current < 1000) return; // client-side rate limit
    lastGestureSentRef.current = now;
    send({ t: 'gesture', kind });
    // Own gesture display
    setOwnGestureKind(kind);
    if (ownGestureTimerRef.current) clearTimeout(ownGestureTimerRef.current);
    ownGestureTimerRef.current = setTimeout(() => setOwnGestureKind(null), 1500);
    // Beat-locked sound for sound gestures
    if (isBeatSound(kind)) playGestureSound(kind);
  }

  function sendFirework() {
    if (fireworkSentRef.current) return;
    fireworkSentRef.current = true;
    send({ t: 'firework' });
  }

  const you      = useRoom((s) => s.you);
  const driver   = riders.find((r) => r.role === 'driver');
  const passenger = riders.find((r) => r.role === 'passenger');
  const youRider = riders.find((r) => r.glyph === identity?.glyph);

  const palette  = getPalette(recipe?.driver.seed, recipe?.passenger.seed);
  const progress = Math.min(1, positionSec / RIDE_DURATION_SEC);
  const rideRoad = (destination?.theme ?? selectedRoad) as RoadId;

  const driverGestureKind    = you === 'driver' ? ownGestureKind : peerGestureKind;
  const passengerGestureKind = you === 'passenger' ? ownGestureKind : peerGestureKind;

  const showFireworkBtn = positionSec >= FIREWORK_THRESHOLD && !fireworkSentRef.current;
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
            driverGestureKind={driverGestureKind}
            passengerGestureKind={passengerGestureKind}
            firework={fireworkTrigger}
          />
        </Suspense>
      ) : (
        <Suspense fallback={<div className="absolute inset-0 bg-[#0b1020]" />}>
          <PlayCanvasRideScene
            road={rideRoad}
            positionSec={positionSec}
            driverColor={driver?.color ?? '#F5A623'}
            passengerColor={passenger?.color ?? '#1FB6C4'}
            driverGestureKind={driverGestureKind}
            passengerGestureKind={passengerGestureKind}
            firework={fireworkTrigger}
          />
        </Suspense>
      )}

      {/* HUD */}
      <div className="pointer-events-none absolute bottom-0 left-0 right-0 flex flex-col items-center gap-3 pb-4 pt-2">

        {/* Firework button */}
        {showFireworkBtn && (
          <button
            onClick={sendFirework}
            className="pointer-events-auto animate-pulse rounded-full bg-amber-400 px-8 py-3 font-semibold text-black shadow-lg"
          >
            🎆 launch
          </button>
        )}

        {/* Gesture row */}
        <div className="pointer-events-auto flex gap-2">
          {[...WARM, ...SOUNDS].map(({ kind, label }) => (
            <button
              key={kind}
              onClick={() => sendGesture(kind)}
              className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-xl active:scale-90"
            >
              {label}
            </button>
          ))}
        </div>

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
