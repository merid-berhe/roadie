// Front-seat occupant silhouettes — anonymous, tinted to glyph colour (§6/§7).
// Uses real GLB character models, silhouetted via colour override on all materials.

import { useMemo, useEffect } from 'react';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import type { GestureKind } from '@roadie/shared';

const MALE_GLB   = '/assets/characters/psxprop_male_character_02_rigged.glb';
const FEMALE_GLB = '/assets/characters/russian_girl_west_animated.glb';

// Positions tuned to the Cicada car interior — back-seat camera at [0.05, 1.25, 0]
// X = forward (−X = car front), Y = up, Z = left/right (+Z = driver side)
// TUNE THESE in ?scene=1 then update here
const DRIVER_POS:    [number, number, number] = [-0.85, 0.15, 0.28];
const PASSENGER_POS: [number, number, number] = [-0.85, 0.15, -0.28];
const CHAR_SCALE = 0.45; // scale both characters to fit car interior

type OccupantProps = {
  glbPath: string;
  position: [number, number, number];
  color: string;
  scale?: number;
  rotationY?: number; // face forward (toward −X = car front)
};

function Occupant({ glbPath, position, color, scale = CHAR_SCALE, rotationY = 0 }: OccupantProps) {
  const { scene } = useGLTF(glbPath);

  // Clone so two instances don't share the same object
  const clone = useMemo(() => scene.clone(true), [scene]);

  // Log bounding box so we can determine correct scale
  useEffect(() => {
    const box = new THREE.Box3().setFromObject(clone);
    const size = box.getSize(new THREE.Vector3());
    console.log(`[char] ${glbPath.split('/').pop()} size:`, size);
  }, [clone, glbPath]);

  // Override all materials to a flat silhouette tinted to the rider's colour
  useEffect(() => {
    const tint = new THREE.Color(color);
    clone.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        // Replace with a simple standard material — no texture, just colour
        mesh.material = new THREE.MeshStandardMaterial({
          color: tint,
          roughness: 0.9,
          metalness: 0.05,
        });
        mesh.castShadow = true;
      }
    });
  }, [clone, color]);

  return (
    <primitive
      object={clone}
      position={position}
      scale={scale}
      rotation={[0, rotationY, 0]}
    />
  );
}

export type CharactersProps = {
  driverColor: string;
  passengerColor: string;
  driverGestureKind?: GestureKind | null;
  passengerGestureKind?: GestureKind | null;
};

export default function Characters({ driverColor, passengerColor }: CharactersProps) {
  return (
    <>
      {/* Driver — male, sits left (+Z side), faces forward (−X) */}
      <Occupant
        glbPath={MALE_GLB}
        position={DRIVER_POS}
        color={driverColor}
        rotationY={-Math.PI / 2} // rotate to face −X (car front)
      />
      {/* Passenger — female, sits right (−Z side), faces forward (−X) */}
      <Occupant
        glbPath={FEMALE_GLB}
        position={PASSENGER_POS}
        color={passengerColor}
        rotationY={-Math.PI / 2}
      />
    </>
  );
}

useGLTF.preload(MALE_GLB);
useGLTF.preload(FEMALE_GLB);
