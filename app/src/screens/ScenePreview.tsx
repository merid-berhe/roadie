// Quick scene preview — open localhost:5173/?scene=1 to skip the full flow.
// Tweak the constants below to test different moods, roads, gestures, colours.

import { useState } from 'react';
import RideScene from '../scene/RideScene';
import type { RoadId } from '../scene/scenes';
import type { GestureKind } from '@roadie/shared';

// ── Edit these to test different states ──────────────────────────────────────
const ROAD: RoadId        = 'desert';
const DRIVER_COLOR        = '#F5A623'; // amber
const PASSENGER_COLOR     = '#1FB6C4'; // teal
const RIDE_DURATION       = 120;
// ────────────────────────────────────────────────────────────────────────────

const GESTURE_OPTIONS: (GestureKind | null)[] = [
  null, 'wave', 'heart', 'headlights', 'tambourine', 'shaker', 'chime',
];

const ROAD_OPTIONS: RoadId[] = ['desert', 'coast', 'mountain', 'city'];

export default function ScenePreview() {
  const [road, setRoad]                 = useState<RoadId>(ROAD);
  const [positionSec, setPositionSec]   = useState(0);
  const [playing, setPlaying]           = useState(false);
  const [driverGesture, setDriverGesture]       = useState<GestureKind | null>(null);
  const [passengerGesture, setPassengerGesture] = useState<GestureKind | null>(null);
  const [driverColor, setDriverColor]     = useState(DRIVER_COLOR);
  const [passengerColor, setPassengerColor] = useState(PASSENGER_COLOR);

  // Simple rAF-based position ticker when playing
  useState(() => {
    let raf: number;
    let last = performance.now();
    const tick = () => {
      const now = performance.now();
      if (playing) setPositionSec((p) => Math.min(p + (now - last) / 1000, RIDE_DURATION));
      last = now;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  });

  return (
    <div className="relative h-screen w-screen bg-black">
      {/* 3D Scene */}
      <RideScene
        road={road}
        positionSec={positionSec}
        driverColor={driverColor}
        passengerColor={passengerColor}
        driverGestureKind={driverGesture}
        passengerGestureKind={passengerGesture}
      />

      {/* Control panel */}
      <div className="pointer-events-auto absolute left-0 right-0 top-0 flex flex-wrap items-center gap-3 bg-black/70 px-4 py-2 text-xs text-white backdrop-blur">
        <span className="font-semibold text-amber-400">Scene Preview</span>

        {/* Road */}
        <span className="text-white/40">road:</span>
        {ROAD_OPTIONS.map((r) => (
          <button key={r} onClick={() => setRoad(r)}
            className={`rounded px-2 py-0.5 ${road === r ? 'bg-amber-400 text-black' : 'bg-white/10'}`}>
            {r}
          </button>
        ))}

        {/* Position */}
        <span className="text-white/40 ml-2">pos:</span>
        <input type="range" min={0} max={RIDE_DURATION} step={1} value={positionSec}
          onChange={(e) => setPositionSec(Number(e.target.value))}
          className="w-28" />
        <span className="w-8 text-white/60">{Math.round(positionSec)}s</span>
        <button onClick={() => setPlaying((p) => !p)}
          className="rounded bg-white/10 px-2 py-0.5">
          {playing ? '⏸' : '▶'}
        </button>
        <button onClick={() => setPositionSec(0)} className="rounded bg-white/10 px-2 py-0.5">↺</button>

        {/* Colours */}
        <span className="text-white/40 ml-2">driver:</span>
        <input type="color" value={driverColor} onChange={(e) => setDriverColor(e.target.value)}
          className="h-5 w-8 cursor-pointer rounded border-0 bg-transparent" />
        <span className="text-white/40">passenger:</span>
        <input type="color" value={passengerColor} onChange={(e) => setPassengerColor(e.target.value)}
          className="h-5 w-8 cursor-pointer rounded border-0 bg-transparent" />

        {/* Gestures */}
        <span className="text-white/40 ml-2">driver gesture:</span>
        <select value={driverGesture ?? 'none'} onChange={(e) => setDriverGesture(e.target.value === 'none' ? null : e.target.value as GestureKind)}
          className="rounded bg-white/10 px-1 py-0.5 text-white">
          {GESTURE_OPTIONS.map((g) => <option key={g ?? 'none'} value={g ?? 'none'}>{g ?? 'none'}</option>)}
        </select>
        <span className="text-white/40">passenger:</span>
        <select value={passengerGesture ?? 'none'} onChange={(e) => setPassengerGesture(e.target.value === 'none' ? null : e.target.value as GestureKind)}
          className="rounded bg-white/10 px-1 py-0.5 text-white">
          {GESTURE_OPTIONS.map((g) => <option key={g ?? 'none'} value={g ?? 'none'}>{g ?? 'none'}</option>)}
        </select>
      </div>
    </div>
  );
}
