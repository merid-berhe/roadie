// Scene sandbox — localhost:5173/?scene=1
// No party server needed. Full pixel + camera controls.

import { useState, useEffect, useRef } from 'react';
import RideScene from '../scene/RideScene';
import type { CameraMode } from '../scene/RideScene';
import type { RoadId } from '../scene/scenes';
import type { GestureKind } from '@roadie/shared';

const ROAD_OPTIONS: RoadId[]     = ['desert', 'coast', 'mountain', 'city'];
const GESTURE_OPTIONS: (GestureKind | null)[] = [null, 'wave', 'heart', 'headlights', 'tambourine', 'shaker', 'chime'];
const RIDE_DURATION = 120;

export default function ScenePreview() {
  const [road, setRoad]               = useState<RoadId>('desert');
  const [positionSec, setPositionSec] = useState(0);
  const [playing, setPlaying]         = useState(false);
  const [driverColor, setDriverColor]     = useState('#F5A623');
  const [passengerColor, setPassengerColor] = useState('#1FB6C4');
  const [driverGesture, setDriverGesture]       = useState<GestureKind | null>(null);
  const [passengerGesture, setPassengerGesture] = useState<GestureKind | null>(null);
  const [cameraMode, setCameraMode]   = useState<CameraMode>('interior');
  const [pixelRatio, setPixelRatio]   = useState(0.25);

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
      {/* 3D Scene — dpr controls pixel resolution */}
      <div className="absolute inset-0" style={{ imageRendering: 'pixelated' }}>
        <RideScene
          road={road}
          positionSec={positionSec}
          driverColor={driverColor}
          passengerColor={passengerColor}
          driverGestureKind={driverGesture}
          passengerGestureKind={passengerGesture}
          cameraMode={cameraMode}
          pixelRatio={pixelRatio}
        />
      </div>

      {/* Controls — top bar */}
      <div className="pointer-events-auto absolute left-0 right-0 top-0 flex flex-wrap items-center gap-2 bg-black/75 px-3 py-2 text-xs text-white backdrop-blur-sm">
        <span className="font-bold text-amber-400">scene</span>

        {/* Camera toggle — the main control */}
        <button
          onClick={() => setCameraMode((m) => m === 'interior' ? 'exterior' : 'interior')}
          className="rounded-full px-3 py-1 font-semibold transition"
          style={{ background: cameraMode === 'exterior' ? '#F5A623' : 'rgba(255,255,255,0.15)', color: cameraMode === 'exterior' ? '#000' : '#fff' }}
        >
          {cameraMode === 'interior' ? '🚗 inside' : '🌍 outside'}
        </button>

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
