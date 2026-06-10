// Google Photorealistic 3D Tiles — Paris proof of concept.
// Requires VITE_GOOGLE_MAPS_KEY in app/.env.local with Map Tiles API enabled.

import { Suspense, useContext, useMemo, useRef, type ReactNode, type RefObject } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Html, useGLTF } from '@react-three/drei';
import {
  SettledObject,
  SettledObjects,
  TilesAttributionOverlay,
  TilesPlugin,
  TilesRenderer,
  TilesRendererContext,
} from '3d-tiles-renderer/r3f';
import { GoogleCloudAuthPlugin } from '3d-tiles-renderer/plugins';
import * as THREE from 'three';

const DEG = Math.PI / 180;
const WGS84_A = 6_378_137;
const WGS84_E2 = 6.69437999014e-3;

export type ParisAnchorId = 'champs-elysees' | 'concorde';

export const PARIS_TILE_ANCHORS: Record<ParisAnchorId, {
  label: string;
  latDeg: number;
  lonDeg: number;
  initialCameraHeightM: number;
  headingDeg: number;
}> = {
  // Coordinates from latlong.net's Champs-Élysées entry. This is a wider road
  // corridor than Concorde and is a better default for car placement.
  'champs-elysees': {
    label: 'Champs-Élysées',
    latDeg: 48.870502,
    lonDeg: 2.304897,
    initialCameraHeightM: 60,
    headingDeg: 295,
  },
  // Previous proof-of-concept anchor. Kept for comparison/debugging.
  concorde: {
    label: 'Concorde',
    latDeg: 48.86563,
    lonDeg: 2.32124,
    initialCameraHeightM: 52,
    headingDeg: 84,
  },
};

const WORLD_SPEED_MPS = 3.2;
const DEFAULT_CAR_LIFT_M = 0.65;
const CAR_CAMERA_LOCAL = new THREE.Vector3(0.05, 1.25, 0);
const CAR_TARGET_LOCAL = new THREE.Vector3(-8, 1.05, 0);
const UP_PROBE_LOCAL = new THREE.Vector3(0.05, 2.25, 0);

type Props = {
  anchorId?: ParisAnchorId;
  positionSec: number;
  rideDuration?: number;
  headingDeg?: number;
  liftM?: number;
  pixelRatio?: number;
};

export default function ParisTiles({
  anchorId = 'champs-elysees',
  positionSec,
  headingDeg,
  liftM = DEFAULT_CAR_LIFT_M,
  pixelRatio = 1,
}: Props) {
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_KEY as string | undefined;
  const anchor = PARIS_TILE_ANCHORS[anchorId];
  const lat = anchor.latDeg * DEG;
  const lon = anchor.lonDeg * DEG;
  const resolvedHeadingDeg = headingDeg ?? anchor.headingDeg;

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

  const initialCamera = ecefFromCartographic(lat, lon, anchor.initialCameraHeightM);

  return (
    <Canvas
      camera={{
        position: initialCamera.toArray(),
        fov: 72,
        near: 1,
        far: 1e8,
      }}
      dpr={Math.max(1, pixelRatio)}
      gl={{ antialias: true, logarithmicDepthBuffer: true }}
      style={{ position: 'absolute', inset: 0 }}
    >
      <ambientLight intensity={3} />
      <directionalLight position={[1, 2, 1]} intensity={2} />

      <TilesRenderer errorTarget={1}>
        <TilesPlugin plugin={GoogleCloudAuthPlugin} args={[{ apiToken: apiKey, useRecommendedSettings: false }]} />
        <TilesAttributionOverlay
          style={{
            bottom: 8,
            color: 'white',
            fontSize: 11,
            left: 8,
            opacity: 0.75,
            position: 'absolute',
            textShadow: '0 1px 2px #000',
          }}
        />
        <TileSurfaceQueries>
          <SettledObject
            lat={lat}
            lon={lon}
            component={<group><StreetRoadieCar positionSec={positionSec} headingDeg={resolvedHeadingDeg} liftM={liftM} /></group>}
          />
        </TileSurfaceQueries>
      </TilesRenderer>
    </Canvas>
  );
}

function TileSurfaceQueries({ children }: { children: ReactNode }) {
  const tiles = useContext(TilesRendererContext);
  return <SettledObjects scene={tiles ? tiles.group : []}>{children}</SettledObjects>;
}

function StreetRoadieCar({
  positionSec,
  headingDeg,
  liftM,
}: {
  positionSec: number;
  headingDeg: number;
  liftM: number;
}) {
  const carRef = useRef<THREE.Group>(null);
  const headingRad = headingDeg * DEG;
  const carQuaternion = useMemo(() => carQuaternionForHeading(headingRad), [headingRad]);
  const pathPosition = useMemo(() => streetPathPosition(positionSec, headingRad, liftM), [positionSec, headingRad, liftM]);

  useStreetCamera(carRef);

  return (
    <>
      <group
        ref={carRef}
        position={pathPosition}
        quaternion={carQuaternion}
      >
        <Suspense fallback={<Html center><p className="text-white text-xs">loading car…</p></Html>}>
          <CicadaCar />
        </Suspense>
      </group>

      <mesh position={[0, 0.04, 0]}>
        <cylinderGeometry args={[0.35, 0.35, 0.04, 32]} />
        <meshBasicMaterial color="#f5a623" transparent opacity={0.5} />
      </mesh>
    </>
  );
}

function CicadaCar() {
  const { scene } = useGLTF('/assets/cars/cicada_retro_cartoon_car.glb');
  return <primitive object={scene} />;
}

function useStreetCamera(carRef: RefObject<THREE.Group | null>) {
  const { camera } = useThree();
  const cameraWorld = useMemo(() => new THREE.Vector3(), []);
  const targetWorld = useMemo(() => new THREE.Vector3(), []);
  const upWorld = useMemo(() => new THREE.Vector3(), []);

  useFrame(() => {
    const car = carRef.current;
    if (!car) return;

    cameraWorld.copy(CAR_CAMERA_LOCAL);
    targetWorld.copy(CAR_TARGET_LOCAL);
    upWorld.copy(UP_PROBE_LOCAL);

    car.localToWorld(cameraWorld);
    car.localToWorld(targetWorld);
    car.localToWorld(upWorld);

    camera.position.copy(cameraWorld);
    camera.up.copy(upWorld.sub(cameraWorld).normalize());
    camera.lookAt(targetWorld);
    camera.updateMatrixWorld();
  });
}

function streetPathPosition(positionSec: number, headingRad: number, liftM: number): [number, number, number] {
  const meters = positionSec * WORLD_SPEED_MPS;
  const east = Math.sin(headingRad) * meters;
  const north = Math.cos(headingRad) * meters;
  return [east, liftM, north];
}

function carQuaternionForHeading(headingRad: number): THREE.Quaternion {
  const forward = new THREE.Vector3(Math.sin(headingRad), 0, Math.cos(headingRad)).normalize();
  const up = new THREE.Vector3(0, 1, 0);

  const xAxis = forward.clone().multiplyScalar(-1);
  const yAxis = up;
  const zAxis = new THREE.Vector3().crossVectors(xAxis, yAxis).normalize();

  const matrix = new THREE.Matrix4().makeBasis(xAxis, yAxis, zAxis);
  return new THREE.Quaternion().setFromRotationMatrix(matrix);
}

function ecefFromCartographic(lat: number, lon: number, heightM: number): THREE.Vector3 {
  const sinLat = Math.sin(lat);
  const cosLat = Math.cos(lat);
  const radius = WGS84_A / Math.sqrt(1 - WGS84_E2 * sinLat * sinLat);

  return new THREE.Vector3(
    (radius + heightM) * cosLat * Math.cos(lon),
    (radius + heightM) * cosLat * Math.sin(lon),
    (radius * (1 - WGS84_E2) + heightM) * sinLat,
  );
}

useGLTF.preload('/assets/cars/cicada_retro_cartoon_car.glb');
