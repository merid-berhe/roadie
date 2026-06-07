// Programmatic front-seat silhouettes — proper human proportions, tinted to glyph colour.
// §6/§7: anonymous, no faces, no customisation. Gesture animations: wave, heart.

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { GestureKind } from '@roadie/shared';

// Camera at [0.05, 1.25, 0] looking toward −X. Characters sit ahead in the front seats.
// X = depth (−X = car front), Y = up, Z = left/right (+Z = driver side).
const DRIVER_POS:    [number, number, number] = [-0.85, 0.88, 0.28];
const PASSENGER_POS: [number, number, number] = [-0.85, 0.88, -0.28];

type OccupantProps = {
  position: [number, number, number];
  color: string;
  gestureKind?: GestureKind | null;
  side: 'driver' | 'passenger';
};

function useMat(color: string) {
  return useMemo(() => new THREE.MeshStandardMaterial({
    color: new THREE.Color(color),
    roughness: 0.85,
    metalness: 0.0,
  }), [color]);
}

const SEAT_MAT = new THREE.MeshStandardMaterial({ color: '#160808', roughness: 1 });

function Occupant({ position, color, gestureKind, side }: OccupantProps) {
  const mat          = useMat(color);
  const shoulderRef  = useRef<THREE.Group>(null);
  const headRef      = useRef<THREE.Group>(null);
  const armRef       = useRef<THREE.Group>(null);
  const phaseOffset  = side === 'driver' ? 0 : 1.3;
  const winZ         = side === 'driver' ? 1 : -1; // window direction in Z

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();

    // Subtle idle breathing on the shoulders
    if (shoulderRef.current) {
      const b = 1 + Math.sin(t * 0.85 + phaseOffset) * 0.007;
      shoulderRef.current.scale.set(b, 1, b);
    }

    // Heart — gentle rhythmic head sway
    if (headRef.current) {
      headRef.current.rotation.z = gestureKind === 'heart'
        ? Math.sin(t * 2.2) * 0.09
        : headRef.current.rotation.z * 0.88;
    }

    // Wave — arm raises and waves from the window side
    if (armRef.current) {
      armRef.current.visible = gestureKind === 'wave';
      if (gestureKind === 'wave') {
        armRef.current.rotation.x = -(Math.PI * 0.45 + Math.sin(t * 5.5) * 0.38);
      }
    }
  });

  return (
    <group position={position}>
      {/* Seat back — dark plane anchors the figure, implies they're seated */}
      <mesh position={[0.07, -0.32, 0]}>
        <boxGeometry args={[0.06, 0.68, 0.44]} />
        <primitive object={SEAT_MAT} attach="material" />
      </mesh>

      {/* ── HEAD ─────────────────────────────────────── */}
      <group ref={headRef}>
        {/* Cranium — slightly tall oval */}
        <mesh scale={[0.96, 1.06, 0.93]} material={mat}>
          <sphereGeometry args={[0.105, 24, 18]} />
        </mesh>
        {/* Hair volume — sits on top/back, gives crown */}
        <mesh position={[0.01, 0.048, 0]} scale={[1.0, 0.78, 0.90]} material={mat}>
          <sphereGeometry args={[0.108, 18, 14]} />
        </mesh>
        {/* Left ear */}
        <mesh position={[0, -0.012, 0.092]} scale={[0.52, 0.66, 0.36]} material={mat}>
          <sphereGeometry args={[0.054, 10, 7]} />
        </mesh>
        {/* Right ear */}
        <mesh position={[0, -0.012, -0.092]} scale={[0.52, 0.66, 0.36]} material={mat}>
          <sphereGeometry args={[0.054, 10, 7]} />
        </mesh>
      </group>

      {/* ── NECK ─────────────────────────────────────── */}
      <mesh position={[0, -0.148, 0]} material={mat}>
        <cylinderGeometry args={[0.030, 0.042, 0.092, 12]} />
      </mesh>

      {/* ── SHOULDERS ────────────────────────────────── */}
      {/* The dominant readable shape — wide ellipsoid */}
      <group ref={shoulderRef}>
        <mesh position={[0, -0.245, 0]} scale={[0.84, 0.56, 0.72]} material={mat}>
          <sphereGeometry args={[0.32, 20, 14]} />
        </mesh>
      </group>

      {/* ── TORSO ────────────────────────────────────── */}
      <mesh position={[0, -0.385, 0]} scale={[0.70, 0.52, 0.62]} material={mat}>
        <sphereGeometry args={[0.28, 16, 12]} />
      </mesh>
      {/* Lower torso — tapers, fades into seat */}
      <mesh position={[0, -0.51, 0]} scale={[0.58, 0.46, 0.54]} material={mat}>
        <sphereGeometry args={[0.24, 14, 10]} />
      </mesh>

      {/* ── WAVE ARM ─────────────────────────────────── */}
      {/* Hangs from window-side shoulder, rotates around local X to raise */}
      <group
        ref={armRef}
        position={[0.02, -0.22, winZ * 0.24]}
        rotation={[0, 0, winZ * (Math.PI / 5.5)]}
        visible={false}
      >
        {/* Upper arm */}
        <mesh position={[0, -0.11, 0]} material={mat}>
          <cylinderGeometry args={[0.038, 0.032, 0.22, 10]} />
        </mesh>
        {/* Forearm */}
        <mesh position={[0, -0.27, winZ * 0.06]} rotation={[winZ * 0.3, 0, 0]} material={mat}>
          <cylinderGeometry args={[0.030, 0.025, 0.18, 10]} />
        </mesh>
        {/* Hand */}
        <mesh position={[0, -0.37, winZ * 0.09]} material={mat}>
          <sphereGeometry args={[0.042, 10, 7]} />
        </mesh>
      </group>
    </group>
  );
}

export type CharactersProps = {
  driverColor: string;
  passengerColor: string;
  driverGestureKind?: GestureKind | null;
  passengerGestureKind?: GestureKind | null;
};

export default function Characters({
  driverColor, passengerColor,
  driverGestureKind, passengerGestureKind,
}: CharactersProps) {
  return (
    <>
      <Occupant position={DRIVER_POS}    color={driverColor}    gestureKind={driverGestureKind}    side="driver"    />
      <Occupant position={PASSENGER_POS} color={passengerColor} gestureKind={passengerGestureKind} side="passenger" />
    </>
  );
}
