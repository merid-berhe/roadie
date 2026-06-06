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
  // Model exported on its side — rotate 90° around X to sit upright
  return <primitive object={scene} rotation={[Math.PI / 2, 0, 0]} />;
}

// ── World wrapper — moves along +Z so objects approach from −Z ─────────────
function MovingWorld({ positionSec, children }: { positionSec: number; children: React.ReactNode }) {
  const groupRef = useRef<THREE.Group>(null);
  useFrame(() => {
    if (!groupRef.current) return;
    // Wrap every 200 units so the world loops
    groupRef.current.position.z = (positionSec * WORLD_SPEED) % 200;
  });
  return <group ref={groupRef}>{children}</group>;
}

// ── Scene themes ────────────────────────────────────────────────────────────
function DesertScene() {
  const cacti = useMemo(() => Array.from({ length: 30 }, (_, i) => ({
    x: (i % 2 === 0 ? 1 : -1) * (2.5 + Math.abs(Math.sin(i * 73.1)) * 4),
    z: -i * 7 - 5,
    s: 0.4 + Math.abs(Math.sin(i * 43.7)) * 0.5,
  })), []);

  return (
    <>
      {/* Ground */}
      <mesh rotation-x={-Math.PI / 2} position={[0, -0.5, -100]}>
        <planeGeometry args={[40, 400]} />
        <meshLambertMaterial color={0x9c6b3c} />
      </mesh>
      {/* Road */}
      <mesh rotation-x={-Math.PI / 2} position={[0, -0.49, -100]}>
        <planeGeometry args={[1.6, 400]} />
        <meshLambertMaterial color={0x3a3330} />
      </mesh>
      {/* Road dashes — 50 of them spread across the road length */}
      {Array.from({ length: 50 }, (_, i) => (
        <mesh key={i} rotation-x={-Math.PI / 2} position={[0, -0.48, -i * 8]}>
          <planeGeometry args={[0.1, 1.8]} />
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
          <mesh position={[-c.s * 0.55, c.s * 0.7, 0]} rotation-z={Math.PI / 2.8}
            scale={[c.s * 0.1, c.s * 0.9, c.s * 0.1]}>
            <cylinderGeometry args={[1, 1, 1, 6]} />
            <meshLambertMaterial color={0x3a6b3a} />
          </mesh>
          <mesh position={[c.s * 0.55, c.s * 0.9, 0]} rotation-z={-Math.PI / 2.5}
            scale={[c.s * 0.1, c.s * 0.7, c.s * 0.1]}>
            <cylinderGeometry args={[1, 1, 1, 6]} />
            <meshLambertMaterial color={0x3a6b3a} />
          </mesh>
        </group>
      ))}
      {/* Distant mesas */}
      {Array.from({ length: 8 }, (_, i) => (
        <mesh key={i} position={[(i % 2 === 0 ? 1 : -1) * (6 + i), -0.1, -20 - i * 15]}>
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
      <mesh rotation-x={-Math.PI / 2} position={[0, -0.5, -100]}>
        <planeGeometry args={[40, 400]} />
        <meshLambertMaterial color={0x4a7c59} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position={[0, -0.49, -100]}>
        <planeGeometry args={[1.6, 400]} />
        <meshLambertMaterial color={0x3a3a3a} />
      </mesh>
      {Array.from({ length: 50 }, (_, i) => (
        <mesh key={i} rotation-x={-Math.PI / 2} position={[0, -0.48, -i * 8]}>
          <planeGeometry args={[0.1, 1.8]} />
          <meshBasicMaterial color={0xffffff} />
        </mesh>
      ))}
      {/* Ocean */}
      <mesh rotation-x={-Math.PI / 2} position={[10, -0.48, -100]}>
        <planeGeometry args={[18, 400]} />
        <meshLambertMaterial color={0x1a6e8a} />
      </mesh>
      {/* Cliff edge */}
      {Array.from({ length: 12 }, (_, i) => (
        <mesh key={i} position={[6 + i * 0.3, -0.1, -i * 16]}>
          <boxGeometry args={[2, 1.2, 4]} />
          <meshLambertMaterial color={0x8b7355} />
        </mesh>
      ))}
    </>
  );
}

function MountainScene() {
  return (
    <>
      <mesh rotation-x={-Math.PI / 2} position={[0, -0.5, -100]}>
        <planeGeometry args={[40, 400]} />
        <meshLambertMaterial color={0x3a5040} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position={[0, -0.49, -100]}>
        <planeGeometry args={[1.6, 400]} />
        <meshLambertMaterial color={0x2a2a2a} />
      </mesh>
      {Array.from({ length: 50 }, (_, i) => (
        <mesh key={i} rotation-x={-Math.PI / 2} position={[0, -0.48, -i * 8]}>
          <planeGeometry args={[0.1, 1.8]} />
          <meshBasicMaterial color={0xffffff} />
        </mesh>
      ))}
      {Array.from({ length: 20 }, (_, i) => {
        const side = i % 2 === 0 ? 2.5 : -2.5;
        const h = 1.2 + Math.abs(Math.sin(i * 37)) * 1.2;
        return (
          <group key={i} position={[side, -0.5, -i * 9]}>
            <mesh position={[0, h * 0.55, 0]} scale={[0.35, h, 0.35]}>
              <coneGeometry args={[1, 1, 7]} />
              <meshLambertMaterial color={0x1a3a2a} />
            </mesh>
            <mesh position={[0, h * 0.22, 0]} scale={[0.55, h * 0.55, 0.55]}>
              <coneGeometry args={[1, 1, 7]} />
              <meshLambertMaterial color={0x1a3a2a} />
            </mesh>
          </group>
        );
      })}
      {/* Mountain peaks far background */}
      {Array.from({ length: 5 }, (_, i) => (
        <mesh key={i} position={[(i - 2) * 5, 1.5, -40 - i * 8]}>
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
      <mesh rotation-x={-Math.PI / 2} position={[0, -0.5, -100]}>
        <planeGeometry args={[40, 400]} />
        <meshLambertMaterial color={0x1a1a1a} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position={[0, -0.49, -100]}>
        <planeGeometry args={[1.6, 400]} />
        <meshLambertMaterial color={0x111111} />
      </mesh>
      {Array.from({ length: 50 }, (_, i) => (
        <mesh key={i} rotation-x={-Math.PI / 2} position={[0, -0.48, -i * 8]}>
          <planeGeometry args={[0.1, 1.8]} />
          <meshBasicMaterial color={0x444466} />
        </mesh>
      ))}
      {Array.from({ length: 16 }, (_, i) => {
        const side = i % 2 === 0 ? 4 + (i % 4) * 0.8 : -4 - (i % 4) * 0.8;
        const h = 2 + Math.abs(Math.sin(i * 73)) * 5;
        return (
          <group key={i} position={[side, -0.5 + h / 2, -i * 10]}>
            <mesh>
              <boxGeometry args={[1.5, h, 2]} />
              <meshLambertMaterial color={0x1a1a2e} />
            </mesh>
            {/* Lit windows */}
            {Array.from({ length: Math.floor(h * 1.5) }, (_, w) => (
              <mesh key={w} position={[
                Math.abs(Math.sin(w * 17.3)) > 0.5 ? 0.76 : -0.76,
                -h / 2 + w * 0.6 + 0.3,
                0,
              ]}>
                <planeGeometry args={[0.2, 0.25]} />
                <meshBasicMaterial color={Math.sin(w * 31.7) > 0 ? 0xffcc66 : 0x66aaff} />
              </mesh>
            ))}
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
      <ambientLight intensity={road === 'city' ? 0.4 : 1.4} />
      <directionalLight
        position={road === 'city' ? [2, 6, 3] : [4, 8, 2]}
        intensity={lightIntensity}
        color={lightColor}
        castShadow
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
        position: [0, 0.8, 1.5],  // back seat: centred, seat height, behind front seats
        fov: 75,
        near: 0.01,
        far: 300,
      }}
      onCreated={({ camera }) => {
        // Look toward front of car (−Z direction, glTF standard)
        camera.lookAt(0, 0.8, -10);
      }}
      shadows
      style={{ position: 'absolute', inset: 0 }}
    >
      <SceneContent road={road} positionSec={positionSec} />
    </Canvas>
  );
}

useGLTF.preload('/assets/cars/cicada_retro_cartoon_car.glb');
