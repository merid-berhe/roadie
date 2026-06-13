// v6.5 SPIKE — "how far can the web take it": the imported Hong Kong city with
// real rendering (ACES tonemapping, a shadow-casting sun, ambient + fog) and a
// DRIVABLE car (arrow keys / WASD, chase cam) so it feels explorable. A glowing
// beacon marks the future "bar" where a location's songs would play. Reached at
// ?city=1. Keeps the current cartoon car (cohesion pass comes later).
import { useEffect, useRef } from 'react';
import * as pc from 'playcanvas';

const CITY_URL = '/assets/scene/full_gameready_city_buildings_iv_hongkong.glb';
const SKY = 0xa9c7d8;
const CAR_WIDTH = 0.6; // world units — the city is modelled small (buildings ~4u)

export default function DriveCity() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const app = new pc.Application(canvas, {
      graphicsDeviceOptions: { alpha: false, antialias: true, powerPreference: 'high-performance' },
      keyboard: new pc.Keyboard(window),
    });
    app.setCanvasFillMode(pc.FILLMODE_NONE);
    app.setCanvasResolution(pc.RESOLUTION_AUTO);
    app.graphicsDevice.maxPixelRatio = Math.min(window.devicePixelRatio, 1.75);
    const resize = () => app.resizeCanvas(canvas.clientWidth, canvas.clientHeight);

    // --- rendering: the bits we never turned on
    app.scene.ambientLight = color(0x9fb6c4, 0.9);
    app.scene.exposure = 1.1;
    app.scene.fog.type = pc.FOG_LINEAR;
    app.scene.fog.color = color(SKY, 1);
    app.scene.fog.start = 18;
    app.scene.fog.end = 75; // haze fades the city edges → feels less finite

    const camera = new pc.Entity('camera');
    camera.addComponent('camera', { clearColor: color(SKY, 1), fov: 60, nearClip: 0.05, farClip: 400 });
    camera.camera!.toneMapping = pc.TONEMAP_ACES;
    app.root.addChild(camera);

    const sun = new pc.Entity('sun');
    sun.addComponent('light', {
      type: 'directional',
      color: color(0xfff1d6, 1),
      intensity: 3.2,
      castShadows: true,
      shadowType: pc.SHADOW_PCF5,
      shadowResolution: 2048,
      shadowDistance: 60,
      shadowBias: 0.04,
      normalOffsetBias: 0.05,
      shadowIntensity: 0.7,
    });
    sun.setEulerAngles(52, 28, 0);
    app.root.addChild(sun);

    const fill = new pc.Entity('fill');
    fill.addComponent('light', { type: 'directional', color: color(0x9fc2d6, 1), intensity: 0.9 });
    fill.setEulerAngles(-12, -150, 0);
    app.root.addChild(fill);

    // --- the city
    let groundY = 0;
    const cMin = new pc.Vec3(-9999, 0, -9999);
    const cMax = new pc.Vec3(9999, 0, 9999);
    const cityAsset = new pc.Asset('city', 'container', { url: CITY_URL });
    cityAsset.on('load', () => {
      const root = new pc.Entity('city');
      app.root.addChild(root);
      root.addChild((cityAsset.resource as pc.ContainerResource).instantiateRenderEntity());
      const aabb = new pc.BoundingBox();
      let first = true;
      for (const rc of root.findComponents('render') as pc.RenderComponent[]) {
        rc.castShadows = true;
        rc.receiveShadows = true;
        for (const mi of rc.meshInstances) { if (first) { aabb.copy(mi.aabb); first = false; } else aabb.add(mi.aabb); }
      }
      if (!first) {
        groundY = aabb.getMin().y;
        cMin.copy(aabb.getMin()); cMax.copy(aabb.getMax());
      }
    });
    cityAsset.on('error', (e: string) => console.error('city load failed:', e));
    app.assets.add(cityAsset);
    app.assets.load(cityAsset);

    // --- the car (kinematic drive)
    const carRig = new pc.Entity('car-rig');
    carRig.setPosition(2, 0, 3);
    app.root.addChild(carRig);
    let carYaw = -Math.PI / 2; // face into the block (−x)
    let speed = 0;        // units / sec
    const carTilt = new pc.Entity('car-tilt');
    carRig.addChild(carTilt);
    const carAsset = new pc.Asset('car', 'container', { url: '/assets/cars/cicada_flat.glb' });
    carAsset.on('load', () => {
      const holder = new pc.Entity('car-holder');
      holder.setLocalEulerAngles(0, 90, 0);
      carTilt.addChild(holder);
      holder.addChild((carAsset.resource as pc.ContainerResource).instantiateRenderEntity());
      const aabb = new pc.BoundingBox();
      let first = true;
      for (const rc of holder.findComponents('render') as pc.RenderComponent[]) {
        rc.castShadows = true; rc.receiveShadows = true;
        for (const mi of rc.meshInstances) { if (first) { aabb.copy(mi.aabb); first = false; } else aabb.add(mi.aabb); }
      }
      const rigPos = carTilt.getPosition().clone();
      const c = aabb.center.clone(), min = aabb.getMin().clone();
      const s = CAR_WIDTH / (aabb.halfExtents.x * 2);
      holder.setLocalScale(s, s, s);
      holder.setLocalPosition(-(c.x - rigPos.x) * s, -(min.y - rigPos.y) * s, -(c.z - rigPos.z) * s);
    });
    app.assets.add(carAsset);
    app.assets.load(carAsset);

    // --- discovery beacon: the future "bar" where this location's songs play
    const beacon = new pc.Entity('beacon');
    beacon.setPosition(4, 0, -3);
    app.root.addChild(beacon);
    const beam = primitive('beam', 'cylinder', [0, 3, 0], [0.5, 6, 0.5], glowMat(0xe6b23e, 0.32));
    beacon.addChild(beam);
    const ring = primitive('ring', 'cylinder', [0, 0.05, 0], [2.2, 0.02, 2.2], glowMat(0xffd874, 0.5));
    beacon.addChild(ring);

    // --- input
    const keys: Record<string, boolean> = {};
    const kd = (e: KeyboardEvent) => { keys[e.key.toLowerCase()] = true; if (['arrowup','arrowdown','arrowleft','arrowright',' '].includes(e.key.toLowerCase())) e.preventDefault(); };
    const ku = (e: KeyboardEvent) => { keys[e.key.toLowerCase()] = false; };
    window.addEventListener('keydown', kd);
    window.addEventListener('keyup', ku);

    const camPos = new pc.Vec3();
    let camInit = false;
    const tmp = new pc.Vec3();
    let t = 0;

    app.on('update', (dt: number) => {
      t += dt;
      const accel = (keys['arrowup'] || keys['w'] ? 1 : 0) - (keys['arrowdown'] || keys['s'] ? 1 : 0);
      const steer = (keys['arrowleft'] || keys['a'] ? 1 : 0) - (keys['arrowright'] || keys['d'] ? 1 : 0);
      // longitudinal: accelerate / coast-friction (slow cruise — the block is small)
      speed += accel * 4 * dt;
      speed *= 1 - Math.min(1, (accel === 0 ? 2.2 : 0.6) * dt);
      speed = Math.max(-1.4, Math.min(2.8, speed));
      // steer scales with motion
      carYaw += steer * 1.8 * dt * Math.max(0.15, Math.min(1, Math.abs(speed) / 2)) * Math.sign(speed || 1);
      const fx = Math.sin(carYaw), fz = Math.cos(carYaw);
      const p = carRig.getPosition();
      // clamp to the city footprint so you can't drive off into the void
      const nx = Math.max(cMin.x + 1, Math.min(cMax.x - 1, p.x + fx * speed * dt));
      const nz = Math.max(cMin.z + 1, Math.min(cMax.z - 1, p.z + fz * speed * dt));
      carRig.setPosition(nx, groundY, nz);
      carRig.setEulerAngles(0, (carYaw * 180) / Math.PI, 0);
      carTilt.setLocalEulerAngles(0, 0, -steer * Math.min(1, Math.abs(speed) / 4) * 5);

      // chase cam
      const here = carRig.getPosition();
      const desired = tmp.set(here.x - fx * 4.5, groundY + 2.4, here.z - fz * 4.5);
      if (!camInit) { camPos.copy(desired); camInit = true; } else camPos.lerp(camPos, desired, Math.min(1, dt * 4));
      camera.setPosition(camPos);
      camera.lookAt(here.x + fx * 3, groundY + 0.7, here.z + fz * 3);

      // beacon pulse
      const pulse = 0.4 + Math.sin(t * 2.2) * 0.12;
      (ring.render!.meshInstances[0].material as pc.StandardMaterial).opacity = pulse;
      ring.setLocalScale(2.2 + Math.sin(t * 2.2) * 0.3, 0.02, 2.2 + Math.sin(t * 2.2) * 0.3);
    });

    app.start();
    resize();
    window.addEventListener('resize', resize);
    return () => {
      window.removeEventListener('resize', resize);
      window.removeEventListener('keydown', kd);
      window.removeEventListener('keyup', ku);
      app.destroy();
    };
  }, []);

  return <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" style={{ touchAction: 'none' }} tabIndex={0} />;
}

function color(hex: number, intensity = 1) {
  return new pc.Color(((hex >> 16) & 255) / 255 * intensity, ((hex >> 8) & 255) / 255 * intensity, (hex & 255) / 255 * intensity, 1);
}
function glowMat(hex: number, opacity: number) {
  const m = new pc.StandardMaterial();
  m.useLighting = false; m.useFog = false;
  m.diffuse = new pc.Color(0, 0, 0);
  m.emissive = color(hex, 1);
  m.opacity = opacity;
  m.blendType = pc.BLEND_ADDITIVE;
  m.depthWrite = false;
  m.update();
  return m;
}
function primitive(name: string, type: 'box' | 'sphere' | 'cone' | 'cylinder', pos: [number, number, number], scale: [number, number, number], material: pc.Material) {
  const e = new pc.Entity(name);
  e.addComponent('render', { type, material });
  e.setLocalPosition(pos[0], pos[1], pos[2]);
  e.setLocalScale(scale[0], scale[1], scale[2]);
  return e;
}
