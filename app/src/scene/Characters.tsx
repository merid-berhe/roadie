// Front-seat occupant silhouettes — anonymous, tinted to glyph colour (§6/§7).
// No faces, no customisation. Gesture animations: wave, heart, headlights.

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { GestureKind } from '@roadie/shared';

type Props = {
  position: [number, number, number];
  color: string;
  gestureKind?: GestureKind | null;
  side: 'driver' | 'passenger'; // which side — affects arm direction
};

function Occupant({ position, color, gestureKind, side }: Props) {
  const groupRef = useRef<THREE.Group>(null);
  const headRef  = useRef<THREE.Mesh>(null);
  const armRef   = useRef<THREE.Group>(null);

  const mat = useMemo(() => new THREE.MeshStandardMaterial({
    color: new THREE.Color(color),
    roughness: 0.88,
    metalness: 0.05,
  }), [color]);

  const HEAD_R = 0.11;
  const NECK_H = 0.09;
  const armDir = side === 'driver' ? -1 : 1; // arm raises on window side

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();

    // Subtle idle breathing — very gentle, makes them feel present
    if (groupRef.current) {
      groupRef.current.position.y = position[1] + Math.sin(t * 0.7 + (side === 'driver' ? 0 : 1.2)) * 0.005;
    }

    // Wave — arm swings up from shoulder
    if (armRef.current) {
      const waving = gestureKind === 'wave';
      armRef.current.visible = waving;
      if (waving) {
        armRef.current.rotation.z = armDir * (Math.PI * 0.25 + Math.sin(t * 6) * 0.35);
      }
    }

    // Heart — gentle forward head lean
    if (headRef.current) {
      headRef.current.rotation.x = gestureKind === 'heart'
        ? -0.15 + Math.sin(t * 2.5) * 0.06
        : THREE.MathUtils.lerp(headRef.current.rotation.x, 0, 0.05);
    }
  });

  return (
    <group ref={groupRef} position={position}>
      {/* Head */}
      <mesh ref={headRef} material={mat}>
        <sphereGeometry args={[HEAD_R, 16, 12]} />
      </mesh>

      {/* Neck */}
      <mesh position={[0, -HEAD_R - NECK_H / 2, 0]} material={mat}>
        <cylinderGeometry args={[0.032, 0.038, NECK_H, 8]} />
      </mesh>

      {/* Shoulders — wide ellipsoid */}
      <mesh position={[0, -HEAD_R - NECK_H - 0.1, 0]} scale={[0.24, 0.15, 0.17]} material={mat}>
        <sphereGeometry args={[1, 12, 8]} />
      </mesh>

      {/* Upper torso visible above seat back */}
      <mesh position={[0, -HEAD_R - NECK_H - 0.22, 0]} scale={[0.18, 0.14, 0.15]} material={mat}>
        <sphereGeometry args={[1, 10, 7]} />
      </mesh>

      {/* Wave arm — only visible during gesture */}
      <group ref={armRef} position={[armDir * 0.22, -HEAD_R - NECK_H - 0.05, 0]} visible={false}>
        <mesh material={mat}>
          <cylinderGeometry args={[0.03, 0.025, 0.22, 6]} />
        </mesh>
        {/* Hand */}
        <mesh position={[0, 0.13, 0]} material={mat}>
          <sphereGeometry args={[0.042, 8, 6]} />
        </mesh>
      </group>
    </group>
  );
}

type CharactersProps = {
  driverColor: string;
  passengerColor: string;
  driverGestureKind?: GestureKind | null;
  passengerGestureKind?: GestureKind | null;
};

// Positions tuned to the Cicada car interior from back-seat camera at [0.05, 1.25, 0]
// X = forward (-X = car front), Y = up, Z = left/right (+Z = driver side)
const DRIVER_POS:    [number, number, number] = [-0.85, 0.88, 0.28];
const PASSENGER_POS: [number, number, number] = [-0.85, 0.88, -0.28];

export default function Characters({
  driverColor, passengerColor,
  driverGestureKind, passengerGestureKind,
}: CharactersProps) {
  return (
    <>
      <Occupant
        position={DRIVER_POS}
        color={driverColor}
        gestureKind={driverGestureKind}
        side="driver"
      />
      <Occupant
        position={PASSENGER_POS}
        color={passengerColor}
        gestureKind={passengerGestureKind}
        side="passenger"
      />
    </>
  );
}
