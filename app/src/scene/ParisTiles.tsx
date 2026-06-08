// Google Photorealistic 3D Tiles — Paris proof of concept.
// Requires VITE_GOOGLE_MAPS_KEY in app/.env.local with Map Tiles API enabled.

import { useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — 3d-tiles-renderer R3F subpath types may not resolve cleanly
import { TilesRenderer, TilesPlugin } from '3d-tiles-renderer/r3f';
import { GoogleCloudAuthPlugin, ReorientationPlugin } from '3d-tiles-renderer/plugins';
import * as THREE from 'three';

const DEG = Math.PI / 180;

// Paris scenic route: Notre Dame → Louvre → Concorde → Arc de Triomphe → Eiffel Tower
const PARIS_ROUTE = [
  { lat: 48.8530, lon: 2.3499 },
  { lat: 48.8606, lon: 2.3376 },
  { lat: 48.8656, lon: 2.3212 },
  { lat: 48.8698, lon: 2.3078 },
  { lat: 48.8584, lon: 2.2945 },
];

function lerpRoute(t: number) {
  const scaled = Math.max(0, Math.min(1, t)) * (PARIS_ROUTE.length - 1);
  const i = Math.min(Math.floor(scaled), PARIS_ROUTE.length - 2);
  const f = scaled - i;
  return {
    lat: PARIS_ROUTE[i].lat + (PARIS_ROUTE[i + 1].lat - PARIS_ROUTE[i].lat) * f,
    lon: PARIS_ROUTE[i].lon + (PARIS_ROUTE[i + 1].lon - PARIS_ROUTE[i].lon) * f,
  };
}

function Scene({ positionSec, rideDuration, apiKey }: { positionSec: number; rideDuration: number; apiKey: string }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pluginRef = useRef<any>(null);
  const { camera } = useThree();

  // Set camera to a low driving height
  camera.near = 0.1;
  camera.far = 1e7;

  useFrame(() => {
    const t = positionSec / rideDuration;
    const { lat, lon } = lerpRoute(t);
    // Approximate forward heading from current to next position
    const { lat: lat2, lon: lon2 } = lerpRoute(Math.min(1, (positionSec + 3) / rideDuration));
    const az = Math.atan2((lon2 - lon) * Math.cos(lat * DEG), lat2 - lat);

    if (pluginRef.current) {
      // Move the tile origin to our current position, 80m above ground, facing forward
      pluginRef.current.transformLatLonHeightToOrigin(lat * DEG, lon * DEG, 80, az, -0.08, 0);
    }
  });

  return (
    <>
      <ambientLight intensity={3} />
      <directionalLight position={[1, 2, 1]} intensity={2} />

      {/* Camera sits slightly behind and above the tile origin */}
      {/* (tiles move relative to camera, giving driving feel) */}

      <TilesRenderer>
        {/* Auth plugin — args is spread as constructor args, so wrap in array */}
        <TilesPlugin plugin={GoogleCloudAuthPlugin} args={[{ apiToken: apiKey }] as unknown as []} />
        {/* Reorientation — positions tiles at Paris lat/lon with Y-up */}
        <TilesPlugin
          ref={pluginRef}
          plugin={ReorientationPlugin}
          args={[{
            lat: PARIS_ROUTE[0].lat * DEG,
            lon: PARIS_ROUTE[0].lon * DEG,
            height: 80,
            up: '+y',
          }] as unknown as []}
        />
      </TilesRenderer>
    </>
  );
}

type Props = { positionSec: number; rideDuration?: number };

export default function ParisTiles({ positionSec, rideDuration = 120 }: Props) {
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_KEY as string | undefined;

  if (!apiKey) {
    return (
      <div className="flex h-full items-center justify-center bg-[#0a0d1a] text-white/60 text-sm">
        <div className="space-y-2 text-center">
          <p className="text-lg font-semibold text-white">Google Maps key needed</p>
          <p>Add to <code className="text-amber-400">app/.env.local</code>:</p>
          <code className="block rounded bg-white/10 px-3 py-2 text-xs text-amber-300">
            VITE_GOOGLE_MAPS_KEY=your_key_here
          </code>
          <p className="text-xs text-white/30">Enable "Map Tiles API" in Google Cloud Console → restart npm run dev</p>
        </div>
      </div>
    );
  }

  return (
    <Canvas
      camera={{ position: [0, 80, 0], fov: 70, near: 0.1, far: 1e7 }}
      gl={{ antialias: true, logarithmicDepthBuffer: true }}
      style={{ position: 'absolute', inset: 0 }}
    >
      <Scene positionSec={positionSec} rideDuration={rideDuration} apiKey={apiKey} />
    </Canvas>
  );
}
