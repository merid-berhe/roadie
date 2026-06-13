// v6.4 SPIKE — a "game world" feel: the car auto-drives a winding CLOSED LOOP
// through a small fictional low-poly world, camera chasing it through the bends.
// Self-contained on purpose (not wired into the live ride yet) so we can judge
// the feel via ?drive=1 before replacing the straight-road treadmill.
import { useEffect, useRef } from 'react';
import * as pc from 'playcanvas';

type V3 = [number, number, number];

// fictional world palette (Norway-ish cool greens + warm road)
const SKY_TOP = 0x9dc3d6;
const GROUND = 0x86a06b;     // meadow green
const ASPHALT = 0x3b4148;
const ROAD_EDGE = 0x2c3137;
const LINE = 0xe6b23e;       // gold centre line
const ROAD_HALF = 3.2;
const SPEED = 13;            // units / sec around the loop

export default function DriveWorld() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const app = new pc.Application(canvas, {
      graphicsDeviceOptions: { alpha: false, antialias: true, powerPreference: 'high-performance' },
    });
    app.setCanvasFillMode(pc.FILLMODE_NONE);
    app.setCanvasResolution(pc.RESOLUTION_AUTO);
    app.graphicsDevice.maxPixelRatio = Math.min(window.devicePixelRatio, 1.75);

    const resize = () => app.resizeCanvas(canvas.clientWidth, canvas.clientHeight);

    app.scene.ambientLight = color(0x8fa7b8, 0.55);
    app.scene.fog.type = pc.FOG_LINEAR;
    app.scene.fog.color = color(0xc8dbe6, 1);
    app.scene.fog.start = 60;
    app.scene.fog.end = 240;

    // --- lights
    const sun = new pc.Entity('sun');
    sun.addComponent('light', { type: 'directional', color: color(0xfff2d8, 1), intensity: 1.05, castShadows: false });
    sun.setEulerAngles(48, 38, 0);
    app.root.addChild(sun);
    const fill = new pc.Entity('fill');
    fill.addComponent('light', { type: 'directional', color: color(0x9fc2d6, 1), intensity: 0.5, castShadows: false });
    fill.setEulerAngles(-20, -150, 0);
    app.root.addChild(fill);

    // --- camera
    const camera = new pc.Entity('camera');
    camera.addComponent('camera', { clearColor: color(SKY_TOP, 1), fov: 55, nearClip: 0.1, farClip: 600 });
    app.root.addChild(camera);

    // --- ground
    const groundMat = mat(GROUND);
    const ground = primitive('ground', 'box', [0, -0.5, 0], [600, 1, 600], groundMat);
    app.root.addChild(ground);

    // --- the loop: a closed Catmull-Rom through wandering control points
    const CTRL: V3[] = [
      [0, 0, -70], [55, 0, -55], [80, 0, 0], [60, 0, 60],
      [10, 0, 80], [-45, 0, 65], [-80, 0, 20], [-85, 0, -35], [-45, 0, -75],
    ];
    const path = samplePath(CTRL, 24); // dense polyline + arc-length table

    // --- road ribbon mesh (follows the curve)
    buildRoad(app, path);

    // --- scatter a little world: forest, a town the road passes, rocks, hills
    scatterWorld(app, path);

    // --- car
    const carRig = new pc.Entity('car-rig');     // position + heading (yaw)
    app.root.addChild(carRig);
    const carTilt = new pc.Entity('car-tilt');   // banking roll on turns
    carRig.addChild(carTilt);
    loadCar(app, carTilt);

    // soft contact shadow under the car
    const shadow = primitive('shadow', 'sphere', [0, 0.02, 0], [2.0, 0.01, 3.4], shadowMat());
    carRig.addChild(shadow);

    let elapsed = 0;
    let camInit = false;
    const camPos = new pc.Vec3();
    const tmpTarget = new pc.Vec3();

    app.on('update', (dt: number) => {
      elapsed += dt;
      const d = (elapsed * SPEED) % path.length;
      const here = path.at(d);
      const ahead = path.at(d + 4);
      const yaw = Math.atan2(here.tx, here.tz); // +z local forward → tangent

      carRig.setPosition(here.x, 0, here.z);
      carRig.setEulerAngles(0, (yaw * 180) / Math.PI, 0);

      // bank into the turn (heading change ahead)
      const aheadYaw = Math.atan2(ahead.tx, ahead.tz);
      let dy = aheadYaw - yaw;
      while (dy > Math.PI) dy -= 2 * Math.PI;
      while (dy < -Math.PI) dy += 2 * Math.PI;
      carTilt.setLocalEulerAngles(0, 0, Math.max(-9, Math.min(9, dy * 60)));

      // chase camera — behind + above, looking just ahead of the car
      const fx = Math.sin(yaw), fz = Math.cos(yaw);
      const desired = new pc.Vec3(here.x - fx * 8, 3.4, here.z - fz * 8);
      if (!camInit) { camPos.copy(desired); camInit = true; }
      else camPos.lerp(camPos, desired, Math.min(1, dt * 3.2));
      camera.setPosition(camPos);
      tmpTarget.set(here.x + fx * 4, 1.1, here.z + fz * 4);
      camera.lookAt(tmpTarget);
    });

    app.start();
    resize();
    window.addEventListener('resize', resize);

    return () => { window.removeEventListener('resize', resize); app.destroy(); };
  }, []);

  return <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" style={{ touchAction: 'none' }} />;
}

// ---------------------------------------------------------------- path / spline

type Sample = { x: number; z: number; tx: number; tz: number };
type Path = { length: number; at: (d: number) => Sample };

function samplePath(ctrl: V3[], per: number): Path {
  const n = ctrl.length;
  const pts: { x: number; z: number }[] = [];
  for (let i = 0; i < n; i++) {
    const p0 = ctrl[(i - 1 + n) % n], p1 = ctrl[i], p2 = ctrl[(i + 1) % n], p3 = ctrl[(i + 2) % n];
    for (let s = 0; s < per; s++) {
      const t = s / per;
      pts.push({ x: catmull(p0[0], p1[0], p2[0], p3[0], t), z: catmull(p0[2], p1[2], p2[2], p3[2], t) });
    }
  }
  // cumulative arc length
  const m = pts.length;
  const cum: number[] = new Array(m + 1);
  cum[0] = 0;
  for (let i = 0; i < m; i++) {
    const a = pts[i], b = pts[(i + 1) % m];
    cum[i + 1] = cum[i] + Math.hypot(b.x - a.x, b.z - a.z);
  }
  const total = cum[m];
  const at = (d: number): Sample => {
    d = ((d % total) + total) % total;
    // binary search segment
    let lo = 0, hi = m;
    while (lo < hi) { const mid = (lo + hi) >> 1; if (cum[mid] <= d) lo = mid + 1; else hi = mid; }
    const i = Math.max(0, lo - 1);
    const a = pts[i], b = pts[(i + 1) % m];
    const segLen = cum[i + 1] - cum[i] || 1;
    const f = (d - cum[i]) / segLen;
    const x = a.x + (b.x - a.x) * f, z = a.z + (b.z - a.z) * f;
    const tlen = Math.hypot(b.x - a.x, b.z - a.z) || 1;
    return { x, z, tx: (b.x - a.x) / tlen, tz: (b.z - a.z) / tlen };
  };
  return { length: total, at };
}

function catmull(p0: number, p1: number, p2: number, p3: number, t: number) {
  const t2 = t * t, t3 = t2 * t;
  return 0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3);
}

// ---------------------------------------------------------------- road ribbon

function buildRoad(app: pc.Application, path: Path) {
  const STEP = 1.4;
  const b = new MeshBuilder();
  const line = new MeshBuilder();
  let prev: { lx: number; lz: number; rx: number; rz: number; clx: number; clz: number; crx: number; crz: number } | null = null;
  const first = sampleEdges(path, 0);
  for (let d = 0; d <= path.length + STEP; d += STEP) {
    const e = d > path.length ? first : sampleEdges(path, d);
    if (prev) {
      b.quad([prev.lx, 0, prev.lz], [e.lx, 0, e.lz], [e.rx, 0, e.rz], [prev.rx, 0, prev.rz], ASPHALT);
      // dashed centre line, lifted to avoid z-fight
      if (Math.floor(d / STEP) % 2 === 0) {
        line.quad([prev.clx, 0.02, prev.clz], [e.clx, 0.02, e.clz], [e.crx, 0.02, e.crz], [prev.crx, 0.02, prev.crz], LINE);
      }
    }
    prev = e;
  }
  const road = b.entity(app, 'road', litVCMat());
  road.setLocalPosition(0, 0.01, 0);
  app.root.addChild(road);
  // a slightly wider darker shoulder under the asphalt
  const shoulder = new MeshBuilder();
  let p2: { lx: number; lz: number; rx: number; rz: number } | null = null;
  for (let d = 0; d <= path.length + STEP; d += STEP) {
    const e = sampleEdges(path, d > path.length ? 0 : d, ROAD_HALF + 0.7);
    if (p2) shoulder.quad([p2.lx, 0, p2.lz], [e.lx, 0, e.lz], [e.rx, 0, e.rz], [p2.rx, 0, p2.rz], ROAD_EDGE);
    p2 = e;
  }
  const sh = shoulder.entity(app, 'shoulder', litVCMat());
  sh.setLocalPosition(0, 0.005, 0);
  app.root.addChild(sh);
  app.root.addChild(line.entity(app, 'centerline', unlitVCMat()));
}

function sampleEdges(path: Path, d: number, half = ROAD_HALF) {
  const s = path.at(d);
  const px = -s.tz, pz = s.tx; // perpendicular in XZ
  return {
    lx: s.x + px * half, lz: s.z + pz * half,
    rx: s.x - px * half, rz: s.z - pz * half,
    clx: s.x + px * 0.12, clz: s.z + pz * 0.12,
    crx: s.x - px * 0.12, crz: s.z - pz * 0.12,
  };
}

// ---------------------------------------------------------------- the little world

function scatterWorld(app: pc.Application, path: Path) {
  const rng = makeRng(7);
  // distance from a point to the road centre (sampled)
  const SAMP = 240;
  const road: { x: number; z: number }[] = [];
  for (let i = 0; i < SAMP; i++) road.push(path.at((i / SAMP) * path.length));
  const distToRoad = (x: number, z: number) => {
    let m = Infinity;
    for (const r of road) { const dx = x - r.x, dz = z - r.z; const d = dx * dx + dz * dz; if (d < m) m = d; }
    return Math.sqrt(m);
  };

  const trunkMat = mat(0x6b5135);
  const leafMats = [mat(0x4f7a3f), mat(0x5d8a46), mat(0x3f6a52)];
  const rockMat = mat(0x8a8f93);
  const hillMat = mat(0x7c9a6a);

  // distant hills (big cones) well outside the loop
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2 + rng() * 0.3;
    const r = 130 + rng() * 60;
    const h = 16 + rng() * 26;
    app.root.addChild(primitive(`hill-${i}`, 'cone', [Math.cos(a) * r, h / 2 - 1, Math.sin(a) * r], [h * 1.4, h, h * 1.4], hillMat, ));
  }

  // trees + rocks scattered, kept off the road
  let placed = 0, tries = 0;
  while (placed < 220 && tries < 4000) {
    tries++;
    const x = (rng() * 2 - 1) * 105, z = (rng() * 2 - 1) * 105;
    const dr = distToRoad(x, z);
    if (dr < ROAD_HALF + 2.5) continue;     // not on the road
    if (Math.hypot(x, z) > 110) continue;    // inside the world disc
    if (rng() < 0.78) {
      // pine: trunk + 2-3 stacked cones
      const tree = new pc.Entity(`tree-${placed}`);
      tree.setLocalPosition(x, 0, z);
      const s = 0.8 + rng() * 0.9;
      tree.setLocalScale(s, s, s);
      child(tree, 'cylinder', [0, 0.7, 0], [0.35, 1.4, 0.35], trunkMat);
      const leaf = leafMats[Math.floor(rng() * leafMats.length)];
      child(tree, 'cone', [0, 2.0, 0], [2.4, 2.4, 2.4], leaf);
      child(tree, 'cone', [0, 3.0, 0], [1.8, 2.0, 1.8], leaf);
      child(tree, 'cone', [0, 3.9, 0], [1.1, 1.6, 1.1], leaf);
      app.root.addChild(tree);
    } else {
      const s = 0.6 + rng() * 1.4;
      app.root.addChild(primitive(`rock-${placed}`, 'sphere', [x, s * 0.35, z], [s * 1.6, s, s * 1.4], rockMat));
    }
    placed++;
  }

  // a small town the road passes through — a cluster of houses near one stretch
  const townAt = path.at(path.length * 0.42);
  const wallMats = [mat(0xe4d6bf), mat(0xd9c3a3), mat(0xcdbfae)];
  const roofMats = [mat(0xb24a36), mat(0x9e6b3b), mat(0x6f7f8c)];
  for (let i = 0; i < 12; i++) {
    const side = i % 2 === 0 ? 1 : -1;
    const along = (Math.floor(i / 2) - 2.5) * 8;
    const s2 = path.at(path.length * 0.42 + along);
    const px = -s2.tz * side, pz = s2.tx * side;
    const off = ROAD_HALF + 3.5 + (i % 3) * 1.4;
    const hx = s2.x + px * off, hz = s2.z + pz * off;
    if (distToRoad(hx, hz) < ROAD_HALF + 2) continue;
    const h = 2.4 + (i % 3) * 1.1;
    const w = 2.6 + (i % 2) * 0.8;
    const house = new pc.Entity(`house-${i}`);
    house.setLocalPosition(hx, 0, hz);
    house.setLocalEulerAngles(0, (Math.atan2(px, pz) * 180) / Math.PI, 0);
    child(house, 'box', [0, h / 2, 0], [w, h, w], wallMats[i % wallMats.length]);
    child(house, 'cone', [0, h + 0.7, 0], [w * 1.05, 1.6, w * 1.05], roofMats[i % roofMats.length], 4);
    app.root.addChild(house);
  }
  void townAt;
}

// ---------------------------------------------------------------- car

function loadCar(app: pc.Application, parent: pc.Entity) {
  const asset = new pc.Asset('cicada_flat', 'container', { url: '/assets/cars/cicada_flat.glb' });
  asset.on('load', () => {
    const holder = new pc.Entity('car-holder');
    holder.setLocalEulerAngles(0, 90, 0); // model nose is -x → point at +z (local forward)
    parent.addChild(holder);
    const model = (asset.resource as pc.ContainerResource).instantiateRenderEntity();
    holder.addChild(model);
    const aabb = new pc.BoundingBox();
    let first = true;
    for (const render of holder.findComponents('render') as pc.RenderComponent[]) {
      for (const mi of render.meshInstances) {
        if (first) { aabb.copy(mi.aabb); first = false; } else aabb.add(mi.aabb);
      }
    }
    // the AABB is world-space and the rig is already driving the loop by the time
    // the GLB finishes loading — subtract the rig's current world position so the
    // model centres on the rig origin (wheels onto y=0), not on wherever it is now.
    const rigPos = parent.getPosition().clone();
    const center = aabb.center.clone();
    const min = aabb.getMin().clone();
    const s = 1.9 / (aabb.halfExtents.x * 2);
    holder.setLocalScale(s, s, s);
    holder.setLocalPosition(
      -(center.x - rigPos.x) * s,
      -(min.y - rigPos.y) * s,
      -(center.z - rigPos.z) * s,
    );
  });
  asset.on('error', (e: string) => console.error('car glb failed:', e));
  app.assets.add(asset);
  app.assets.load(asset);
}

// ---------------------------------------------------------------- mesh + material helpers

class MeshBuilder {
  positions: number[] = [];
  normals: number[] = [];
  colors: number[] = [];
  tri(a: V3, b: V3, c: V3, col: number) {
    const n = faceNormal(a, b, c);
    this.positions.push(...a, ...b, ...c);
    this.normals.push(...n, ...n, ...n);
    pushColor(this.colors, col); pushColor(this.colors, col); pushColor(this.colors, col);
  }
  quad(a: V3, b: V3, c: V3, d: V3, col: number) { this.tri(a, b, c, col); this.tri(a, c, d, col); }
  entity(app: pc.Application, name: string, material: pc.Material): pc.Entity {
    const mesh = new pc.Mesh(app.graphicsDevice);
    mesh.setPositions(this.positions);
    mesh.setNormals(this.normals);
    mesh.setColors(this.colors, 4);
    mesh.update(pc.PRIMITIVE_TRIANGLES);
    const e = new pc.Entity(name);
    e.addComponent('render', { meshInstances: [new pc.MeshInstance(mesh, material)] });
    return e;
  }
}

function faceNormal(a: V3, b: V3, c: V3): V3 {
  const ab: V3 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const ac: V3 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
  const cr: V3 = [ab[1] * ac[2] - ab[2] * ac[1], ab[2] * ac[0] - ab[0] * ac[2], ab[0] * ac[1] - ab[1] * ac[0]];
  const l = Math.hypot(cr[0], cr[1], cr[2]) || 1;
  return [cr[0] / l, cr[1] / l, cr[2] / l];
}

function pushColor(arr: number[], hex: number) {
  arr.push(((hex >> 16) & 255) / 255, ((hex >> 8) & 255) / 255, (hex & 255) / 255, 1);
}

function color(hex: number, intensity = 1) {
  return new pc.Color(((hex >> 16) & 255) / 255 * intensity, ((hex >> 8) & 255) / 255 * intensity, (hex & 255) / 255 * intensity, 1);
}

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
  m.diffuse = new pc.Color(0, 0, 0);
  m.emissive = new pc.Color(1, 1, 1);
  m.emissiveVertexColor = true;
  m.update();
  return m;
}

function mat(hex: number) {
  const m = new pc.StandardMaterial();
  m.diffuse = color(hex, 1);
  m.update();
  return m;
}

function shadowMat() {
  const m = new pc.StandardMaterial();
  m.useLighting = false;
  m.diffuse = new pc.Color(0, 0, 0);
  m.emissive = new pc.Color(0, 0, 0);
  m.opacity = 0.22;
  m.blendType = pc.BLEND_NORMAL;
  m.depthWrite = false;
  m.update();
  return m;
}

function primitive(name: string, type: 'box' | 'sphere' | 'cone' | 'cylinder', pos: V3, scale: V3, material: pc.Material, segments?: number) {
  const e = new pc.Entity(name);
  e.addComponent('render', { type, material, ...(segments ? { segments } : {}) });
  e.setLocalPosition(pos[0], pos[1], pos[2]);
  e.setLocalScale(scale[0], scale[1], scale[2]);
  return e;
}

function child(parent: pc.Entity, type: 'box' | 'sphere' | 'cone' | 'cylinder', pos: V3, scale: V3, material: pc.Material, segments?: number) {
  const e = primitive(`${parent.name}-part`, type, pos, scale, material, segments);
  parent.addChild(e);
  return e;
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
