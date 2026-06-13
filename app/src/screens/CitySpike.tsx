// v6.5 SPIKE harness — the explorable Hong Kong fidelity test at ?city=1.
import { Suspense, lazy } from 'react';

const DriveCity = lazy(() => import('../scene/DriveCity'));

export default function CitySpike() {
  return (
    <div className="relative h-screen w-screen overflow-hidden bg-sky">
      <Suspense fallback={<div className="absolute inset-0 bg-gradient-to-b from-sky to-cream" />}>
        <DriveCity />
      </Suspense>
      <div className="pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-black/55 px-4 py-2 text-sm text-white">
        arrow keys / WASD to drive · the glowing beacon = where this city's songs would play
      </div>
    </div>
  );
}
