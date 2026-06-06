// Three.js / R3F ride scene — back-seat POV inside the Cicada retro car.
// Camera at [0, 1.5, 0] looking toward -Y (front of car / windshield).
// World objects move toward the camera on the Y axis to simulate forward motion.

import { Suspense, useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import type { RoadId } from './scenes';

// ── Car ────────────────────────────────────────────────────────────────────
function CicadaCar() {
  const { scene } = useGLTF('/assets/cars/cicada_retro_cartoon_car.glb');
  // Model is positioned so back seat = [0,1.5,0]. No transform needed.
  return <primitive object={scene} />;
}

// ── World (road + scenery moving toward camera) ────────────────────────────
type WorldProps = {
  road: RoadId;
  positionSec: number;
};

// Speed in world units per second of ride time
const WORLD_SPEED = 8;

function DesertWorld({ offset }: { offset: number }) {
  // Ground plane
  // Saguaro cactus positions — deterministic, recycled as world scrolls
  const cacti = useMemo(() => Array.from({ length: 20 }, (_, i) => ({
    x: (Math.sin(i * 127.1) * 0.5 + 0.5) * 6 - 3 + (i % 2 === 0 ? 2 : -2),
    z: (Math.sin(i * 311.7) * 0.5) * 0.8,
    scale: 0.3 + Math.abs(Math.sin(i * 43.7)) * 0.4,
    spacing: 4 + Math.abs(Math.sin(i * 91.3)) * 4,
  })), []);

  return (
    <group position-y={-offset % 100}>
      {/* Ground */}
      <mesh rotation-x={-Math.PI / 2} position={[0, -1.5, 0]} receiveShadow>
        <planeGeometry args={[30, 200]} />
        <meshLambertMaterial color={0x9c6b3c} />
      </mesh>

      {/* Road strip */}
      <mesh rotation-x={-Math.PI / 2} position={[0, -1.49, 0]}>
        <planeGeometry args={[1.2, 200]} />
        <meshLambertMaterial color={0x3a3330} />
      </mesh>

      {/* Road dashes */}
      {Array.from({ length: 25 }, (_, i) => (
        <mesh key={i} rotation-x={-Math.PI / 2} position={[0, -1.48, -4 + i * 8]}>
          <planeGeometry args={[0.08, 1.5]} />
          <meshBasicMaterial color={0xf4d03f} />
        </mesh>
      ))}

      {/* Cacti */}
      {cacti.map((c, i) => (
        <group key={i} position={[c.x, -1.5, c.z - (i * c.spacing)]}>
          {/* Trunk */}
          <mesh position={[0, c.scale * 1, 0]} scale={[c.scale * 0.15, c.scale * 2, c.scale * 0.15]}>
            <cylinderGeometry args={[1, 1, 1, 6]} />
            <meshLambertMaterial color={0x3a6b3a} />
          </mesh>
          {/* Left arm */}
          <mesh position={[-c.scale * 0.6, c.scale * 0.8, 0]} rotation-z={Math.PI / 3}
            scale={[c.scale * 0.1, c.scale * 0.8, c.scale * 0.1]}>
            <cylinderGeometry args={[1, 1, 1, 6]} />
            <meshLambertMaterial color={0x3a6b3a} />
          </mesh>
          {/* Right arm */}
          <mesh position={[c.scale * 0.6, c.scale * 1.0, 0]} rotation-z={-Math.PI / 2.5}
            scale={[c.scale * 0.1, c.scale * 0.7, c.scale * 0.1]}>
            <cylinderGeometry args={[1, 1, 1, 6]} />
            <meshLambertMaterial color={0x3a6b3a} />
          </mesh>
        </group>
      ))}

      {/* Far mesas */}
      {Array.from({ length: 6 }, (_, i) => (
        <mesh key={i} position={[
          (i % 2 === 0 ? 1 : -1) * (4 + i * 1.5),
          -0.5,
          -10 - i * 12,
        ]}>
          <cylinderGeometry args={[1.5 + i * 0.3, 2 + i * 0.4, 1.5 + i * 0.2, 5]} />
          <meshLambertMaterial color={0xc17f59} />
        </mesh>
      ))}
    </group>
  );
}

function CoastWorld({ offset }: { offset: number }) {
  return (
    <group position-y={-offset % 100}>
      <mesh rotation-x={-Math.PI / 2} position={[0, -1.5, 0]} receiveShadow>
        <planeGeometry args={[30, 200]} />
        <meshLambertMaterial color={0x4a7c59} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position={[0, -1.49, 0]}>
        <planeGeometry args={[1.2, 200]} />
        <meshLambertMaterial color={0x3a3a3a} />
      </mesh>
      {Array.from({ length: 25 }, (_, i) => (
        <mesh key={i} rotation-x={-Math.PI / 2} position={[0, -1.48, -4 + i * 8]}>
          <planeGeometry args={[0.08, 1.5]} />
          <meshBasicMaterial color={0xffffff} />
        </mesh>
      ))}
      {/* Ocean horizon */}
      <mesh rotation-x={-Math.PI / 2} position={[8, -1.48, -30]}>
        <planeGeometry args={[14, 200]} />
        <meshLambertMaterial color={0x1a6e8a} />
      </mesh>
    </group>
  );
}

function MountainWorld({ offset }: { offset: number }) {
  return (
    <group position-y={-offset % 100}>
      <mesh rotation-x={-Math.PI / 2} position={[0, -1.5, 0]} receiveShadow>
        <planeGeometry args={[30, 200]} />
        <meshLambertMaterial color={0x3a5040} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position={[0, -1.49, 0]}>
        <planeGeometry args={[1.2, 200]} />
        <meshLambertMaterial color={0x2a2a2a} />
      </mesh>
      {Array.from({ length: 25 }, (_, i) => (
        <mesh key={i} rotation-x={-Math.PI / 2} position={[0, -1.48, -4 + i * 8]}>
          <planeGeometry args={[0.08, 1.5]} />
          <meshBasicMaterial color={0xffffff} />
        </mesh>
      ))}
      {/* Pine trees */}
      {Array.from({ length: 16 }, (_, i) => {
        const side = i % 2 === 0 ? 2.5 : -2.5;
        const z = -i * 6;
        const h = 1 + Math.abs(Math.sin(i * 37)) * 0.8;
        return (
          <group key={i} position={[side, -1.5, z]}>
            <mesh position={[0, h * 0.6, 0]} scale={[0.3, h, 0.3]}>
              <coneGeometry args={[1, 1, 6]} />
              <meshLambertMaterial color={0x1a3a2a} />
            </mesh>
            <mesh position={[0, h * 0.25, 0]} scale={[0.5, h * 0.5, 0.5]}>
              <coneGeometry args={[1, 1, 6]} />
              <meshLambertMaterial color={0x1a3a2a} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

function CityWorld({ offset }: { offset: number }) {
  return (
    <group position-y={-offset % 100}>
      <mesh rotation-x={-Math.PI / 2} position={[0, -1.5, 0]} receiveShadow>
        <planeGeometry args={[30, 200]} />
        <meshLambertMaterial color={0x1a1a1a} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position={[0, -1.49, 0]}>
        <planeGeometry args={[1.2, 200]} />
        <meshLambertMaterial color={0x111111} />
      </mesh>
      {Array.from({ length: 25 }, (_, i) => (
        <mesh key={i} rotation-x={-Math.PI / 2} position={[0, -1.48, -4 + i * 8]}>
          <planeGeometry args={[0.08, 1.5]} />
          <meshBasicMaterial color={0x555577} />
        </mesh>
      ))}
      {/* Buildings */}
      {Array.from({ length: 12 }, (_, i) => {
        const side = i % 2 === 0 ? 4 + (i % 3) : -4 - (i % 3);
        const h = 2 + Math.abs(Math.sin(i * 73)) * 4;
        const z = -i * 8;
        return (
          <mesh key={i} position={[side, -1.5 + h / 2, z]}>
            <boxGeometry args={[1.2, h, 1.5]} />
            <meshLambertMaterial color={0x1a1a2e} />
          </mesh>
        );
      })}
    </group>
  );
}

function World({ road, positionSec }: WorldProps) {
  const offset = positionSec * WORLD_SPEED;
  switch (road) {
    case 'desert':   return <DesertWorld offset={offset} />;
    case 'coast':    return <CoastWorld offset={offset} />;
    case 'mountain': return <MountainWorld offset={offset} />;
    case 'city':     return <CityWorld offset={offset} />;
    default:         return <DesertWorld offset={offset} />;
  }
}

// ── Scene root ─────────────────────────────────────────────────────────────
type RideSceneProps = {
  road: RoadId;
  positionSec: number;
};

function SceneContent({ road, positionSec }: RideSceneProps) {
  return (
    <>
      {/* Back-seat camera: position inside car, looking toward -Y (windshield) */}
      {/* Camera is set on the Canvas element below */}

      {/* Lighting */}
      <ambientLight intensity={road === 'city' ? 0.3 : 1.2} />
      <directionalLight
        position={road === 'city' ? [0, 5, -2] : [3, 8, -5]}
        intensity={road === 'city' ? 0.5 : 1.5}
        color={road === 'desert' ? '#ffcc88' : '#ffffff'}
        castShadow
      />
      {road === 'city' && <pointLight position={[0, 0, 0]} color="#6644ff" intensity={0.5} />}

      {/* Sky background */}
      <color attach="background" args={[
        road === 'desert'   ? '#1a1040' :
        road === 'coast'    ? '#87ceeb' :
        road === 'mountain' ? '#1a2a4a' : '#0d0d1a'
      ]} />

      {/* The Cicada car — camera sits inside it */}
      <Suspense fallback={null}>
        <CicadaCar />
      </Suspense>

      {/* World scrolling toward camera */}
      <World road={road} positionSec={positionSec} />
    </>
  );
}

export default function RideScene({ road, positionSec }: RideSceneProps) {
  return (
    <Canvas
      camera={{
        position: [0, 1.5, 0],       // back seat of Cicada
        up: [0, 0, 1],               // Z is up in this model's space
        fov: 75,
        near: 0.01,
        far: 300,
      }}
      onCreated={({ camera }) => {
        // Look toward front of car (-Y direction)
        camera.lookAt(0, -10, 0);
      }}
      shadows
      style={{ position: 'absolute', inset: 0 }}
    >
      <SceneContent road={road} positionSec={positionSec} />
    </Canvas>
  );
}

useGLTF.preload('/assets/cars/cicada_retro_cartoon_car.glb');
