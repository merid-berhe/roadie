import { Suspense, useState, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, useGLTF, GizmoHelper, GizmoViewport, Html } from '@react-three/drei';
import * as THREE from 'three';

// Live camera position tracker
function CameraTracker({ onUpdate }: { onUpdate: (info: string) => void }) {
  const { camera, scene: _ } = useThree();
  const controls = useRef<{ target: THREE.Vector3 } | null>(null);
  useFrame(() => {
    const p = camera.position;
    onUpdate(
      `cam [${p.x.toFixed(2)}, ${p.y.toFixed(2)}, ${p.z.toFixed(2)}]`
    );
  });
  return null;
}

function CarModel({ rotation }: { rotation: [number, number, number] }) {
  const { scene } = useGLTF('/assets/cars/cicada_retro_cartoon_car.glb');
  return <primitive object={scene} rotation={rotation} />;
}

function RoadTerrain({ y }: { y: number }) {
  const { scene } = useGLTF('/assets/scene/road_terrain.glb');
  return <primitive object={scene} scale={0.01} position={[-5.12, y, 0.04]} />;
}

function MaleChar() {
  const { scene } = useGLTF('/assets/characters/psxprop_male_character_02_rigged.glb');
  return <primitive object={scene} position={[0, 0, 1.5]} />;
}

function FemaleChar() {
  const { scene } = useGLTF('/assets/characters/russian_girl_west_animated.glb');
  return <primitive object={scene} position={[0, 0, -1.5]} />;
}

function CameraMarker({ pos }: { pos: [number, number, number] }) {
  return (
    <mesh position={pos}>
      <sphereGeometry args={[0.05]} />
      <meshBasicMaterial color="red" />
    </mesh>
  );
}

function AxisArrows() {
  return <primitive object={new THREE.AxesHelper(3)} />;
}

export default function ModelInspector() {
  const [rot,    setRot]    = useState<[number, number, number]>([0, 0, 0]);
  const [camPos, setCamPos] = useState<[number, number, number]>([0, 1.2, 0.8]);
  const [terrainY, setTerrainY] = useState(-3.1);
  const [liveInfo, setLiveInfo] = useState('');

  return (
    <div className="flex h-screen flex-col bg-[#0d0d1a]">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3 bg-black/60 px-4 py-2 text-xs text-white/70">
        <span className="font-semibold text-white">GLB Inspector</span>
        <span className="text-white/30">orbit: drag · zoom: scroll</span>

        <span className="ml-2 text-white/50">model rot (×π/2):</span>
        {(['x','y','z'] as const).map((axis, i) => (
          <label key={axis} className="flex items-center gap-1">
            {axis}
            <input type="number" step="1" value={Math.round(rot[i] / (Math.PI/2))}
              onChange={(e) => {
                const n = [...rot] as [number, number, number];
                n[i] = (parseFloat(e.target.value) || 0) * Math.PI / 2;
                setRot(n);
              }}
              className="w-12 rounded bg-white/10 px-1 py-0.5 text-white"
            />
          </label>
        ))}

        <span className="ml-2 text-white/50">terrain Y:</span>
        <input type="number" step="0.1" value={terrainY}
          onChange={(e) => setTerrainY(parseFloat(e.target.value) || 0)}
          className="w-20 rounded bg-white/10 px-1 py-0.5 text-white"
        />

        <span className="ml-2 text-white/50">cam marker:</span>
        {(['x','y','z'] as const).map((axis, i) => (
          <label key={axis} className="flex items-center gap-1">
            {axis}
            <input type="number" step="0.1" value={camPos[i]}
              onChange={(e) => {
                const n = [...camPos] as [number, number, number];
                n[i] = parseFloat(e.target.value) || 0;
                setCamPos(n);
              }}
              className="w-16 rounded bg-white/10 px-1 py-0.5 text-white"
            />
          </label>
        ))}

        {/* Live camera position */}
        <span className="ml-auto font-mono text-amber-400">{liveInfo}</span>
      </div>

      {/* 3D viewport */}
      <div className="flex-1">
        <Canvas camera={{ position: [3, 2, 4], fov: 60 }} shadows>
          <ambientLight intensity={1.5} />
          <directionalLight position={[5, 10, 5]} intensity={2} />

          <CameraTracker onUpdate={setLiveInfo} />

          <AxisArrows />

          <Suspense fallback={<Html center><p className="text-white text-sm">loading…</p></Html>}>
            <CarModel rotation={rot} />
            <RoadTerrain y={terrainY} />
            {/* Characters shown at Z offset from car — scale 1 so we see native size/pose */}
            <MaleChar />
            <FemaleChar />
          </Suspense>

          <CameraMarker pos={camPos} />

          <OrbitControls makeDefault />
          <GizmoHelper alignment="bottom-right" margin={[80, 80]}>
            <GizmoViewport />
          </GizmoHelper>
        </Canvas>
      </div>

      <div className="bg-black/60 px-4 py-1 text-xs text-white/40">
        Adjust <b className="text-white/60">terrain Y</b> until car wheels sit on road · <b className="text-white/60">cam marker</b> = back-seat camera position · <b className="text-amber-400">live cam</b> shows inspector camera coords
      </div>
    </div>
  );
}

useGLTF.preload('/assets/cars/cicada_retro_cartoon_car.glb');
useGLTF.preload('/assets/scene/road_terrain.glb');
