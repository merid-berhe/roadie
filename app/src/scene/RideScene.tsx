// Three.js / R3F ride scene — back-seat POV inside the Cicada retro car.
// Coordinate system (glTF standard, Y-up):
//   Y = up/down   X = left/right   Z = front(−)/rear(+)
// Car front faces −Z. Camera at [0, 0.8, 1.5] = back seat, looking toward −Z.
// World objects placed ahead at negative Z, moved toward +Z as ride progresses.

import { Suspense, useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import type { RoadId } from './scenes';

const WORLD_SPEED = 12; // units/sec

// ── Car ────────────────────────────────────────────────────────────────────
function CicadaCar() {
  const { scene } = useGLTF('/assets/cars/cicada_retro_cartoon_car.glb');
  return <primitive object={scene} />;
}

// ── World wrapper — moves along −X so objects approach from +X (car front) ──
function MovingWorld({ positionSec, children }: { positionSec: number; children: React.ReactNode }) {
  const groupRef = useRef<THREE.Group>(null);
  useFrame(() => {
    if (!groupRef.current) return;
    groupRef.current.position.x = -((positionSec * WORLD_SPEED) % 200);
  });
  return <group ref={groupRef}>{children}</group>;
}

// ── Scene themes ────────────────────────────────────────────────────────────
// X = forward/back (car drives along +X), Y = up, Z = left/right
function DesertScene() {
  const cacti = useMemo(() => Array.from({ length: 30 }, (_, i) => ({
    z: (i % 2 === 0 ? 1 : -1) * (2.5 + Math.abs(Math.sin(i * 73.1)) * 4),
    x: i * 7 + 5,
    s: 0.4 + Math.abs(Math.sin(i * 43.7)) * 0.5,
  })), []);

  return (
    <>
      {/* Ground — plane in XZ, normal pointing +Y */}
      <mesh rotation-x={-Math.PI / 2} position={[100, -0.5, 0]}>
        <planeGeometry args={[400, 40]} />
        <meshLambertMaterial color={0x9c6b3c} />
      </mesh>
      {/* Road strip */}
      <mesh rotation-x={-Math.PI / 2} position={[100, -0.49, 0]}>
        <planeGeometry args={[400, 1.6]} />
        <meshLambertMaterial color={0x3a3330} />
      </mesh>
      {/* Road dashes */}
      {Array.from({ length: 50 }, (_, i) => (
        <mesh key={i} rotation-x={-Math.PI / 2} position={[i * 8, -0.48, 0]}>
          <planeGeometry args={[1.8, 0.1]} />
          <meshBasicMaterial color={0xf4d03f} />
        </mesh>
      ))}
      {/* Saguaro cacti */}
      {cacti.map((c, i) => (
        <group key={i} position={[c.x, -0.5, c.z]}>
          <mesh position={[0, c.s, 0]} scale={[c.s * 0.15, c.s * 2, c.s * 0.15]}>
            <cylinderGeometry args={[1, 1, 1, 7]} />
            <meshLambertMaterial color={0x3a6b3a} />
          </mesh>
          <mesh position={[-c.s * 0.3, c.s * 0.7, 0]} rotation-z={Math.PI / 2.8}
            scale={[c.s * 0.1, c.s * 0.9, c.s * 0.1]}>
            <cylinderGeometry args={[1, 1, 1, 6]} />
            <meshLambertMaterial color={0x3a6b3a} />
          </mesh>
        </group>
      ))}
      {/* Distant mesas */}
      {Array.from({ length: 8 }, (_, i) => (
        <mesh key={i} position={[20 + i * 15, -0.1, (i % 2 === 0 ? 1 : -1) * (6 + i)]}>
          <cylinderGeometry args={[1.5, 2.2, 1.8, 5]} />
          <meshLambertMaterial color={0xc17f59} />
        </mesh>
      ))}
    </>
  );
}

function CoastScene() {
  return (
    <>
      <mesh rotation-x={-Math.PI / 2} position={[100, -0.5, 0]}>
        <planeGeometry args={[400, 40]} />
        <meshLambertMaterial color={0x4a7c59} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position={[100, -0.49, 0]}>
        <planeGeometry args={[400, 1.6]} />
        <meshLambertMaterial color={0x3a3a3a} />
      </mesh>
      {Array.from({ length: 50 }, (_, i) => (
        <mesh key={i} rotation-x={-Math.PI / 2} position={[i * 8, -0.48, 0]}>
          <planeGeometry args={[1.8, 0.1]} />
          <meshBasicMaterial color={0xffffff} />
        </mesh>
      ))}
      <mesh rotation-x={-Math.PI / 2} position={[100, -0.48, 8]}>
        <planeGeometry args={[400, 18]} />
        <meshLambertMaterial color={0x1a6e8a} />
      </mesh>
    </>
  );
}

function MountainScene() {
  return (
    <>
      <mesh rotation-x={-Math.PI / 2} position={[100, -0.5, 0]}>
        <planeGeometry args={[400, 40]} />
        <meshLambertMaterial color={0x3a5040} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position={[100, -0.49, 0]}>
        <planeGeometry args={[400, 1.6]} />
        <meshLambertMaterial color={0x2a2a2a} />
      </mesh>
      {Array.from({ length: 50 }, (_, i) => (
        <mesh key={i} rotation-x={-Math.PI / 2} position={[i * 8, -0.48, 0]}>
          <planeGeometry args={[1.8, 0.1]} />
          <meshBasicMaterial color={0xffffff} />
        </mesh>
      ))}
      {Array.from({ length: 20 }, (_, i) => {
        const side = (i % 2 === 0 ? 1 : -1) * 2.5;
        const h = 1.2 + Math.abs(Math.sin(i * 37)) * 1.2;
        return (
          <group key={i} position={[i * 9, -0.5, side]}>
            <mesh position={[0, h * 0.55, 0]} scale={[0.35, h, 0.35]}>
              <coneGeometry args={[1, 1, 7]} />
              <meshLambertMaterial color={0x1a3a2a} />
            </mesh>
          </group>
        );
      })}
      {Array.from({ length: 5 }, (_, i) => (
        <mesh key={i} position={[40 + i * 8, 1.5, (i - 2) * 5]}>
          <coneGeometry args={[3, 5 + i, 5]} />
          <meshLambertMaterial color={0x6b7c8a} />
        </mesh>
      ))}
    </>
  );
}

function CityScene() {
  return (
    <>
      <mesh rotation-x={-Math.PI / 2} position={[100, -0.5, 0]}>
        <planeGeometry args={[400, 40]} />
        <meshLambertMaterial color={0x1a1a1a} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position={[100, -0.49, 0]}>
        <planeGeometry args={[400, 1.6]} />
        <meshLambertMaterial color={0x111111} />
      </mesh>
      {Array.from({ length: 50 }, (_, i) => (
        <mesh key={i} rotation-x={-Math.PI / 2} position={[i * 8, -0.48, 0]}>
          <planeGeometry args={[1.8, 0.1]} />
          <meshBasicMaterial color={0x444466} />
        </mesh>
      ))}
      {Array.from({ length: 16 }, (_, i) => {
        const side = (i % 2 === 0 ? 1 : -1) * (4 + (i % 4) * 0.8);
        const h = 2 + Math.abs(Math.sin(i * 73)) * 5;
        return (
          <group key={i} position={[i * 10, -0.5 + h / 2, side]}>
            <mesh>
              <boxGeometry args={[2, h, 1.5]} />
              <meshLambertMaterial color={0x1a1a2e} />
            </mesh>
          </group>
        );
      })}
    </>
  );
}

function SceneContent({ road, positionSec }: { road: RoadId; positionSec: number }) {
  const bgColor = {
    desert:   '#1a1040',
    coast:    '#87ceeb',
    mountain: '#1a2a4a',
    city:     '#0d0d1a',
  }[road];

  const lightColor = road === 'desert' ? '#ffcc88' : '#ffffff';
  const lightIntensity = road === 'city' ? 0.6 : 1.8;

  return (
    <>
      <color attach="background" args={[bgColor]} />
      <ambientLight intensity={road === 'city' ? 1.2 : 2.5} />
      <directionalLight
        position={[4, 6, 2]}
        intensity={road === 'city' ? 1.0 : 2.0}
        color={lightColor}
      />

      {/* Car — camera is already positioned inside it */}
      <Suspense fallback={null}>
        <CicadaCar />
      </Suspense>

      {/* Scrolling world */}
      <MovingWorld positionSec={positionSec}>
        {road === 'desert'   && <DesertScene />}
        {road === 'coast'    && <CoastScene />}
        {road === 'mountain' && <MountainScene />}
        {road === 'city'     && <CityScene />}
      </MovingWorld>
    </>
  );
}

export default function RideScene({ road, positionSec }: { road: RoadId; positionSec: number }) {
  return (
    <Canvas
      camera={{
        position: [-0.3, 0.05, 0], // back seat: seat height, slightly behind centre
        fov: 75,
        near: 0.01,
        far: 300,
      }}
      onCreated={({ camera }) => {
        camera.lookAt(10, 0.0, 0); // look forward through windshield (+X)
      }}
      shadows
      style={{ position: 'absolute', inset: 0 }}
    >
      <SceneContent road={road} positionSec={positionSec} />
    </Canvas>
  );
}

useGLTF.preload('/assets/cars/cicada_retro_cartoon_car.glb');
