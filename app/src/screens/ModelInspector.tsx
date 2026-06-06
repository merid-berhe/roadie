// Temporary model inspector — lets us see the GLB and find the right camera position.
// Route: ?inspect=1 in the URL. Remove this screen after camera position is decided.
import { Suspense, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, useGLTF, Grid, GizmoHelper, GizmoViewport, Html } from '@react-three/drei';
import * as THREE from 'three';

function CarModel() {
  const { scene } = useGLTF('/assets/cars/cicada_retro_cartoon_car.glb');
  return <primitive object={scene} />;
}

// Coloured axis arrows: Red=+X  Green=+Y  Blue=+Z
function AxisArrows() {
  return <primitive object={new THREE.AxesHelper(3)} />;
}

function CameraMarker({ pos }: { pos: [number, number, number] }) {
  return (
    <mesh position={pos}>
      <sphereGeometry args={[0.05]} />
      <meshBasicMaterial color="red" />
    </mesh>
  );
}

export default function ModelInspector() {
  const [camPos, setCamPos] = useState<[number, number, number]>([0, 1.2, 0.8]);

  return (
    <div className="flex h-screen flex-col bg-[#0d0d1a]">
      {/* Controls */}
      <div className="flex items-center gap-4 bg-black/60 px-4 py-2 text-xs text-white/70">
        <span className="font-semibold text-white">GLB Inspector</span>
        <span>orbit: left drag · zoom: scroll · pan: right drag</span>
        <span className="ml-auto">camera marker (red sphere):</span>
        {(['x','y','z'] as const).map((axis, i) => (
          <label key={axis} className="flex items-center gap-1">
            {axis}
            <input
              type="number" step="0.1"
              value={camPos[i]}
              onChange={(e) => {
                const n = [...camPos] as [number, number, number];
                n[i] = parseFloat(e.target.value) || 0;
                setCamPos(n);
              }}
              className="w-16 rounded bg-white/10 px-1 py-0.5 text-white"
            />
          </label>
        ))}
      </div>

      {/* 3D viewport */}
      <div className="flex-1">
        <Canvas camera={{ position: [3, 2, 4], fov: 60 }} shadows>
          <ambientLight intensity={1.5} />
          <directionalLight position={[5, 10, 5]} intensity={2} castShadow />

          {/* Axis arrows: RED=+X  GREEN=+Y  BLUE=+Z */}
          <AxisArrows />

          <Suspense fallback={
            <Html center><p className="text-white text-sm">loading model…</p></Html>
          }>
            <CarModel />
          </Suspense>

          {/* Red sphere = where the back-seat camera would be */}
          <CameraMarker pos={camPos} />

          <Grid
            args={[20, 20]}
            cellColor="#333"
            sectionColor="#555"
            fadeDistance={15}
          />
          <OrbitControls makeDefault />
          <GizmoHelper alignment="bottom-right" margin={[80, 80]}>
            <GizmoViewport />
          </GizmoHelper>
        </Canvas>
      </div>

      <div className="bg-black/60 px-4 py-2 text-xs text-white/50">
        Move the X/Y/Z sliders to position the red sphere where the back-seat camera should sit.
        Note the coordinates — that becomes the camera position in the ride scene.
      </div>
    </div>
  );
}

useGLTF.preload('/assets/cars/cicada_retro_cartoon_car.glb');
