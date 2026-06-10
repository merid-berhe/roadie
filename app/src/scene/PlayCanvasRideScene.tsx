// Low-poly flat-shaded ride scene — the default player renderer.
// Art direction: gradient sky dome, faceted terrain, composed theme props,
// fog that melts into the horizon. Alto's-Odyssey-adjacent, not Minecraft-literal.

import { useEffect, useRef } from 'react';
import * as pc from 'playcanvas';
import type { GestureKind } from '@roadie/shared';
import type { RoadId } from './scenes';

type Props = {
  road: RoadId;
  positionSec: number;
  driverColor: string;
  passengerColor: string;
  driverGestureKind?: GestureKind | null;
  passengerGestureKind?: GestureKind | null;
  firework?: { synced: boolean } | null;
};

const FAR = 234;          // world tile length (z)
const CELL = 6;           // terrain row length
const ROWS = FAR / CELL;  // 39
const WORLD_SPEED = 7;
const ROAD_TOP = -0.57;   // y of the road surface
const CAR_Z = -1.0;       // the hero car sits here, facing +z
const BAND = FAR / 2;     // props live in z ∈ [−BAND, +BAND] around the car (the camera orbits)
const ORBIT_SECONDS = 48; // one slow cinematic revolution
const TERRAIN_AHEAD = 220;

type Theme = {
  skyTop: number;
  skyBand: number;
  skyHorizon: number;
  fog: number;
  fogStart: number;
  fogEnd: number;
  ambient: number;
  ambientIntensity: number;
  sun: { color: number; intensity: number; euler: [number, number] };
  fill: { color: number; intensity: number; euler: [number, number] };
  disc?: { color: number; glow: number; x: number; y: number; scale: number; glowO: number; haloO: number };
  stars: number;
  clouds: { count: number; color: number };
  road: number;
  lane: number;
  edge: number;
  shoulder: number;
  ground: number;
  groundAlt: number;
  backdrop: { style: 'mesa' | 'ridge' | 'peaks' | 'skyline'; near: number; far: number };
};

const THEMES: Record<RoadId, Theme> = {
  desert: {
    skyTop: 0x2a1e5c, skyBand: 0xd96a4e, skyHorizon: 0xffa05a,
    fog: 0xdf7a50, fogStart: 60, fogEnd: 215,
    ambient: 0x9a6a80, ambientIntensity: 0.6,
    sun: { color: 0xffb066, intensity: 1.7, euler: [14, -42] },
    fill: { color: 0x6a5aa0, intensity: 0.5, euler: [40, 140] },
    disc: { color: 0xffae54, glow: 0xff7b3a, x: -34, y: 13, scale: 9, glowO: 0.08, haloO: 0.05 },
    stars: 50,
    clouds: { count: 4, color: 0xea9a78 },
    road: 0x3a3136, lane: 0xf4c95d, edge: 0xd9d3c8, shoulder: 0x7a5234,
    ground: 0xc1773c, groundAlt: 0xb06a34,
    backdrop: { style: 'mesa', near: 0x96503a, far: 0xb5654a },
  },
  coast: {
    skyTop: 0x3f8fd2, skyBand: 0xa8dcea, skyHorizon: 0xeef7e8,
    fog: 0xcfe8e6, fogStart: 75, fogEnd: 225,
    ambient: 0x9fc3d0, ambientIntensity: 0.62,
    sun: { color: 0xfff2cf, intensity: 1.9, euler: [42, 28] },
    fill: { color: 0x6f9fc0, intensity: 0.45, euler: [35, -140] },
    disc: { color: 0xfff8e0, glow: 0xfff3c4, x: 42, y: 58, scale: 5.5, glowO: 0.05, haloO: 0 },
    stars: 0,
    clouds: { count: 7, color: 0xfbfdfd },
    road: 0x3b4046, lane: 0xf6f7f2, edge: 0xe8e2d2, shoulder: 0x8a6a45,
    ground: 0x6f9a4e, groundAlt: 0x638b46,
    backdrop: { style: 'ridge', near: 0x88aa9a, far: 0xa5c4c2 },
  },
  mountain: {
    skyTop: 0x35597f, skyBand: 0x9dbdd2, skyHorizon: 0xe4eef2,
    fog: 0xb9cdd9, fogStart: 42, fogEnd: 205,
    ambient: 0x9fb4c6, ambientIntensity: 0.6,
    sun: { color: 0xeef4ff, intensity: 1.6, euler: [38, -32] },
    fill: { color: 0x5a7a9a, intensity: 0.45, euler: [40, 150] },
    disc: { color: 0xf6fafc, glow: 0xdceaf2, x: -38, y: 52, scale: 4.5, glowO: 0.05, haloO: 0 },
    stars: 0,
    clouds: { count: 6, color: 0xe8f0f4 },
    road: 0x2f3338, lane: 0xe8edf2, edge: 0xc8d0d6, shoulder: 0x4f463c,
    ground: 0x4c7050, groundAlt: 0x426347,
    backdrop: { style: 'peaks', near: 0x7e93a8, far: 0x9fb6c8 },
  },
  city: {
    skyTop: 0x070914, skyBand: 0x2c1a44, skyHorizon: 0x5c2c54,
    fog: 0x241836, fogStart: 36, fogEnd: 190,
    ambient: 0x4e4a6a, ambientIntensity: 0.55,
    sun: { color: 0xa9c0e8, intensity: 0.75, euler: [48, 32] },
    fill: { color: 0xff9a5e, intensity: 0.3, euler: [20, -120] },
    disc: { color: 0xe8ecf2, glow: 0x8a92b8, x: -30, y: 56, scale: 5, glowO: 0.08, haloO: 0.04 },
    stars: 90,
    clouds: { count: 0, color: 0 },
    road: 0x16161d, lane: 0xf2c14e, edge: 0x3c3e52, shoulder: 0x20222c,
    ground: 0x14151d, groundAlt: 0x121219,
    backdrop: { style: 'skyline', near: 0x16142a, far: 0x251c40 },
  },
};

type MovingEntity = { entity: pc.Entity; base: number; x: number; y: number; fade?: boolean };
type Drifter = { entity: pc.Entity; x: number; y: number; z: number; speed: number };
type Bobber = { entity: pc.Entity; x: number; y: number; phase: number; amp: number };

export default function PlayCanvasRideScene({
  road,
  positionSec,
  driverColor,
  passengerColor,
  driverGestureKind,
  passengerGestureKind,
  firework,
}: Props) {
  const mountRef = useRef<HTMLDivElement>(null);
  const positionRef = useRef(positionSec);
  const driverColorRef = useRef(driverColor);
  const passengerColorRef = useRef(passengerColor);
  const driverGestureRef = useRef(driverGestureKind);
  const passengerGestureRef = useRef(passengerGestureKind);
  const fireworkRef = useRef(firework);

  useEffect(() => { positionRef.current = positionSec; }, [positionSec]);
  useEffect(() => { driverColorRef.current = driverColor; }, [driverColor]);
  useEffect(() => { passengerColorRef.current = passengerColor; }, [passengerColor]);
  useEffect(() => { driverGestureRef.current = driverGestureKind; }, [driverGestureKind]);
  useEffect(() => { passengerGestureRef.current = passengerGestureKind; }, [passengerGestureKind]);
  useEffect(() => { fireworkRef.current = firework; }, [firework]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const canvas = document.createElement('canvas');
    canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block';
    mount.appendChild(canvas);

    const app = new pc.Application(canvas, {
      graphicsDeviceOptions: {
        alpha: false,
        antialias: true,
        powerPreference: 'high-performance',
      },
    });

    const theme = THEMES[road];
    app.setCanvasFillMode(pc.FILLMODE_NONE);
    app.setCanvasResolution(pc.RESOLUTION_AUTO);
    app.graphicsDevice.maxPixelRatio = Math.min(window.devicePixelRatio, 1.75);
    app.scene.ambientLight = color(theme.ambient, theme.ambientIntensity);
    app.scene.fog.type = pc.FOG_LINEAR;
    app.scene.fog.color = color(theme.fog, 1);
    app.scene.fog.start = theme.fogStart;
    app.scene.fog.end = theme.fogEnd;

    // locked exterior camera: slightly elevated, looking at the car's front
    const camera = new pc.Entity('camera');
    camera.addComponent('camera', {
      clearColor: color(theme.skyTop, 1),
      fov: 52,
      nearClip: 0.05,
      farClip: 420,
    });
    // the camera orbits the car (see update loop); narrow viewports pull back
    let aspectK = 1;
    camera.setPosition(0, 1.7, CAR_Z + 5.8);
    camera.lookAt(0, 0.45, CAR_Z);
    app.root.addChild(camera);

    const sun = new pc.Entity('sun');
    sun.addComponent('light', { type: 'directional', color: color(theme.sun.color, 1), intensity: theme.sun.intensity, castShadows: false });
    sun.setEulerAngles(theme.sun.euler[0], theme.sun.euler[1], 0);
    app.root.addChild(sun);

    const fill = new pc.Entity('fill');
    fill.addComponent('light', { type: 'directional', color: color(theme.fill.color, 1), intensity: theme.fill.intensity, castShadows: false });
    fill.setEulerAngles(theme.fill.euler[0], theme.fill.euler[1], 0);
    app.root.addChild(fill);

    const moving: MovingEntity[] = [];
    const drifters: Drifter[] = [];
    const bobbers: Bobber[] = [];
    const gestures: pc.Entity[] = [];
    const fireworks: { entity: pc.Entity; vel: pc.Vec3; life: number }[] = [];
    let lastFirework = fireworkRef.current;

    createSky(app, theme);
    createBackdrop(app, theme, road);
    const heightAt = createTerrain(app, theme, road);
    createRoad(app, moving, theme);
    createThemeWorld(app, moving, drifters, bobbers, theme, road, heightAt);
    const carRig = createCar(app, driverColorRef.current, passengerColorRef.current, gestures);

    const resize = () => {
      const rect = mount.getBoundingClientRect();
      app.resizeCanvas(Math.max(1, rect.width), Math.max(1, rect.height));
      const aspect = rect.width / Math.max(1, rect.height);
      aspectK = aspect >= 1 ? 1 : 1 + (1 - aspect) * 1.1;
    };
    const observer = new ResizeObserver(resize);
    observer.observe(mount);
    resize();

    let elapsed = 0;
    app.on('update', (dt: number) => {
      elapsed += dt;
      const offset = positionRef.current * WORLD_SPEED;

      // world streams toward -z; props live in a band centred on the car so the
      // orbiting camera always has world in every direction. large props
      // scale-fade at the band edges instead of popping.
      for (const item of moving) {
        const z = -BAND + positiveMod(item.base - offset, FAR);
        item.entity.setLocalPosition(item.x, item.y, z);
        if (item.fade) {
          const f = Math.max(0.001, Math.min(1, (z + BAND) / 12, (BAND - z) / 12));
          item.entity.setLocalScale(f, f, f);
        }
      }

      // terrain tiles leapfrog so a seam never enters view
      const a = positiveMod(-offset, FAR) + TERRAIN_AHEAD;
      terrainTiles.forEach((tile, i) => tile.setLocalPosition(0, 0, a - i * FAR));

      for (const c of drifters) {
        c.x += c.speed * dt;
        if (c.x > 130) c.x = -130;
        c.entity.setLocalPosition(c.x, c.y, c.z);
      }
      for (const b of bobbers) {
        const pos = b.entity.getLocalPosition();
        b.entity.setLocalPosition(pos.x, b.y + Math.sin(elapsed * 1.4 + b.phase) * b.amp, pos.z);
        b.entity.setLocalEulerAngles(0, 0, Math.sin(elapsed * 1.1 + b.phase) * 3);
      }

      // slow cinematic orbit: low at the front/back, lifted at the sides to
      // clear roadside props. the car gets the life — gentle bob and roll.
      const th = (elapsed / ORBIT_SECONDS) * Math.PI * 2;
      const sx = Math.sin(th);
      // low cinematic shot at front/back, rising to a brief aerial beat at the
      // sides (the corridor beside the road is too narrow for a low side shot)
      camera.setPosition(
        sx * 3.8,
        1.7 + sx * sx * 3.7 + (aspectK - 1) * 0.75,
        CAR_Z + Math.cos(th) * 5.8 * aspectK,
      );
      camera.lookAt(0, 0.45, CAR_Z);
      carRig.setLocalPosition(Math.sin(elapsed * 1.3) * 0.01, Math.sin(elapsed * 2.6) * 0.012, CAR_Z);
      carRig.setLocalEulerAngles(0, 0, Math.sin(elapsed * 1.7) * 0.5);

      updateCapsuleGestures(gestures, driverGestureRef.current, passengerGestureRef.current);

      const fw = fireworkRef.current;
      if (fw && fw !== lastFirework) {
        lastFirework = fw;
        spawnFirework(app, fireworks, fw.synced, colorToNumber(driverColorRef.current), colorToNumber(passengerColorRef.current));
      }
      for (let i = fireworks.length - 1; i >= 0; i--) {
        const p = fireworks[i];
        const pos = p.entity.getPosition();
        p.vel.y -= dt * 1.4;
        p.entity.setPosition(pos.x + p.vel.x * dt, pos.y + p.vel.y * dt, pos.z + p.vel.z * dt);
        p.life -= dt;
        const s = Math.max(0.01, p.life * 0.1);
        p.entity.setLocalScale(s, s, s);
        if (p.life <= 0) {
          p.entity.destroy();
          fireworks.splice(i, 1);
        }
      }
    });

    // terrain tiles are created inside createTerrain; grab them by name
    const terrainTiles = [0, 1, 2]
      .map((i) => app.root.findByName(`terrain-${i}`) as pc.Entity)
      .filter(Boolean);

    app.start();

    return () => {
      observer.disconnect();
      app.destroy();
      canvas.remove();
    };
  }, [road]);

  return <div ref={mountRef} className="absolute inset-0" />;
}

// ---------------------------------------------------------------- sky

function createSky(app: pc.Application, theme: Theme) {
  // gradient dome via vertex colors, unlit + unfogged
  const b = new MeshBuilder();
  const RAD = 320;
  const rings = 14;
  const segs = 28;
  const latMin = -0.06;
  const latMax = Math.PI / 2;
  const vert = (ri: number, si: number): [number, number, number] => {
    const lat = latMin + (latMax - latMin) * (ri / rings);
    const lon = (Math.PI * 2 * si) / segs;
    return [Math.cos(lat) * Math.cos(lon) * RAD, Math.sin(lat) * RAD, Math.cos(lat) * Math.sin(lon) * RAD];
  };
  const colAt = (ri: number): number => {
    const lat = latMin + (latMax - latMin) * (ri / rings);
    const t = Math.max(0, Math.sin(lat));
    // horizon → band over the first 18%, band → top over the rest
    if (t < 0.16) return lerpColor(theme.skyHorizon, theme.skyBand, t / 0.16);
    return lerpColor(theme.skyBand, theme.skyTop, Math.pow((t - 0.16) / 0.84, 0.75));
  };
  for (let ri = 0; ri < rings; ri++) {
    for (let si = 0; si < segs; si++) {
      const p00 = vert(ri, si), p10 = vert(ri, si + 1), p01 = vert(ri + 1, si), p11 = vert(ri + 1, si + 1);
      b.quadColors(p00, p10, p11, p01, colAt(ri), colAt(ri), colAt(ri + 1), colAt(ri + 1));
    }
  }
  const dome = b.entity(app, 'sky', unlitVCMat());
  app.root.addChild(dome);

  if (theme.disc) {
    const d = theme.disc;
    const disc = primitive('sun-disc', 'sphere', [d.x, d.y, -210], [d.scale, d.scale, 0.6], unlitMat(d.color));
    app.root.addChild(disc);
    if (d.glowO > 0) {
      const glow = primitive('sun-glow', 'sphere', [d.x, d.y, -212], [d.scale * 2.4, d.scale * 2.4, 0.4], glowMat(d.glow, d.glowO));
      app.root.addChild(glow);
    }
    if (d.haloO > 0) {
      const halo = primitive('sun-halo', 'sphere', [d.x, d.y, -214], [d.scale * 5, d.scale * 5, 0.3], glowMat(d.glow, d.haloO));
      app.root.addChild(halo);
    }
  }

  if (theme.stars > 0) {
    const sb = new MeshBuilder();
    const rng = makeRng(7);
    for (let i = 0; i < theme.stars; i++) {
      const lat = 0.12 + rng() * 1.3;
      const lon = rng() * Math.PI * 2;
      const r = 300;
      const cx = Math.cos(lat) * Math.cos(lon) * r;
      const cy = Math.sin(lat) * r;
      const cz = Math.cos(lat) * Math.sin(lon) * r;
      const s = 0.5 + rng() * 0.9;
      const bright = 0.35 + rng() * 0.65;
      const c = lerpColor(0x000000, rng() > 0.85 ? 0xffe2b8 : 0xe8f0ff, bright);
      // small tangent quad
      const up: [number, number, number] = [0, 1, 0];
      const dir: [number, number, number] = [cx / r, cy / r, cz / r];
      const u = norm3(cross3(dir, up));
      const v = cross3(u, dir);
      sb.quadColors(
        [cx - u[0] * s - v[0] * s, cy - u[1] * s - v[1] * s, cz - u[2] * s - v[2] * s],
        [cx + u[0] * s - v[0] * s, cy + u[1] * s - v[1] * s, cz + u[2] * s - v[2] * s],
        [cx + u[0] * s + v[0] * s, cy + u[1] * s + v[1] * s, cz + u[2] * s + v[2] * s],
        [cx - u[0] * s + v[0] * s, cy - u[1] * s + v[1] * s, cz - u[2] * s + v[2] * s],
        c, c, c, c,
      );
    }
    const stars = sb.entity(app, 'stars', unlitVCMat());
    app.root.addChild(stars);
  }
}

// ---------------------------------------------------------------- backdrop silhouettes

function createBackdrop(app: pc.Application, theme: Theme, road: RoadId) {
  const make = (z: number, col: number, tall: number, seed: number) => {
    const b = new MeshBuilder();
    const rng = makeRng(seed);
    const baseY = -2;
    if (theme.backdrop.style === 'skyline') {
      let x = -170;
      while (x < 170) {
        const w = 6 + rng() * 14;
        const h = 4 + rng() * tall;
        b.quad([x, baseY, z], [x + w, baseY, z], [x + w, baseY + h, z], [x, baseY + h, z], col);
        x += w + rng() * 3;
      }
    } else {
      // jagged ridge / mesa / peaks strip
      const step = theme.backdrop.style === 'mesa' ? 22 : 14;
      let x = -180;
      let prevY = baseY + 3 + rng() * tall;
      while (x < 180) {
        const w = step * (0.7 + rng() * 0.6);
        const y = theme.backdrop.style === 'mesa'
          ? baseY + 4 + rng() * tall * 0.5
          : baseY + 2 + rng() * tall;
        if (theme.backdrop.style === 'mesa') {
          // flat-topped trapezoid
          b.quad([x, baseY, z], [x + w, baseY, z], [x + w * 0.8, y, z], [x + w * 0.2, y, z], col);
        } else {
          b.tri([x, baseY, z], [x + w, baseY, z], [x + w / 2, y, z], col);
          b.tri([x - w * 0.3, baseY, z], [x + w * 0.6, baseY, z], [x + w * 0.15, (prevY + y) / 2, z], col);
        }
        prevY = y;
        x += w * (theme.backdrop.style === 'mesa' ? 1.4 : 0.7);
      }
    }
    const e = b.entity(app, `backdrop-${z}`, unlitVCMat());
    app.root.addChild(e);
  };

  const tallFar = road === 'mountain' ? 26 : road === 'city' ? 16 : 12;
  const tallNear = road === 'mountain' ? 18 : road === 'city' ? 10 : 8;
  make(-226, theme.backdrop.far, tallFar, 11);
  make(-214, theme.backdrop.near, tallNear, 23);
  // mirrored set behind the car for the orbiting camera
  make(226, theme.backdrop.far, tallFar, 31);
  make(214, theme.backdrop.near, tallNear, 47);
}

// ---------------------------------------------------------------- terrain

type HeightFn = (side: -1 | 1, x: number, row: number) => number;

function createTerrain(app: pc.Application, theme: Theme, road: RoadId): HeightFn {
  const colEdges = [2.3, 3.2, 4.4, 6, 8, 10.5, 14, 18, 24, 32, 42, 56];
  const rng = makeRng(road.length * 101 + 5);

  // per-vertex jitter grid, periodic in z (row ROWS == row 0)
  const jitter: number[][] = [];
  for (let r = 0; r <= ROWS; r++) {
    jitter.push(colEdges.map(() => (r === ROWS ? 0 : rng() - 0.5)));
  }
  for (let c = 0; c < colEdges.length; c++) jitter[ROWS][c] = jitter[0][c];

  const profile = (side: -1 | 1, x: number): { base: number; amp: number } => {
    const d = Math.max(0, x - 2.3);
    if (road === 'desert') return { base: -0.62 + Math.max(0, d - 5) * 0.02, amp: Math.min(0.7, d * 0.05) };
    if (road === 'mountain') return { base: -0.62 + d * 0.14, amp: Math.min(1.4, 0.2 + d * 0.06) };
    if (road === 'city') return { base: -0.62, amp: 0 };
    // coast: hills on the left, cliff drop to the ocean on the right
    if (side < 0) return { base: -0.62 + d * 0.1, amp: Math.min(1.0, 0.2 + d * 0.04) };
    if (d < 2.2) return { base: -0.62, amp: 0.04 };
    return { base: -0.62 - Math.min(2.4, (d - 2.2) * 1.1), amp: 0.12 };
  };

  const heightAt: HeightFn = (side, x, row) => {
    const p = profile(side, x);
    let ci = 0;
    for (let c = 0; c < colEdges.length - 1; c++) if (x >= colEdges[c]) ci = c;
    const r = ((row % ROWS) + ROWS) % ROWS;
    // interpolate jitter across the column so props sit on the actual slope
    const t = Math.min(1, Math.max(0, (x - colEdges[ci]) / (colEdges[ci + 1] - colEdges[ci])));
    const j = jitter[r][ci] * (1 - t) + jitter[r][Math.min(ci + 1, colEdges.length - 1)] * t;
    return p.base + j * p.amp;
  };

  for (let tileIdx = 0; tileIdx < 3; tileIdx++) {
    // identical rng stream per tile so the two copies tile seamlessly
    const colorRng = makeRng(road.length * 77 + 3);
    const b = new MeshBuilder();
    for (const side of [-1, 1] as const) {
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < colEdges.length - 1; c++) {
          const x0 = colEdges[c] * side, x1 = colEdges[c + 1] * side;
          const z0 = -r * CELL, z1 = -(r + 1) * CELL;
          const y00 = heightAt(side, colEdges[c], r);
          const y10 = heightAt(side, colEdges[c + 1], r);
          const y01 = heightAt(side, colEdges[c], r + 1);
          const y11 = heightAt(side, colEdges[c + 1], r + 1);
          let col = lerpColor(theme.ground, theme.groundAlt, colorRng());
          if (road === 'coast' && side > 0 && colEdges[c] > 4.4) col = lerpColor(0xb08d5e, 0x96714a, colorRng()); // cliff face
          if (road === 'mountain' && Math.min(y00, y10) > 1.6) col = lerpColor(0x8b97a0, 0xa8b4bc, colorRng()); // rocky above treeline
          if (road === 'mountain' && Math.min(y00, y10) > 3.4) col = lerpColor(0xdfe8ee, 0xeff5f8, colorRng()); // snow
          const shade = 0.92 + colorRng() * 0.16;
          col = scaleColor(col, shade);
          if (side > 0) b.quad([x0, y00, z0], [x1, y10, z0], [x1, y11, z1], [x0, y01, z1], col);
          else b.quad([x1, y10, z0], [x0, y00, z0], [x0, y01, z1], [x1, y11, z1], col);
        }
      }
    }
    const tile = b.entity(app, `terrain-${tileIdx}`, litVCMat());
    app.root.addChild(tile);
  }

  if (road === 'coast') {
    // ocean: static vertex-colored plane, deeper near the car → pale at both horizons
    const ob = new MeshBuilder();
    const nearC = 0x1577a0, farC = 0x8ecbd8;
    const zSteps = 16;
    const span = 2 * TERRAIN_AHEAD + 20;
    for (let i = 0; i < zSteps; i++) {
      const z0 = span / 2 - (i * span) / zSteps;
      const z1 = span / 2 - ((i + 1) * span) / zSteps;
      const c0 = lerpColor(nearC, farC, Math.abs(z0) / (span / 2));
      const c1 = lerpColor(nearC, farC, Math.abs(z1) / (span / 2));
      ob.quadColors([5.5, -2.6, z0], [150, -2.6, z0], [150, -2.6, z1], [5.5, -2.6, z1], c0, c0, c1, c1);
    }
    const ocean = ob.entity(app, 'ocean', litVCMat());
    app.root.addChild(ocean);
  }

  return heightAt;
}

// ---------------------------------------------------------------- road

function createRoad(app: pc.Application, moving: MovingEntity[], theme: Theme) {
  const roadMat = mat(theme.road, 0);
  const laneMat = mat(theme.lane, 0.5);
  const edgeMat = mat(theme.edge, 0.15);
  const shoulderMat = mat(theme.shoulder, 0);

  // static: asphalt, edge lines, shoulders (uniform surfaces don't show motion);
  // symmetric around the car so the orbiting camera never sees the road end
  addBox(app, 'road', [0, -0.6, 0], [3.4, 0.06, 2 * TERRAIN_AHEAD + 20], roadMat);
  addBox(app, 'edge-l', [-1.45, -0.565, 0], [0.09, 0.012, 2 * TERRAIN_AHEAD + 20], edgeMat);
  addBox(app, 'edge-r', [1.45, -0.565, 0], [0.09, 0.012, 2 * TERRAIN_AHEAD + 20], edgeMat);
  addBox(app, 'shoulder-l', [-2.15, -0.605, 0], [1.0, 0.045, 2 * TERRAIN_AHEAD + 20], shoulderMat);
  addBox(app, 'shoulder-r', [2.15, -0.605, 0], [1.0, 0.045, 2 * TERRAIN_AHEAD + 20], shoulderMat);

  // scrolling: centre dashes
  const dashCount = 30;
  for (let i = 0; i < dashCount; i++) {
    const e = addBox(app, `lane-${i}`, [0, -0.555, 0], [0.1, 0.012, 2.2], laneMat);
    moving.push({ entity: e, base: i * (FAR / dashCount), x: 0, y: -0.555 });
  }
}

// ---------------------------------------------------------------- theme worlds

function createThemeWorld(
  app: pc.Application,
  moving: MovingEntity[],
  drifters: Drifter[],
  bobbers: Bobber[],
  theme: Theme,
  road: RoadId,
  heightAt: HeightFn,
) {
  const rng = makeRng(road.length * 31 + 17);
  const groupAt = (side: -1 | 1, x: number, row: number): { g: pc.Entity; reg: () => void } => {
    const g = new pc.Entity('prop');
    app.root.addChild(g);
    const y = heightAt(side, Math.abs(x), row);
    const base = FAR - ((row % ROWS) + ROWS) % ROWS * CELL;
    return { g, reg: () => moving.push({ entity: g, base, x, y, fade: true }) };
  };

  if (road === 'desert') buildDesert(rng, groupAt);
  if (road === 'coast') buildCoast(app, moving, bobbers, rng, groupAt);
  if (road === 'mountain') buildMountain(rng, groupAt);
  if (road === 'city') buildCity(app, rng, groupAt);

  // clouds
  if (theme.clouds.count > 0) {
    const cloudM = unlitMat(theme.clouds.color);
    for (let i = 0; i < theme.clouds.count; i++) {
      const cluster = new pc.Entity(`cloud-${i}`);
      const puffs = 3 + Math.floor(rng() * 3);
      const w = 9 + rng() * 14;
      for (let p = 0; p < puffs; p++) {
        const px = (p / puffs - 0.5) * w;
        const s = (0.45 + rng() * 0.5) * w * 0.45;
        const puff = primitive(`puff-${p}`, 'sphere', [px, rng() * 1.2, 0], [s, s * 0.42, s * 0.7], cloudM);
        cluster.addChild(puff);
      }
      const x = -120 + rng() * 240;
      const y = 26 + rng() * 34;
      const z = (i % 2 === 0 ? -1 : 1) * (195 + rng() * 12); // both horizons
      cluster.setLocalPosition(x, y, z);
      app.root.addChild(cluster);
      drifters.push({ entity: cluster, x, y, z, speed: 0.4 + rng() * 0.5 });
    }
  }
}

type GroupAt = (side: -1 | 1, x: number, row: number) => { g: pc.Entity; reg: () => void };

function buildDesert(rng: () => number, groupAt: GroupAt) {
  const cactus = mat(0x3f7350, 0.04);
  const cactusDark = mat(0x356244, 0.04);
  const rock = mat(0xc78d56, 0);
  const bush = mat(0x6a5d33, 0);
  const pole = mat(0x4a3526, 0);
  const strata = [mat(0xb5653c, 0), mat(0xc7794a, 0), mat(0xa05633, 0)];

  for (let r = 0; r < ROWS; r += 1) {
    if (rng() < 0.45) continue;
    const side = rng() < 0.5 ? -1 : 1;
    const pick = rng();
    if (pick < 0.4) {
      // saguaro
      const x = side * (4 + rng() * 6);
      const { g, reg } = groupAt(side, x, r);
      const h = 1.3 + rng() * 1.1;
      const m = rng() < 0.7 ? cactus : cactusDark;
      child(g, 'cylinder', [0, h / 2, 0], [0.26, h, 0.26], m);
      child(g, 'sphere', [0, h, 0], [0.26, 0.2, 0.26], m);
      const arms = rng() < 0.6 ? 2 : 1;
      for (let a = 0; a < arms; a++) {
        const ax = (a === 0 ? 1 : -1) * 0.34;
        const ay = h * (0.4 + rng() * 0.25);
        child(g, 'cylinder', [ax * 0.7, ay, 0], [0.32, 0.16, 0.16], m).setLocalEulerAngles(0, 0, 90);
        child(g, 'cylinder', [ax, ay + 0.3, 0], [0.17, 0.6, 0.17], m);
        child(g, 'sphere', [ax, ay + 0.6, 0], [0.17, 0.14, 0.17], m);
      }
      reg();
    } else if (pick < 0.55) {
      // mesa
      const x = side * (12 + rng() * 14);
      const { g, reg } = groupAt(side, x, r);
      const w = 5 + rng() * 8;
      const h1 = 1.2 + rng() * 1.4;
      child(g, 'box', [0, h1 / 2, 0], [w, h1, w * 0.8], strata[Math.floor(rng() * 3)]);
      child(g, 'box', [0, h1 + 0.5, 0], [w * 0.72, 1, w * 0.6], strata[Math.floor(rng() * 3)]);
      if (rng() < 0.5) child(g, 'box', [0, h1 + 1.3, 0], [w * 0.5, 0.7, w * 0.42], strata[Math.floor(rng() * 3)]);
      reg();
    } else if (pick < 0.8) {
      // rocks
      const x = side * (3.4 + rng() * 4);
      const { g, reg } = groupAt(side, x, r);
      const s = 0.25 + rng() * 0.5;
      child(g, 'sphere', [0, s * 0.3, 0], [s * 1.5, s * 0.8, s * 1.2], rock);
      if (rng() < 0.5) child(g, 'sphere', [s, s * 0.2, 0.2], [s, s * 0.5, s * 0.8], rock);
      reg();
    } else {
      // dry bush
      const x = side * (3.2 + rng() * 5);
      const { g, reg } = groupAt(side, x, r);
      const s = 0.3 + rng() * 0.3;
      child(g, 'sphere', [0, s * 0.5, 0], [s * 1.4, s, s * 1.3], bush);
      child(g, 'sphere', [s * 0.8, s * 0.35, 0], [s, s * 0.7, s], bush);
      reg();
    }
  }

  // telephone poles — route 66's metronome (outside the camera's orbit)
  for (let r = 0; r < ROWS; r += 3) {
    const { g, reg } = groupAt(-1, -4.1, r);
    child(g, 'cylinder', [0, 1.3, 0], [0.09, 2.6, 0.09], pole);
    child(g, 'box', [0, 2.32, 0], [0.95, 0.07, 0.07], pole);
    child(g, 'box', [0, 2.05, 0], [0.7, 0.06, 0.06], pole);
    reg();
  }
}

function buildCoast(app: pc.Application, moving: MovingEntity[], bobbers: Bobber[], rng: () => number, groupAt: GroupAt) {
  const trunk = mat(0x8a6a4a, 0);
  const frond = mat(0x3e7d4c, 0.04);
  const cypress = mat(0x2e5d3c, 0.04);
  const rock = mat(0x9a8a6e, 0);
  const post = mat(0xb0a89a, 0.06);
  const rail = mat(0xc8c2b4, 0.08);
  const capMat = mat(0xeef7f7, 0.25);
  const hull = mat(0xf4f2ea, 0.1);
  const sail = mat(0xffffff, 0.15);

  for (let r = 0; r < ROWS; r += 1) {
    if (rng() < 0.5) continue;
    const pick = rng();
    if (pick < 0.45) {
      // wind-swept monterey cypress on the hill side
      const x = -(3.6 + rng() * 6);
      const { g, reg } = groupAt(-1, x, r);
      const h = 1.4 + rng() * 1.2;
      const sweep = 0.25 + rng() * 0.35; // leans toward the sea
      child(g, 'cylinder', [0, h * 0.3, 0], [0.14, h * 0.6, 0.14], trunk).setLocalEulerAngles(0, 0, -sweep * 24);
      child(g, 'sphere', [sweep * 0.8, h * 0.72, 0], [h * 0.85, h * 0.34, h * 0.6], frond);
      child(g, 'sphere', [sweep * 1.4, h * 0.92, 0], [h * 0.55, h * 0.24, h * 0.45], frond);
      if (rng() < 0.5) child(g, 'sphere', [sweep * 0.2, h * 0.55, 0.2], [h * 0.5, h * 0.2, h * 0.4], frond);
      reg();
    } else if (pick < 0.7) {
      // cypress / shrub
      const x = -(3.4 + rng() * 8);
      const { g, reg } = groupAt(-1, x, r);
      const h = 1.4 + rng() * 1.6;
      child(g, 'cone', [0, h / 2, 0], [0.5 + rng() * 0.3, h, 0.5 + rng() * 0.3], cypress, 7);
      reg();
    } else {
      // rocks near the cliff edge
      const x = 3.6 + rng() * 1.2;
      const { g, reg } = groupAt(1, x, r);
      const s = 0.2 + rng() * 0.3;
      child(g, 'sphere', [0, s * 0.3, 0], [s * 1.4, s * 0.8, s * 1.1], rock);
      reg();
    }
  }

  // guardrail on the ocean side: static rail + scrolling posts
  addBox(app, 'rail', [2.62, -0.18, 0], [0.07, 0.1, 2 * TERRAIN_AHEAD + 20], rail);
  for (let r = 0; r < ROWS; r += 1) {
    const { g, reg } = groupAt(1, 2.62, r);
    child(g, 'box', [0, 0.22, 0], [0.1, 0.45, 0.1], post);
    reg();
  }

  // whitecaps drifting on the water
  for (let i = 0; i < 14; i++) {
    const e = addBox(app, `cap-${i}`, [0, 0, 0], [1.2 + rng() * 2.4, 0.04, 0.16], capMat);
    moving.push({ entity: e, base: rng() * FAR, x: 8 + rng() * 36, y: -2.54 });
  }

  // sailboats far out
  for (let i = 0; i < 3; i++) {
    const boat = new pc.Entity(`boat-${i}`);
    child(boat, 'box', [0, 0.1, 0], [1.5, 0.3, 0.5], hull);
    child(boat, 'cylinder', [0, 1.0, 0], [0.05, 1.6, 0.05], trunk);
    const s = child(boat, 'cone', [0.35, 1.05, 0], [0.9, 1.5, 0.08], sail, 4);
    s.setLocalEulerAngles(0, 0, -90);
    app.root.addChild(boat);
    const x = 20 + rng() * 26;
    const y = -2.45;
    moving.push({ entity: boat, base: rng() * FAR, x, y, fade: true });
    bobbers.push({ entity: boat, x, y, phase: rng() * 6, amp: 0.06 });
  }
}

function buildMountain(rng: () => number, groupAt: GroupAt) {
  const trunkM = mat(0x5a4634, 0);
  const pineA = mat(0x1f4a35, 0.03);
  const pineB = mat(0x275a3f, 0.03);
  const snow = mat(0xeff5f8, 0.12);
  const rockM = mat(0x8b97a0, 0);
  const peakM = mat(0x7e8c99, 0);

  for (let r = 0; r < ROWS; r += 1) {
    const side = rng() < 0.5 ? -1 : 1;
    const pick = rng();
    if (pick < 0.55) {
      // pine cluster
      const n = 1 + Math.floor(rng() * 3);
      for (let t = 0; t < n; t++) {
        const x = side * (3.4 + rng() * 7);
        const { g, reg } = groupAt(side, x, r);
        const h = 1.2 + rng() * 1.7;
        const m = rng() < 0.5 ? pineA : pineB;
        child(g, 'cylinder', [0, h * 0.18, 0], [0.13, h * 0.36, 0.13], trunkM);
        child(g, 'cone', [0, h * 0.42, 0], [h * 0.55, h * 0.55, h * 0.55], m, 7);
        child(g, 'cone', [0, h * 0.68, 0], [h * 0.42, h * 0.48, h * 0.42], m, 7);
        child(g, 'cone', [0, h * 0.92, 0], [h * 0.28, h * 0.4, h * 0.28], m, 7);
        if (rng() < 0.45) child(g, 'cone', [0, h * 1.06, 0], [h * 0.16, h * 0.18, h * 0.16], snow, 7);
        reg();
      }
    } else if (pick < 0.72) {
      // boulder
      const x = side * (3.2 + rng() * 4);
      const { g, reg } = groupAt(side, x, r);
      const s = 0.3 + rng() * 0.6;
      child(g, 'sphere', [0, s * 0.35, 0], [s * 1.5, s * 0.9, s * 1.2], rockM);
      reg();
    } else if (pick < 0.86) {
      // snow patch
      const x = side * (4 + rng() * 8);
      const { g, reg } = groupAt(side, x, r);
      child(g, 'box', [0, 0.03, 0], [1.4 + rng() * 1.6, 0.05, 1 + rng()], snow);
      reg();
    } else {
      // big near peak
      const x = side * (16 + rng() * 12);
      const { g, reg } = groupAt(side, x, r);
      const h = 7 + rng() * 7;
      child(g, 'cone', [0, h / 2, 0], [h * 0.9, h, h * 0.9], peakM, 5);
      child(g, 'cone', [0, h * 0.82, 0], [h * 0.34, h * 0.38, h * 0.34], snow, 5);
      reg();
    }
  }
}

function buildCity(app: pc.Application, rng: () => number, groupAt: GroupAt) {
  const bodyA = mat(0x171a26, 0);
  const bodyB = mat(0x1d2130, 0);
  const wood = mat(0x231a18, 0);
  const roofM = mat(0x2c2330, 0.02);
  const warm = mat(0xffb45e, 1);
  const cool = mat(0x7fd8e8, 1);
  const neonA = mat(0xff5e6c, 1);
  const neonB = mat(0x59e0b8, 1);
  const lampM = mat(0x2a2c38, 0);
  const lampGlow = mat(0xffc97a, 1);
  const torii = mat(0xc23b22, 0.12);

  for (let r = 0; r < ROWS; r += 1) {
    const side = rng() < 0.5 ? -1 : 1;
    const pick = rng();
    if (pick < 0.62) {
      // building with lit window bands; facades stay outside the camera's orbit
      const w = 1.6 + rng() * 1.8;
      const x = side * Math.max(4.2 + rng() * 5, 4.2 + w / 2);
      const { g, reg } = groupAt(side, x, r);
      const h = 1.8 + rng() * 4.4;
      const dpt = 1.6 + rng() * 1.2;
      child(g, 'box', [0, h / 2, 0], [w, h, dpt], rng() < 0.5 ? bodyA : bodyB);
      const floors = Math.max(1, Math.floor(h / 0.9));
      for (let f = 0; f < floors; f++) {
        if (rng() < 0.2) continue;
        const wm = rng() < 0.72 ? warm : cool;
        child(g, 'box', [-side * (w / 2 + 0.015), 0.5 + f * 0.9, 0], [0.03, 0.28, dpt * (0.45 + rng() * 0.45)], wm);
      }
      if (rng() < 0.3) {
        const nm = rng() < 0.5 ? neonA : neonB;
        child(g, 'box', [-side * (w / 2 + 0.04), h * (0.5 + rng() * 0.3), 0], [0.06, 0.7 + rng() * 0.8, 0.18], nm);
      }
      reg();
    } else if (pick < 0.74) {
      // pagoda-ish tower
      const x = side * (5.6 + rng() * 6);
      const { g, reg } = groupAt(side, x, r);
      let y = 0;
      let w = 1.8 + rng() * 0.6;
      const tiers = 3;
      for (let t = 0; t < tiers; t++) {
        const th = 0.9 - t * 0.12;
        child(g, 'box', [0, y + th / 2, 0], [w * 0.7, th, w * 0.7], wood);
        child(g, 'box', [0, y + th + 0.05, 0], [w, 0.12, w], roofM);
        child(g, 'box', [-side * (w * 0.35 + 0.01), y + th / 2, 0], [0.02, 0.16, w * 0.36], warm);
        y += th + 0.12;
        w *= 0.78;
      }
      child(g, 'cylinder', [0, y + 0.18, 0], [0.05, 0.36, 0.05], wood);
      reg();
    } else if (pick < 0.8 && r % 6 === 0) {
      // torii gate set back from the road
      const x = side * (5.4 + rng() * 2);
      const { g, reg } = groupAt(side, x, r);
      child(g, 'cylinder', [-0.8, 0.8, 0], [0.14, 1.6, 0.14], torii);
      child(g, 'cylinder', [0.8, 0.8, 0], [0.14, 1.6, 0.14], torii);
      child(g, 'box', [0, 1.66, 0], [2.3, 0.16, 0.2], torii);
      child(g, 'box', [0, 1.36, 0], [1.9, 0.1, 0.14], torii);
      reg();
    }
  }

  // street lamps, alternating sides
  for (let r = 0; r < ROWS; r += 2) {
    const side = r % 4 === 0 ? -1 : 1;
    const { g, reg } = groupAt(side, side * 2.9, r);
    child(g, 'cylinder', [0, 1.0, 0], [0.06, 2.0, 0.06], lampM);
    child(g, 'box', [-side * 0.3, 1.98, 0], [0.65, 0.05, 0.05], lampM);
    child(g, 'sphere', [-side * 0.58, 1.92, 0], [0.17, 0.14, 0.17], lampGlow);
    child(g, 'sphere', [-side * 0.58, 1.92, 0], [0.5, 0.42, 0.5], glowMat(0xffc97a, 0.14));
    child(g, 'sphere', [-side * 0.58, -0.55, 0], [1.6, 0.02, 1.6], glowMat(0xffc97a, 0.16));
    reg();
  }

  // sidewalks
  addBox(app, 'walk-l', [-2.95, -0.585, 0], [1.3, 0.08, 2 * TERRAIN_AHEAD + 20], mat(0x20222c, 0));
  addBox(app, 'walk-r', [2.95, -0.585, 0], [1.3, 0.08, 2 * TERRAIN_AHEAD + 20], mat(0x20222c, 0));
}

// ---------------------------------------------------------------- the hero car

function createCar(
  app: pc.Application,
  driverColor: string,
  passengerColor: string,
  gestures: pc.Entity[],
): pc.Entity {
  const rig = new pc.Entity('car-rig');
  rig.setLocalPosition(0, 0, CAR_Z);
  app.root.addChild(rig);

  // occupants are placed synchronously so they exist even while the GLB streams in.
  // they face +z (toward the camera); car cabin sits just behind the car's centre.
  // the model is LHD — wheel on the car's left, the viewer's right from the front
  const driver = createOccupant(rig, 'driver', [0, 0, 0], driverColor, gestures, 'man');
  driver.setLocalPosition(0.3, 0.28, 0.18);
  driver.setLocalEulerAngles(0, 180, 0);
  const passenger = createOccupant(rig, 'passenger', [0, 0, 0], passengerColor, gestures, 'woman');
  passenger.setLocalPosition(-0.3, 0.28, 0.18);
  passenger.setLocalEulerAngles(0, 180, 0);

  // soft fake contact shadow (static — doesn't bob with the rig)
  const shadowM = new pc.StandardMaterial();
  shadowM.diffuse = new pc.Color(0, 0, 0);
  shadowM.emissive = new pc.Color(0, 0, 0);
  shadowM.useLighting = false;
  shadowM.opacity = 0.2;
  shadowM.blendType = pc.BLEND_NORMAL;
  shadowM.depthWrite = false;
  shadowM.update();
  const shadow = primitive('car-shadow', 'sphere', [0, ROAD_TOP + 0.006, CAR_Z], [1.9, 0.01, 3.5], shadowM);
  app.root.addChild(shadow);

  const asset = new pc.Asset('cicada_flat', 'container', { url: '/assets/cars/cicada_flat.glb' });
  asset.on('load', () => {
    // wrapper carries our yaw/scale; the GLB root keeps its own orientation fix
    const holder = new pc.Entity('car-holder');
    holder.setLocalEulerAngles(0, 90, 0); // model nose is -x; point it at +z, the direction of travel
    rig.addChild(holder);
    const model = (asset.resource as pc.ContainerResource).instantiateRenderEntity();
    holder.addChild(model);
    // measure world bounds, then scale about the holder origin to track width
    // and drop the wheels onto the road surface
    const aabb = new pc.BoundingBox();
    let first = true;
    for (const render of holder.findComponents('render') as pc.RenderComponent[]) {
      for (const mi of render.meshInstances) {
        if (first) { aabb.copy(mi.aabb); first = false; }
        else aabb.add(mi.aabb);
      }
    }
    const center = aabb.center.clone();
    const min = aabb.getMin().clone();
    const s = 1.9 / (aabb.halfExtents.x * 2);
    holder.setLocalScale(s, s, s);
    holder.setLocalPosition(-center.x * s, ROAD_TOP - min.y * s, -(center.z - CAR_Z) * s);
  });
  asset.on('error', (err: string) => console.error('car glb failed:', err));
  app.assets.add(asset);
  app.assets.load(asset);

  return rig;
}

// Human silhouettes seen from the back seat. The rider's glyph colour lives in
// the clothing; skin and hair stay neutral so they read as people, not tokens.
function createOccupant(
  parent: pc.Entity,
  name: string,
  pos: [number, number, number],
  colorHex: string,
  gestures: pc.Entity[],
  variant: 'man' | 'woman',
): pc.Entity {
  const clothes = mat(colorToNumber(colorHex), 0.2);
  const skin = mat(variant === 'man' ? 0xc08a5e : 0xd2a072, 0.08);
  const hair = mat(variant === 'man' ? 0x161210 : 0x7a5230, 0.04); // man: black afro
  const shades = mat(0x10131a, 0.3);

  const figure = new pc.Entity(`${name}-body`);
  figure.setLocalPosition(pos[0], pos[1], pos[2]);
  parent.addChild(figure);

  const torsoW = variant === 'man' ? 0.34 : 0.29;
  // torso + rounded shoulders + slim upper arms
  child(figure, 'box', [0, 0.02, 0], [torsoW, 0.26, 0.15], clothes);
  child(figure, 'sphere', [-torsoW / 2 + 0.01, 0.13, 0], [0.09, 0.08, 0.09], clothes);
  child(figure, 'sphere', [torsoW / 2 - 0.01, 0.13, 0], [0.09, 0.08, 0.09], clothes);
  child(figure, 'box', [-(torsoW / 2 + 0.02), 0.0, 0], [0.06, 0.18, 0.08], clothes).setLocalEulerAngles(0, 0, 7);
  child(figure, 'box', [torsoW / 2 + 0.02, 0.0, 0], [0.06, 0.18, 0.08], clothes).setLocalEulerAngles(0, 0, -7);
  // neck + head
  child(figure, 'cylinder', [0, 0.16, 0], [0.05, 0.08, 0.05], skin);
  const headY = 0.28;
  const head = child(figure, 'sphere', [0, headY, 0], variant === 'man' ? [0.15, 0.165, 0.15] : [0.14, 0.155, 0.14], skin);
  head.name = `${name}-head`;
  // ears peeking out (visible from behind, sells "head" instantly)
  child(figure, 'sphere', [-0.072, headY, 0], [0.032, 0.042, 0.03], skin);
  child(figure, 'sphere', [0.072, headY, 0], [0.032, 0.042, 0.03], skin);

  if (variant === 'man') {
    // a proper afro: big rounded crown, kept clear of the face
    child(figure, 'sphere', [0, headY + 0.105, 0.022], [0.205, 0.165, 0.19], hair);
    child(figure, 'sphere', [-0.082, headY + 0.045, 0.02], [0.105, 0.105, 0.115], hair);
    child(figure, 'sphere', [0.082, headY + 0.045, 0.02], [0.105, 0.105, 0.115], hair);
    child(figure, 'sphere', [0, headY + 0.03, 0.065], [0.15, 0.13, 0.06], hair);
  } else {
    // long hair: rounded cap + a smooth curtain falling to the shoulder line
    child(figure, 'sphere', [0, headY + 0.035, 0.015], [0.15, 0.11, 0.145], hair);
    child(figure, 'sphere', [0, headY - 0.13, 0.062], [0.165, 0.27, 0.07], hair);
  }

  // sunglasses: dark band across the face with a thin bridge highlight
  const faceR = variant === 'man' ? 0.072 : 0.067;
  child(figure, 'box', [0, headY + 0.015, -(faceR - 0.005)], [0.125, 0.038, 0.025], shades);
  child(figure, 'box', [0, headY + 0.015, -(faceR + 0.008)], [0.04, 0.012, 0.01], shades);

  // raised waving hand + forearm (toggled by gestures)
  const hand = new pc.Entity(`${name}-gesture`);
  figure.addChild(hand);
  const side = name === 'driver' ? 1 : -1; // wave on the inner side, toward the peer
  const armPart = primitive('forearm', 'cylinder', [side * (torsoW / 2 + 0.06), 0.22, 0], [0.045, 0.22, 0.045], clothes);
  armPart.setLocalEulerAngles(0, 0, side * -18);
  hand.addChild(armPart);
  const palm = primitive('palm', 'sphere', [side * (torsoW / 2 + 0.095), 0.35, 0], [0.055, 0.06, 0.045], skin);
  hand.addChild(palm);
  hand.enabled = false;

  gestures.push(figure, head, hand);
  return figure;
}

function updateCapsuleGestures(gestures: pc.Entity[], driverGesture?: GestureKind | null, passengerGesture?: GestureKind | null) {
  const driverHand = gestures[2];
  const passengerHand = gestures[5];
  if (driverHand) driverHand.enabled = !!driverGesture;
  if (passengerHand) passengerHand.enabled = !!passengerGesture;
}

// ---------------------------------------------------------------- fireworks

function spawnFirework(app: pc.Application, particles: { entity: pc.Entity; vel: pc.Vec3; life: number }[], synced: boolean, driverColor: number, passengerColor: number) {
  const colors = synced ? [driverColor, passengerColor, 0xffffff, 0xffd166] : [0xffffff, 0xd6d6d6];
  const count = synced ? 64 : 22;
  for (let i = 0; i < count; i++) {
    const angle = (Math.PI * 2 * i) / count;
    const radius = synced ? 3.2 : 1.6;
    const speed = 1.0 + ((i * 7) % 9) * 0.09;
    const entity = primitive(`spark-${Date.now()}-${i}`, 'sphere', [0, 4.5, -26], [0.12, 0.12, 0.12], mat(colors[i % colors.length], 1.0));
    app.root.addChild(entity);
    particles.push({
      entity,
      vel: new pc.Vec3(Math.cos(angle) * radius * speed, Math.sin(angle) * radius * speed + 1.2, -0.4),
      life: synced ? 1.6 : 1.0,
    });
  }
}

// ---------------------------------------------------------------- mesh builder (flat-shaded, vertex-colored)

class MeshBuilder {
  positions: number[] = [];
  normals: number[] = [];
  colors: number[] = [];

  tri(a: V3, b: V3, c: V3, col: number) {
    this.triColors(a, b, c, col, col, col);
  }

  triColors(a: V3, b: V3, c: V3, ca: number, cb: number, cc: number) {
    const n = faceNormal(a, b, c);
    this.positions.push(...a, ...b, ...c);
    this.normals.push(...n, ...n, ...n);
    pushColor(this.colors, ca);
    pushColor(this.colors, cb);
    pushColor(this.colors, cc);
  }

  quad(a: V3, b: V3, c: V3, d: V3, col: number) {
    this.quadColors(a, b, c, d, col, col, col, col);
  }

  quadColors(a: V3, b: V3, c: V3, d: V3, ca: number, cb: number, cc: number, cd: number) {
    this.triColors(a, b, c, ca, cb, cc);
    this.triColors(a, c, d, ca, cc, cd);
  }

  entity(app: pc.Application, name: string, material: pc.Material): pc.Entity {
    const mesh = new pc.Mesh(app.graphicsDevice);
    mesh.setPositions(this.positions);
    mesh.setNormals(this.normals);
    mesh.setColors(this.colors, 4);
    mesh.update(pc.PRIMITIVE_TRIANGLES);
    const mi = new pc.MeshInstance(mesh, material);
    const e = new pc.Entity(name);
    e.addComponent('render', { meshInstances: [mi] });
    return e;
  }
}

type V3 = [number, number, number];

function faceNormal(a: V3, b: V3, c: V3): V3 {
  const ab: V3 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const ac: V3 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
  return norm3(cross3(ab, ac));
}

function cross3(a: V3, b: V3): V3 {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}

function norm3(v: V3): V3 {
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
}

function pushColor(arr: number[], hex: number) {
  arr.push(((hex >> 16) & 255) / 255, ((hex >> 8) & 255) / 255, (hex & 255) / 255, 1);
}

// ---------------------------------------------------------------- materials & primitives

function litVCMat() {
  const m = new pc.StandardMaterial();
  m.diffuse = new pc.Color(1, 1, 1);
  m.diffuseVertexColor = true;
  m.update();
  return m;
}

function unlitVCMat() {
  const m = new pc.StandardMaterial();
  m.useLighting = false;
  m.useFog = false;
  m.cull = pc.CULLFACE_NONE;
  m.diffuse = new pc.Color(0, 0, 0);
  m.emissive = new pc.Color(1, 1, 1);
  m.emissiveVertexColor = true;
  m.update();
  return m;
}

function makeRng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function unlitMat(hex: number) {
  const m = new pc.StandardMaterial();
  m.useLighting = false;
  m.useFog = false;
  m.diffuse = new pc.Color(0, 0, 0);
  m.emissive = color(hex, 1);
  m.update();
  return m;
}

function glowMat(hex: number, opacity: number) {
  const m = new pc.StandardMaterial();
  m.useLighting = false;
  m.useFog = false;
  m.diffuse = new pc.Color(0, 0, 0);
  m.emissive = color(hex, 1);
  m.opacity = opacity;
  m.blendType = pc.BLEND_ADDITIVE;
  m.depthWrite = false;
  m.update();
  return m;
}

function mat(hex: number, emissive = 0, opacity = 1) {
  const material = new pc.StandardMaterial();
  material.diffuse = color(hex, 1);
  material.emissive = color(hex, emissive);
  if (opacity < 1) {
    material.opacity = opacity;
    material.blendType = pc.BLEND_NORMAL;
  }
  material.update();
  return material;
}

function color(hex: number, intensity = 1) {
  const r = ((hex >> 16) & 255) / 255;
  const g = ((hex >> 8) & 255) / 255;
  const b = (hex & 255) / 255;
  return new pc.Color(r * intensity, g * intensity, b * intensity, 1);
}

function lerpColor(a: number, b: number, t: number): number {
  const tt = Math.max(0, Math.min(1, t));
  const ar = (a >> 16) & 255, ag = (a >> 8) & 255, ab = a & 255;
  const br = (b >> 16) & 255, bg = (b >> 8) & 255, bb = b & 255;
  return (Math.round(ar + (br - ar) * tt) << 16) | (Math.round(ag + (bg - ag) * tt) << 8) | Math.round(ab + (bb - ab) * tt);
}

function scaleColor(hex: number, s: number): number {
  const r = Math.min(255, Math.round(((hex >> 16) & 255) * s));
  const g = Math.min(255, Math.round(((hex >> 8) & 255) * s));
  const b = Math.min(255, Math.round((hex & 255) * s));
  return (r << 16) | (g << 8) | b;
}

function colorToNumber(hex: string) {
  return parseInt(hex.replace('#', ''), 16);
}

function positiveMod(n: number, m: number) {
  return ((n % m) + m) % m;
}

function primitive(name: string, type: 'box' | 'sphere' | 'cone' | 'cylinder' | 'torus', pos: V3, scale: V3, material: pc.Material, extra?: Record<string, unknown>) {
  const e = new pc.Entity(name);
  e.addComponent('render', { type, material, ...(extra ?? {}) });
  e.setLocalPosition(pos[0], pos[1], pos[2]);
  e.setLocalScale(scale[0], scale[1], scale[2]);
  return e;
}

function addBox(app: pc.Application, name: string, pos: V3, scale: V3, material: pc.Material) {
  const e = primitive(name, 'box', pos, scale, material);
  app.root.addChild(e);
  return e;
}

function child(parent: pc.Entity, type: 'box' | 'sphere' | 'cone' | 'cylinder' | 'torus', pos: V3, scale: V3, material: pc.Material, segments?: number) {
  const e = primitive(`${parent.name}-part`, type, pos, scale, material, segments ? { segments } : undefined);
  parent.addChild(e);
  return e;
}
