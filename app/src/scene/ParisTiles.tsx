// Google Photorealistic 3D Tiles — Paris proof of concept.
// GlobeControls for Earth-scale navigation, locked to Paris area.

import { useRef } from 'react';
import { Canvas } from '@react-three/fiber';
// @ts-ignore
import { TilesRenderer, TilesPlugin, GlobeControls } from '3d-tiles-renderer/r3f';
import { GoogleCloudAuthPlugin } from '3d-tiles-renderer/plugins';

// ECEF position above Notre Dame at ~300m altitude (good starting view of Paris)
const R_SURFACE = 6_371_381; // Earth radius + ~380m at Paris lat (terrain ~81m + 300m)
const LAT = 48.853 * Math.PI / 180;
const LON = 2.350  * Math.PI / 180;

const PARIS_300M: [number, number, number] = [
  R_SURFACE * Math.cos(LAT) * Math.cos(LON),
  R_SURFACE * Math.cos(LAT) * Math.sin(LON),
  R_SURFACE * Math.sin(LAT),
];

// Distance from Earth center — used to lock zoom range
// Paris surface ≈ 6,371,081m from center (terrain ~81m above ellipsoid)
const EARTH_R_PARIS  = 6_371_081;
const MIN_DIST       = EARTH_R_PARIS + 3;     // 3m above ground — street level
const MAX_DIST       = EARTH_R_PARIS + 1_000; // 1km max — neighbourhood scale

type Props = { positionSec: number; rideDuration?: number };

export default function ParisTiles({ positionSec: _positionSec }: Props) {
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_KEY as string | undefined;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const controlsRef = useRef<any>(null);

  if (!apiKey) {
    return (
      <div className="flex h-full items-center justify-center bg-[#0a0d1a] text-sm text-white/60">
        <div className="space-y-2 text-center">
          <p className="text-lg font-semibold text-white">Google Maps key needed</p>
          <code className="block rounded bg-white/10 px-3 py-2 text-xs text-amber-300">
            VITE_GOOGLE_MAPS_KEY=your_key — app/.env.local
          </code>
        </div>
      </div>
    );
  }

  function nudge(delta: number) {
    // Zoom in/out by adjusting camera distance from Earth center
    if (!controlsRef.current) return;
    const ctrl = controlsRef.current;
    ctrl.zoomDelta?.(delta);
  }

  return (
    <div className="absolute inset-0">
      <Canvas
        camera={{ position: PARIS_300M, fov: 70, near: 1, far: 1e8 }}
        onCreated={({ camera }) => { camera.lookAt(0, 0, 0); }}
        gl={{ antialias: true, logarithmicDepthBuffer: true }}
        style={{ position: 'absolute', inset: 0 }}
      >
        <ambientLight intensity={3} />
        <directionalLight position={[1, 2, 1]} intensity={2} />

        <TilesRenderer errorTarget={2} maxCachedBytes={300 * 1024 * 1024}>
          <TilesPlugin plugin={GoogleCloudAuthPlugin} args={[{ apiToken: apiKey }] as any} />
          <GlobeControls
            ref={controlsRef}
            enableDamping
            zoomSpeed={3}
            minDistance={MIN_DIST}
            maxDistance={MAX_DIST}
          />
        </TilesRenderer>
      </Canvas>

      {/* Navigation overlay */}
      <div className="pointer-events-auto absolute right-4 top-1/2 flex -translate-y-1/2 flex-col gap-2">
        <button
          onClick={() => nudge(-50)}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-black/60 text-lg text-white hover:bg-black/80"
          title="Zoom in"
        >+</button>
        <button
          onClick={() => nudge(50)}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-black/60 text-lg text-white hover:bg-black/80"
          title="Zoom out"
        >−</button>
      </div>

      <div className="pointer-events-none absolute bottom-8 left-1/2 -translate-x-1/2 rounded-full bg-black/50 px-4 py-1 text-xs text-white/50">
        scroll to zoom · drag to look · locked to Paris neighbourhood
      </div>
    </div>
  );
}
