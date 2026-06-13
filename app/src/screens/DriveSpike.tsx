// v6.4 SPIKE harness — renders the winding-loop DriveWorld full-screen at
// ?drive=1 so we can judge the "game world" feel before wiring it into the ride.
import { Suspense, lazy } from 'react';

const DriveWorld = lazy(() => import('../scene/DriveWorld'));

export default function DriveSpike() {
  return (
    <div className="relative h-screen w-screen overflow-hidden bg-sky">
      <Suspense fallback={<div className="absolute inset-0 bg-gradient-to-b from-sky to-cream" />}>
        <DriveWorld />
      </Suspense>
    </div>
  );
}
