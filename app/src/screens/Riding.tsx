import { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react';
import {
  buildRideSchedule,
  CATCH_WINDOW_SEC,
  FLASH_WINDOW_SEC,
  RIFF_ANSWER_SEC,
  RIFF_CALL_SEC,
  RIFF_TAPS,
  type GestureKind,
} from '@roadie/shared';
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
  // §5b ride performance layer
  const rideSeed       = useRoom((s) => s.rideSeed);
  const relayedLane    = useRoom((s) => s.carLane);
  const serverCaught   = useRoom((s) => s.caughtIds);
  const lastCatch      = useRoom((s) => s.lastCatch);
  const peerRiffTap    = useRoom((s) => s.peerRiffTap);
  const riffLandedIdx  = useRoom((s) => s.riffLandedIdx);
  const landmarksLit   = useRoom((s) => s.landmarksLit);
  const lastLandmarkLit = useRoom((s) => s.lastLandmarkLit);

  const [positionSec, setPositionSec] = useState(0);
  const [ownGestureKind, setOwnGestureKind] = useState<GestureKind | null>(null);
  const [fireworkTrigger, setFireworkTrigger] = useState<{ synced: boolean } | null>(null);
  const [ownLane, setOwnLane] = useState(1);
  const [localCaught, setLocalCaught] = useState<number[]>([]);
  const [riffTapCounts, setRiffTapCounts] = useState<Record<number, number>>({});
  const [flashedIdx, setFlashedIdx] = useState<number[]>([]);
  const [riffBloomAt, setRiffBloomAt] = useState(0);
  const [toast, setToast] = useState<string | null>(null);

  const lastGestureSentRef = useRef(0);
  const ownGestureTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fireworkSentRef    = useRef(false);
  const prevPeerGestureAt  = useRef(0);
  const prevFireworkAt     = useRef(0);
  const playedCatchIds     = useRef(new Set<number>());
  const prevPeerRiffTapAt  = useRef(0);
  const prevRiffLandedAt   = useRef(0);
  const prevLandmarkLitAt  = useRef(0);
  const toastTimerRef      = useRef<ReturnType<typeof setTimeout> | null>(null);

  const schedule = useMemo(() => (rideSeed != null ? buildRideSchedule(rideSeed) : null), [rideSeed]);
  const you = useRoom((s) => s.you);
  const effectiveLane = you === 'driver' ? ownLane : relayedLane;
  const [landedRiffs, setLandedRiffs] = useState<number[]>([]);

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

  // --- §5b ride performance reactions ---

  // a catch landed (either rider's screen) — play the ornament once
  useEffect(() => {
    if (!lastCatch) return;
    if (playedCatchIds.current.has(lastCatch.id)) return;
    playedCatchIds.current.add(lastCatch.id);
    playGestureSound('chime');
  }, [lastCatch]);

  // peer riff taps — hear their instrument
  useEffect(() => {
    if (!peerRiffTap || peerRiffTap.at <= prevPeerRiffTapAt.current || !schedule) return;
    prevPeerRiffTapAt.current = peerRiffTap.at;
    const riff = schedule.riffs.find((r) => r.idx === peerRiffTap.idx);
    playGestureSound(riff && peerRiffTap.role === riff.caller ? 'tambourine' : 'chime');
  }, [peerRiffTap, schedule]);

  // riff landed — accent + bloom over the car
  useEffect(() => {
    if (!riffLandedIdx || riffLandedIdx.at <= prevRiffLandedAt.current) return;
    prevRiffLandedAt.current = riffLandedIdx.at;
    setLandedRiffs((prev) => [...prev, riffLandedIdx.idx]);
    playFireworkAccent();
    setRiffBloomAt(Date.now());
    showToast('🎶 your riff landed — it’s in the song');
  }, [riffLandedIdx]);

  // landmark lit together
  useEffect(() => {
    if (!lastLandmarkLit || lastLandmarkLit.at <= prevLandmarkLitAt.current) return;
    prevLandmarkLitAt.current = lastLandmarkLit.at;
    playFireworkAccent();
    showToast(`✨ you lit it up together`);
  }, [lastLandmarkLit]);

  function showToast(text: string) {
    setToast(text);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToast(null), 3000);
  }

  function setLane(lane: number) {
    setOwnLane(lane);
    send({ t: 'lane', lane });
  }

  function tryCatch() {
    if (!schedule) return;
    const lane = effectiveLane;
    const note = schedule.notes.find(
      (n) =>
        !serverCaught.includes(n.id) &&
        !localCaught.includes(n.id) &&
        n.lane === lane &&
        Math.abs(n.atSec - positionSec) <= CATCH_WINDOW_SEC,
    );
    if (!note) return; // nothing in reach — no fail state, the button just doesn't fire
    setLocalCaught((prev) => [...prev, note.id]);
    playedCatchIds.current.add(note.id);
    playGestureSound('chime'); // optimistic — gestures may be optimistic per §3
    send({ t: 'catch', id: note.id });
  }

  function tapRiff(idx: number) {
    const count = riffTapCounts[idx] ?? 0;
    if (count >= RIFF_TAPS || !schedule) return;
    setRiffTapCounts((prev) => ({ ...prev, [idx]: count + 1 }));
    const riff = schedule.riffs.find((r) => r.idx === idx);
    playGestureSound(riff && you === riff.caller ? 'tambourine' : 'chime');
    send({ t: 'riffTap', idx });
  }

  function flashLandmark(idx: number) {
    if (flashedIdx.includes(idx)) return;
    setFlashedIdx((prev) => [...prev, idx]);
    send({ t: 'flash', idx });
  }

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

  // §5b: what's actionable right now
  const allCaught = [...serverCaught, ...localCaught];
  const catchableNote = schedule?.notes.find(
    (n) => !allCaught.includes(n.id) && n.lane === effectiveLane && Math.abs(n.atSec - positionSec) <= CATCH_WINDOW_SEC,
  );
  const activeRiff = schedule?.riffs.find((r) => {
    if (landedRiffs.includes(r.idx)) return false;
    const winEnd = r.atSec + (you === r.caller ? RIFF_CALL_SEC : RIFF_ANSWER_SEC);
    return positionSec >= r.atSec && positionSec <= winEnd;
  });
  const activeLandmark = schedule?.landmarks.find(
    (l) => !landmarksLit.includes(l.idx) && Math.abs(l.atSec - positionSec) <= FLASH_WINDOW_SEC,
  );
  const ownRiffTaps = activeRiff ? (riffTapCounts[activeRiff.idx] ?? 0) : 0;

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
            rideSeed={rideSeed}
            carLane={effectiveLane}
            caughtIds={allCaught}
            lastCatch={lastCatch}
            riffBloomAt={riffBloomAt}
            landmarksLit={landmarksLit}
          />
        </Suspense>
      )}

      {/* §5b prompts — above the HUD */}
      <div className="pointer-events-none absolute bottom-36 left-0 right-0 flex flex-col items-center gap-2 px-5">
        {toast && (
          <p className="rounded-full bg-black/50 px-4 py-1.5 text-sm text-white/90">{toast}</p>
        )}
        {activeRiff && (
          <div className="pointer-events-auto flex items-center gap-3 rounded-full bg-black/55 px-4 py-2">
            <span className="text-sm text-white/85">
              {you === activeRiff.caller ? '🎶 your riff — tap it!' : '🎶 answer the riff!'}
            </span>
            <button
              onClick={() => tapRiff(activeRiff.idx)}
              disabled={ownRiffTaps >= RIFF_TAPS}
              className="rounded-full bg-amber-400 px-4 py-1.5 font-semibold text-black active:scale-90 disabled:opacity-50"
            >
              {ownRiffTaps >= RIFF_TAPS ? 'sent ✓' : `♪ ${ownRiffTaps}/${RIFF_TAPS}`}
            </button>
          </div>
        )}
        {activeLandmark && (
          <button
            onClick={() => flashLandmark(activeLandmark.idx)}
            disabled={flashedIdx.includes(activeLandmark.idx)}
            className="pointer-events-auto animate-pulse rounded-full bg-white/90 px-5 py-2 font-semibold text-black active:scale-90 disabled:opacity-60"
          >
            {flashedIdx.includes(activeLandmark.idx) ? '✦ flashed — waiting for co-rider…' : '✦ flash your lights!'}
          </button>
        )}
      </div>

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

        {/* §5b role verb + gesture row */}
        <div className="pointer-events-auto flex items-center gap-2">
          {you === 'driver' && schedule && (
            <>
              <button
                onClick={() => setLane(0)}
                className="flex h-11 w-11 items-center justify-center rounded-full text-xl active:scale-90"
                style={{ background: effectiveLane === 0 ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.1)' }}
              >
                ◁
              </button>
              <button
                onClick={() => setLane(1)}
                className="flex h-11 w-11 items-center justify-center rounded-full text-xl active:scale-90"
                style={{ background: effectiveLane === 1 ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.1)' }}
              >
                ▷
              </button>
            </>
          )}
          {you === 'passenger' && schedule && (
            <button
              onClick={tryCatch}
              className={`flex h-12 items-center justify-center rounded-full px-4 text-sm font-semibold active:scale-90 ${
                catchableNote ? 'animate-pulse bg-amber-400 text-black' : 'bg-white/10 text-white/60'
              }`}
            >
              ✨ catch
            </button>
          )}
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
