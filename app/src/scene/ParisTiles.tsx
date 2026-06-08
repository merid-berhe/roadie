// Google Photorealistic 3D Tiles — Paris proof of concept.
// Requires VITE_GOOGLE_MAPS_KEY in app/.env.local with Map Tiles API enabled.

import { useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
// @ts-ignore
import { TilesRenderer, TilesPlugin, GlobeControls } from '3d-tiles-renderer/r3f';
import { GoogleCloudAuthPlugin, ReorientationPlugin } from '3d-tiles-renderer/plugins';

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

function Scene({ positionSec, rideDuration, apiKey }: {
  positionSec: number;
  rideDuration: number;
  apiKey: string;
}) {
  const pluginRef = useRef<any>(null);
  const { camera } = useThree();

  // Set camera clipping planes for city-scale rendering
  camera.near = 0.5;
  camera.far = 5000;

  useFrame(() => {
    const t = positionSec / rideDuration;
    const { lat, lon } = lerpRoute(t);
    const { lat: lat2, lon: lon2 } = lerpRoute(Math.min(1, (positionSec + 3) / rideDuration));

    // Heading toward next waypoint (azimuth = compass bearing)
    const az = Math.atan2(
      (lon2 - lon) * Math.cos(lat * DEG),
      lat2 - lat
    );

    if (pluginRef.current) {
      // 5m above ground, facing forward along route, very slight upward tilt
      pluginRef.current.transformLatLonHeightToOrigin(
        lat * DEG,
        lon * DEG,
        5,    // height in metres — street level
        az,   // azimuth — face direction of travel
        0.05, // slight upward look
        0
      );
    }
  });

  return (
    <>
      <ambientLight intensity={3} />
      <directionalLight position={[1, 2, 1]} intensity={2} />

      <TilesRenderer>
        <TilesPlugin plugin={GoogleCloudAuthPlugin} args={[{ apiToken: apiKey }] as any} />
        <TilesPlugin
          ref={pluginRef}
          plugin={ReorientationPlugin}
          args={[{
            lat: PARIS_ROUTE[0].lat * DEG,
            lon: PARIS_ROUTE[0].lon * DEG,
            height: 5,
            up: '+y',
          }] as any}
        />
        {/* Globe controls for mouse/touch navigation */}
        <GlobeControls enableDamping />
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
          <p className="text-xs text-white/30">Enable "Map Tiles API" in Google Cloud Console</p>
        </div>
      </div>
    );
  }

  return (
    <Canvas
      camera={{
        position: [0, 5, 0],   // street level
        fov: 70,
        near: 0.5,
        far: 5000,
      }}
      onCreated={({ camera }) => {
        camera.lookAt(50, 5, 0); // look forward along route
      }}
      gl={{ antialias: true, logarithmicDepthBuffer: true }}
      style={{ position: 'absolute', inset: 0 }}
    >
      <Scene positionSec={positionSec} rideDuration={rideDuration} apiKey={apiKey} />
    </Canvas>
  );
}
