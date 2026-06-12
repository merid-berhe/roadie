import { Suspense, lazy, useEffect, useRef, useState } from 'react';
import { getPalette } from '../scene/palette';
import type { RoadId } from '../scene/scenes';
import { getActualPositionSec, getTrackDurationSec, nudgePlayback } from '../audio/player';
import { characterName } from '../components/CharacterFace';
import { useRoom } from '../state/room';
import { useSession } from '../state/session';

const FALLBACK_DURATION_SEC = 120;
const FINALE_SEC = 12; // the last stretch of the song: pull over, get out, celebrate
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
  const trackDurationSec = useRoom((s) => s.trackDurationSec);
  const send = useRoom((s) => s.send);

  const [positionSec, setPositionSec] = useState(0);

  // rAF position loop — the AUDIO is the truth (drift-corrected against the
  // server, identical on both clients); wall-clock+offset is only the fallback
  // before playback starts (v5.5: progress bars were diverging across clients)
  useEffect(() => {
    let raf: number;
    const tick = () => {
      const audioPos = getActualPositionSec();
      if (audioPos != null) {
        setPositionSec(Math.max(0, audioPos));
      } else if (rideStartAt) {
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

  // v5.8: report the decoded track's REAL duration once — the room re-times
  // arrival so the ride ends with the song, not a hard-coded 120s
  const durationSentRef = useRef(false);
  useEffect(() => {
    const iv = setInterval(() => {
      if (durationSentRef.current) { clearInterval(iv); return; }
      const dur = getTrackDurationSec();
      if (dur != null) {
        durationSentRef.current = true;
        send({ t: 'trackDuration', sec: Math.round(dur * 10) / 10 });
        clearInterval(iv);
      }
    }, 500);
    return () => clearInterval(iv);
  }, [send]);

  const driver   = riders.find((r) => r.role === 'driver');
  const passenger = riders.find((r) => r.role === 'passenger');
  const youRider = riders.find((r) => r.glyph === identity?.glyph);

  // v5.6: mood words are gone — the destination theme drives the palette
  const themeWord = ({ desert: 'golden-hour', coast: 'wide-open', mountain: 'rainy', city: 'midnight' } as Record<string, string>)[
    (destination?.theme ?? selectedRoad) as string
  ];
  const palette  = getPalette(themeWord, themeWord);
  const rideDuration = trackDurationSec ?? getTrackDurationSec() ?? FALLBACK_DURATION_SEC;
  const progress = Math.min(1, positionSec / rideDuration);
  const finaleStartSec = Math.max(10, rideDuration - FINALE_SEC);
  const inFinale = positionSec >= finaleStartSec;
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
            driverCharacter={driver?.character}
            passengerCharacter={passenger?.character}
            finaleStartSec={finaleStartSec}
          />
        </Suspense>
      )}

      {/* §5c finale caption */}
      {inFinale && (
        <p className="pointer-events-none absolute left-0 right-0 top-8 text-center text-sm text-white/75">
          🏁 you made it — that's your song
        </p>
      )}

      {/* HUD */}
      <div className="pointer-events-none absolute bottom-0 left-0 right-0 flex flex-col items-center gap-3 pb-4 pt-2">
        {/* Progress bar */}
        <div className="h-0.5 w-3/4 rounded-full bg-white/10">
          <div className="h-full rounded-full bg-white/40 transition-all" style={{ width: `${progress * 100}%` }} />
        </div>

        {/* Attribution + role */}
        <div className="flex items-center gap-4">
          {driver && <span className="text-xs" style={{ color: driver.color }}>{characterName(driver.character) ?? driver.glyph} · {recipe?.driver.instrument}</span>}
          <span className="text-xs text-white/20">×</span>
          {passenger && <span className="text-xs" style={{ color: passenger.color }}>{characterName(passenger.character) ?? passenger.glyph} · {recipe?.passenger.instrument}</span>}
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
