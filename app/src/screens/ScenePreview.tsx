// Scene sandbox — localhost:5173/?scene=1
// No party server needed. Full pixel + camera controls.

import { useState, useEffect, useRef } from 'react';
import RideScene from '../scene/RideScene';
import type { CameraMode } from '../scene/RideScene';
import PlayCanvasRideScene from '../scene/PlayCanvasRideScene';
import ParisTiles, { PARIS_TILE_ANCHORS, type ParisAnchorId } from '../scene/ParisTiles';
import type { RoadId } from '../scene/scenes';
import type { DanceMove, GestureKind } from '@roadie/shared';

const ROAD_OPTIONS: RoadId[]     = ['desert', 'coast', 'mountain', 'city'];
const GESTURE_OPTIONS: (GestureKind | null)[] = [null, 'wave', 'heart', 'headlights', 'tambourine', 'shaker', 'chime'];
const PARIS_ANCHOR_OPTIONS = Object.keys(PARIS_TILE_ANCHORS) as ParisAnchorId[];
const RIDE_DURATION = 120;

type PreviewEngine = 'playcanvas' | 'r3f';

const initialParams = new URLSearchParams(window.location.search);
const initialRoad = (ROAD_OPTIONS as string[]).includes(initialParams.get('road') ?? '')
  ? (initialParams.get('road') as RoadId)
  : 'desert';
const initialT = Number(initialParams.get('t') ?? 0) || 0;
const initialEngine: PreviewEngine = initialParams.get('engine') === 'r3f' ? 'r3f' : 'playcanvas';
const initialGesture = (GESTURE_OPTIONS as (string | null)[]).includes(initialParams.get('gesture'))
  ? (initialParams.get('gesture') as GestureKind)
  : null;
// §8d meeting preview: ?meeting=1&dance=bounce (both figures loop the move)
// v5.4 character preview: ?dc=moss&pc=vex
const initialMeeting = initialParams.has('meeting');
const initialDanceMove = initialParams.get('dance');
const initialDriverChar = initialParams.get('dc') ?? 'moss';
const initialPassengerChar = initialParams.get('pc') ?? 'juno';
// §5c finale preview: ?finale=5&t=12 → world stopped, pair out celebrating
const initialFinaleStart = initialParams.has('finale') ? Number(initialParams.get('finale')) || 8 : null;

export default function ScenePreview() {
  const [road, setRoad]               = useState<RoadId>(initialRoad);
  const [engine, setEngine]           = useState<PreviewEngine>(initialEngine);
  const [firework, setFirework]       = useState<{ synced: boolean } | null>(null);
  const [positionSec, setPositionSec] = useState(initialT);
  const [playing, setPlaying]         = useState(false);
  const [driverColor, setDriverColor]     = useState('#F5A623');
  const [passengerColor, setPassengerColor] = useState('#1FB6C4');
  const [driverGesture, setDriverGesture]       = useState<GestureKind | null>(initialGesture);
  const [passengerGesture, setPassengerGesture] = useState<GestureKind | null>(null);

  // ?fw=synced|solo — auto-fire a firework shortly after mount (headless screenshot hook)
  useEffect(() => {
    const fw = initialParams.get('fw');
    if (!fw) return;
    const id = setTimeout(() => setFirework({ synced: fw === 'synced' }), 3000);
    return () => clearTimeout(id);
  }, []);

  // ?dance=bounce — both preview figures loop the move (headless screenshot hook)
  const [previewDance, setPreviewDance] = useState<{ move: DanceMove; at: number } | null>(null);
  useEffect(() => {
    if (!initialMeeting || !initialDanceMove) return;
    const fire = () => setPreviewDance({ move: initialDanceMove as DanceMove, at: Date.now() });
    fire();
    const iv = setInterval(fire, 4000); // > CLIP_DANCE_SEC so idle recovery is observable
    return () => clearInterval(iv);
  }, []);
  const [cameraMode, setCameraMode]   = useState<CameraMode>('interior');
  const [pixelRatio, setPixelRatio]   = useState(0.25);
  const [useGoogleMaps, setUseGoogleMaps] = useState(false);
  const [googleAnchorId, setGoogleAnchorId] = useState<ParisAnchorId>('champs-elysees');
  const [googleHeadingDeg, setGoogleHeadingDeg] = useState(PARIS_TILE_ANCHORS['champs-elysees'].headingDeg);
  const [googleLiftM, setGoogleLiftM] = useState(0.65);

  function chooseParisAnchor(anchorId: ParisAnchorId) {
    setGoogleAnchorId(anchorId);
    setGoogleHeadingDeg(PARIS_TILE_ANCHORS[anchorId].headingDeg);
    setPositionSec(0);
    setPlaying(false);
  }

  // rAF ticker
  const lastRef = useRef(performance.now());
  useEffect(() => {
    let raf: number;
    const tick = () => {
      const now = performance.now();
      if (playing) setPositionSec((p) => Math.min(p + (now - lastRef.current) / 1000, RIDE_DURATION));
      lastRef.current = now;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing]);

  return (
    <div className="relative h-screen w-screen bg-black overflow-hidden">
      {/* 3D Scene */}
      <div className="absolute inset-0" style={{ imageRendering: pixelRatio < 0.8 && !useGoogleMaps ? 'pixelated' : 'auto' }}>
        {useGoogleMaps
          ? <ParisTiles
              anchorId={googleAnchorId}
              positionSec={positionSec}
              rideDuration={RIDE_DURATION}
              headingDeg={googleHeadingDeg}
              liftM={googleLiftM}
              pixelRatio={pixelRatio}
            />
          : engine === 'playcanvas'
          ? <PlayCanvasRideScene
              key={road}
              road={road}
              positionSec={positionSec}
              driverColor={driverColor}
              passengerColor={passengerColor}
              driverGestureKind={driverGesture}
              passengerGestureKind={passengerGesture}
              firework={firework}
              driverCharacter={initialDriverChar}
              passengerCharacter={initialPassengerChar}
              mode={initialMeeting ? 'meeting' : 'ride'}
              driverDance={previewDance}
              passengerDance={previewDance}
              finaleStartSec={initialFinaleStart}
            />
          : <RideScene
              road={road}
              positionSec={positionSec}
              driverColor={driverColor}
              passengerColor={passengerColor}
              driverGestureKind={driverGesture}
              passengerGestureKind={passengerGesture}
              cameraMode={cameraMode}
              pixelRatio={pixelRatio}
            />
        }
      </div>

      {/* Controls — top bar */}
      <div className="pointer-events-auto absolute left-0 right-0 top-0 flex flex-wrap items-center gap-2 bg-black/75 px-3 py-2 text-xs text-white backdrop-blur-sm">
        <span className="font-bold text-amber-400">scene</span>

        {/* Google Maps toggle */}
        <button
          onClick={() => setUseGoogleMaps((g) => !g)}
          className="rounded-full px-3 py-1 font-semibold transition"
          style={{ background: useGoogleMaps ? '#4285F4' : 'rgba(255,255,255,0.12)', color: useGoogleMaps ? '#fff' : '#aaa' }}
        >
          {useGoogleMaps ? '🗺 Paris' : '🚗 car'}
        </button>

        {/* Engine toggle */}
        {!useGoogleMaps && (
          <button
            onClick={() => setEngine((e) => e === 'playcanvas' ? 'r3f' : 'playcanvas')}
            className="rounded-full px-3 py-1 font-semibold transition"
            style={{ background: engine === 'playcanvas' ? '#e2643b' : 'rgba(255,255,255,0.15)', color: '#fff' }}
          >
            {engine === 'playcanvas' ? 'playcanvas' : 'r3f'}
          </button>
        )}

        {/* Firework test (playcanvas) */}
        {!useGoogleMaps && engine === 'playcanvas' && (
          <>
            <button onClick={() => setFirework({ synced: false })} className="rounded bg-white/10 px-2 py-0.5">🎆</button>
            <button onClick={() => setFirework({ synced: true })} className="rounded bg-white/10 px-2 py-0.5">🎆🎆</button>
          </>
        )}

        {/* Camera toggle — r3f only */}
        {!useGoogleMaps && engine === 'r3f' && (
          <button
            onClick={() => setCameraMode((m) => m === 'interior' ? 'exterior' : 'interior')}
            className="rounded-full px-3 py-1 font-semibold transition"
            style={{ background: cameraMode === 'exterior' ? '#F5A623' : 'rgba(255,255,255,0.15)', color: cameraMode === 'exterior' ? '#000' : '#fff' }}
          >
            {cameraMode === 'interior' ? '🚗 inside' : '🌍 outside'}
          </button>
        )}

        {/* Pixel size */}
        <span className="text-white/40 ml-1">pixels:</span>
        {[0.1, 0.2, 0.35, 0.5, 1.0].map((r) => (
          <button key={r} onClick={() => setPixelRatio(r)}
            className={`rounded px-2 py-0.5 ${pixelRatio === r ? 'bg-amber-400 text-black' : 'bg-white/10'}`}>
            {r === 1.0 ? 'HD' : `${Math.round(r * 100)}%`}
          </button>
        ))}

        {/* Road */}
        <span className="text-white/40 ml-1">road:</span>
        {ROAD_OPTIONS.map((r) => (
          <button key={r} onClick={() => setRoad(r)}
            className={`rounded px-2 py-0.5 ${road === r ? 'bg-white/30' : 'bg-white/10'}`}>
            {r}
          </button>
        ))}

        {useGoogleMaps && (
          <>
            <span className="text-white/40 ml-1">place:</span>
            <select
              value={googleAnchorId}
              onChange={(e) => chooseParisAnchor(e.target.value as ParisAnchorId)}
              className="rounded bg-white/10 px-1 py-0.5 text-white"
            >
              {PARIS_ANCHOR_OPTIONS.map((anchorId) => (
                <option key={anchorId} value={anchorId}>{PARIS_TILE_ANCHORS[anchorId].label}</option>
              ))}
            </select>
            <span className="text-white/40 ml-1">heading:</span>
            <input type="range" min={0} max={359} step={1} value={googleHeadingDeg}
              onChange={(e) => setGoogleHeadingDeg(Number(e.target.value))} className="w-24" />
            <span className="w-8 text-white/50">{Math.round(googleHeadingDeg)}°</span>
            <span className="text-white/40 ml-1">lift:</span>
            <input type="range" min={-1} max={3} step={0.05} value={googleLiftM}
              onChange={(e) => setGoogleLiftM(Number(e.target.value))} className="w-20" />
            <span className="w-9 text-white/50">{googleLiftM.toFixed(2)}m</span>
          </>
        )}

        {/* Playback */}
        <span className="text-white/40 ml-1">pos:</span>
        <input type="range" min={0} max={RIDE_DURATION} step={0.5} value={positionSec}
          onChange={(e) => setPositionSec(Number(e.target.value))} className="w-24" />
        <span className="w-7 text-white/50">{Math.round(positionSec)}s</span>
        <button onClick={() => setPlaying((p) => !p)} className="rounded bg-white/10 px-2 py-0.5">{playing ? '⏸' : '▶'}</button>
        <button onClick={() => { setPositionSec(0); setPlaying(false); }} className="rounded bg-white/10 px-2 py-0.5">↺</button>

        {/* Colours */}
        <span className="text-white/40 ml-1">🚗</span>
        <input type="color" value={driverColor} onChange={(e) => setDriverColor(e.target.value)} className="h-5 w-7 cursor-pointer rounded border-0 bg-transparent" />
        <input type="color" value={passengerColor} onChange={(e) => setPassengerColor(e.target.value)} className="h-5 w-7 cursor-pointer rounded border-0 bg-transparent" />

        {/* Gestures */}
        <span className="text-white/40 ml-1">gesture:</span>
        <select value={driverGesture ?? 'none'} onChange={(e) => setDriverGesture(e.target.value === 'none' ? null : e.target.value as GestureKind)}
          className="rounded bg-white/10 px-1 py-0.5 text-white">
          {GESTURE_OPTIONS.map((g) => <option key={g ?? 'none'} value={g ?? 'none'}>{g ?? 'none'}</option>)}
        </select>
        <select value={passengerGesture ?? 'none'} onChange={(e) => setPassengerGesture(e.target.value === 'none' ? null : e.target.value as GestureKind)}
          className="rounded bg-white/10 px-1 py-0.5 text-white">
          {GESTURE_OPTIONS.map((g) => <option key={g ?? 'none'} value={g ?? 'none'}>{g ?? 'none'}</option>)}
        </select>

        <a href="?inspect=1" className="ml-auto rounded bg-white/10 px-2 py-0.5 text-white/40 hover:text-white">inspector →</a>
      </div>

      {/* Exterior hint */}
      {cameraMode === 'exterior' && (
        <div className="pointer-events-none absolute bottom-8 left-1/2 -translate-x-1/2 rounded-full bg-black/50 px-4 py-1 text-xs text-white/50">
          drag to orbit · scroll to zoom
        </div>
      )}
    </div>
  );
}
