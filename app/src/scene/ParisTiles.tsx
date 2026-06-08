// Google Photorealistic 3D Tiles — Paris driving proof of concept.
// Camera automatically drives along the route at street level.
// Drag to look around while the route plays.

import { useRef, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
// @ts-ignore
import { TilesRenderer, TilesPlugin } from '3d-tiles-renderer/r3f';
import { GoogleCloudAuthPlugin, ReorientationPlugin } from '3d-tiles-renderer/plugins';
import * as THREE from 'three';

const DEG = Math.PI / 180;

const PARIS_ROUTE = [
  { lat: 48.8530, lon: 2.3499 }, // Notre Dame
  { lat: 48.8606, lon: 2.3376 }, // Louvre
  { lat: 48.8656, lon: 2.3212 }, // Place de la Concorde
  { lat: 48.8698, lon: 2.3078 }, // Arc de Triomphe
  { lat: 48.8584, lon: 2.2945 }, // Eiffel Tower
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

// Simple drag-to-look — doesn't interfere with tile loading
function PointerLook() {
  const { camera, gl } = useThree();
  const drag   = useRef(false);
  const last   = useRef({ x: 0, y: 0 });
  const euler  = useRef(new THREE.Euler(0, 0, 0, 'YXZ'));

  useEffect(() => {
    const el = gl.domElement;
    const down = (e: PointerEvent) => { drag.current = true; last.current = { x: e.clientX, y: e.clientY }; };
    const up   = () => { drag.current = false; };
    const move = (e: PointerEvent) => {
      if (!drag.current) return;
      const dx = e.clientX - last.current.x;
      const dy = e.clientY - last.current.y;
      last.current = { x: e.clientX, y: e.clientY };
      euler.current.setFromQuaternion(camera.quaternion);
      euler.current.y -= dx * 0.003;
      euler.current.x -= dy * 0.003;
      euler.current.x = Math.max(-Math.PI / 3, Math.min(Math.PI / 3, euler.current.x));
      camera.quaternion.setFromEuler(euler.current);
    };
    el.addEventListener('pointerdown', down);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointermove', move);
    return () => { el.removeEventListener('pointerdown', down); el.removeEventListener('pointerup', up); el.removeEventListener('pointermove', move); };
  }, [camera, gl]);

  return null;
}

function Scene({ positionSec, rideDuration, apiKey }: {
  positionSec: number; rideDuration: number; apiKey: string;
}) {
  const pluginRef  = useRef<any>(null);
  const tilesRef   = useRef<any>(null);
  const { camera, gl } = useThree();
  const prevAz     = useRef(0);

  // Fix camera clipping for city scale
  useEffect(() => {
    camera.near = 0.5;
    camera.far  = 4000;
    (camera as THREE.PerspectiveCamera).updateProjectionMatrix();
  }, [camera]);

  useFrame(() => {
    const t  = positionSec / rideDuration;
    const { lat, lon }     = lerpRoute(t);
    const { lat: lat2, lon: lon2 } = lerpRoute(Math.min(1, (positionSec + 2) / rideDuration));

    // Smooth heading
    const targetAz = Math.atan2((lon2 - lon) * Math.cos(lat * DEG), lat2 - lat);
    prevAz.current += (targetAz - prevAz.current) * 0.05;

    if (pluginRef.current) {
      // Add π/2 offset so the plugin's local -Z aligns with the road direction
      pluginRef.current.transformLatLonHeightToOrigin(
        lat * DEG, lon * DEG,
        50,   // Paris terrain ~35m above WGS84 ellipsoid; 50 = ~15m above ground
        prevAz.current + Math.PI / 2,
        0,
        0
      );
    }

    // Camera stays at origin (tiles reorient around it)
    camera.position.set(0, 0, 0);

    // Update tile resolution every frame for maximum quality at current view
    if (tilesRef.current) {
      tilesRef.current.setResolutionFromRenderer(camera, gl);
    }
  });

  return (
    <>
      <ambientLight intensity={3} />
      <directionalLight position={[1, 2, 1]} intensity={2} />

      <TilesRenderer
        ref={tilesRef}
        errorTarget={2}          // low = higher quality tiles loaded (default ~6)
        maxCachedBytes={250 * 1024 * 1024}  // 250MB cache for smooth driving
      >
        <TilesPlugin plugin={GoogleCloudAuthPlugin} args={[{ apiToken: apiKey }] as any} />
        <TilesPlugin
          ref={pluginRef}
          plugin={ReorientationPlugin}
          args={[{
            lat: PARIS_ROUTE[0].lat * DEG,
            lon: PARIS_ROUTE[0].lon * DEG,
            height: 50,  // above WGS84 ellipsoid; Paris terrain ~35m, so ~15m above ground
            up: '+y',
          }] as any}
        />
      </TilesRenderer>

      <PointerLook />
    </>
  );
}

type Props = { positionSec: number; rideDuration?: number };

export default function ParisTiles({ positionSec, rideDuration = 120 }: Props) {
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
      camera={{ position: [0, 0, 0], fov: 70, near: 0.5, far: 4000 }}
      onCreated={({ camera }) => {
        // Look forward along -Z (Three.js default). Plugin azimuth aligns road with -Z.
        camera.lookAt(0, 2, -100);
      }}
      gl={{ antialias: true, logarithmicDepthBuffer: true }}
      style={{ position: 'absolute', inset: 0 }}
    >
      <Scene positionSec={positionSec} rideDuration={rideDuration} apiKey={apiKey} />
    </Canvas>
  );
}
