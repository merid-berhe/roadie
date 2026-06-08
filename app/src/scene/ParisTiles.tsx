// Google Photorealistic 3D Tiles — Paris proof of concept.
// Uses GlobeControls for proper Earth navigation (zoom from orbit to street level).
// Requires VITE_GOOGLE_MAPS_KEY in app/.env.local with Map Tiles API enabled.

import { Canvas } from '@react-three/fiber';
// @ts-ignore
import { TilesRenderer, TilesPlugin, GlobeControls } from '3d-tiles-renderer/r3f';
import { GoogleCloudAuthPlugin } from '3d-tiles-renderer/plugins';

// Paris ECEF coordinates (Earth-Centered, Earth-Fixed) at ~5km altitude above Notre Dame
// ECEF for 48.853°N, 2.350°E, altitude 5000m above surface:
// X = (R+h)*cos(lat)*cos(lon), Y = (R+h)*cos(lat)*sin(lon), Z = (R+h)*sin(lat)
// R = 6,371,000m, h = 5,000m
const R = 6_376_000;
const LAT = 48.853 * Math.PI / 180;
const LON = 2.350  * Math.PI / 180;
const PARIS_CAMERA = [
  R * Math.cos(LAT) * Math.cos(LON),
  R * Math.cos(LAT) * Math.sin(LON),
  R * Math.sin(LAT),
] as [number, number, number];

type Props = { positionSec: number; rideDuration?: number };

export default function ParisTiles({ positionSec: _positionSec }: Props) {
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_KEY as string | undefined;

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

  return (
    <Canvas
      camera={{
        position: PARIS_CAMERA, // above Paris in ECEF space
        fov: 70,
        near: 1,
        far: 1e8,
      }}
      onCreated={({ camera }) => {
        camera.lookAt(0, 0, 0); // look toward Earth center (tiles center)
      }}
      gl={{ antialias: true, logarithmicDepthBuffer: true }}
      style={{ position: 'absolute', inset: 0 }}
    >
      <ambientLight intensity={3} />
      <directionalLight position={[1, 2, 1]} intensity={2} />

      <TilesRenderer
        errorTarget={2}
        maxCachedBytes={300 * 1024 * 1024}
      >
        <TilesPlugin plugin={GoogleCloudAuthPlugin} args={[{ apiToken: apiKey }] as any} />
        {/* GlobeControls handles Earth-scale navigation: scroll to zoom, drag to orbit */}
        <GlobeControls
          enableDamping
          maxPolarAngle={Math.PI / 2}  // don't go below the Earth
        />
      </TilesRenderer>
    </Canvas>
  );
}
