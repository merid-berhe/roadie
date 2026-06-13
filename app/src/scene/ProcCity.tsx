// v6.6 SPIKE — hand-built (procedural) explorable cities in PlayCanvas. Goal:
// clearly richer than our flat-primitive scenes, but cartoonish + fully under
// our control, and big enough to DRIVE around (a real street grid → turns both
// ways). Two distinct styles to compare: Tokyo (dusk, neon towers) and Addis
// Ababa (daytime, corrugated-roof hillside settlement). Reached at ?proc=tokyo
// / ?proc=addis. Same drivable car + chase cam as the city spike.
import { useEffect, useRef } from 'react';
import * as pc from 'playcanvas';

type Style = 'tokyo' | 'addis';

export default function ProcCity({ style }: { style: Style }) {
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

    const cfg = style === 'tokyo' ? TOKYO : ADDIS;

    // --- rendering (the fidelity our flat scenes never used)
    app.scene.ambientLight = color(cfg.ambient, cfg.ambientI);
    app.scene.exposure = 1.05;
    app.scene.fog.type = pc.FOG_LINEAR;
    app.scene.fog.color = color(cfg.fog, 1);
    app.scene.fog.start = cfg.fogStart;
    app.scene.fog.end = cfg.fogEnd;

    const camera = new pc.Entity('camera');
    camera.addComponent('camera', { clearColor: color(cfg.sky, 1), fov: 62, nearClip: 0.1, farClip: 600 });
    camera.camera!.toneMapping = pc.TONEMAP_ACES;
    app.root.addChild(camera);

    const sun = new pc.Entity('sun');
    sun.addComponent('light', {
      type: 'directional', color: color(cfg.sun, 1), intensity: cfg.sunI,
      castShadows: true, shadowType: pc.SHADOW_PCF5, shadowResolution: 2048,
      shadowDistance: 120, shadowBias: 0.04, normalOffsetBias: 0.06, shadowIntensity: 0.8,
    });
    sun.setEulerAngles(cfg.sunEuler[0], cfg.sunEuler[1], 0);
    app.root.addChild(sun);
    const fill = new pc.Entity('fill');
    fill.addComponent('light', { type: 'directional', color: color(cfg.fill, 1), intensity: 0.7 });
    fill.setEulerAngles(-15, cfg.sunEuler[1] + 180, 0);
    app.root.addChild(fill);

    // --- ground
    box(app.root, [0, -0.5, 0], [SPAN * 2, 1, SPAN * 2], mat(cfg.ground), { cast: false });

    // --- the city (one merged lit mesh for walls/roofs + one emissive mesh for lights)
    const lit = new MeshBuilder();
    const emis = new MeshBuilder();
    const rng = makeRng(style === 'tokyo' ? 11 : 23);
    (style === 'tokyo' ? buildTokyo : buildAddis)(lit, emis, rng);
    const litE = lit.entity(app, 'city-lit', litVCMat());
    litE.render!.castShadows = true; litE.render!.receiveShadows = true;
    app.root.addChild(litE);
    if (emis.positions.length) app.root.addChild(emis.entity(app, 'city-emissive', unlitVCMat()));

    // a few standalone props (trees / neon blades) that read better as primitives
    addProps(app, style, rng);

    // --- car (kinematic drive) + chase cam — same as the city spike
    const carRig = new pc.Entity('car-rig');
    carRig.setPosition(0, 0, ROAD_W); // sitting on a street
    app.root.addChild(carRig);
    let carYaw = 0, speed = 0;
    const carTilt = new pc.Entity('car-tilt');
    carRig.addChild(carTilt);
    const carAsset = new pc.Asset('car', 'container', { url: '/assets/cars/cicada_flat.glb' });
    carAsset.on('load', () => {
      const holder = new pc.Entity('h');
      holder.setLocalEulerAngles(0, 90, 0);
      carTilt.addChild(holder);
      holder.addChild((carAsset.resource as pc.ContainerResource).instantiateRenderEntity());
      const aabb = new pc.BoundingBox(); let f = true;
      for (const rc of holder.findComponents('render') as pc.RenderComponent[]) {
        rc.castShadows = true;
        for (const mi of rc.meshInstances) { if (f) { aabb.copy(mi.aabb); f = false; } else aabb.add(mi.aabb); }
      }
      const s = 2.0 / (aabb.halfExtents.x * 2);
      const c = aabb.center.clone(), min = aabb.getMin().clone();
      holder.setLocalScale(s, s, s);
      holder.setLocalPosition(-c.x * s, -min.y * s, -c.z * s);
    });
    app.assets.add(carAsset); app.assets.load(carAsset);

    const keys: Record<string, boolean> = {};
    const kd = (e: KeyboardEvent) => { keys[e.key.toLowerCase()] = true; if (e.key.startsWith('Arrow')) e.preventDefault(); };
    const ku = (e: KeyboardEvent) => { keys[e.key.toLowerCase()] = false; };
    window.addEventListener('keydown', kd); window.addEventListener('keyup', ku);

    const overhead = new URLSearchParams(window.location.search).has('top');
    const camPos = new pc.Vec3(); let camInit = false; const tmp = new pc.Vec3();
    app.on('update', (dt: number) => {
      if (overhead) {
        camera.setPosition(SPAN * 0.7, SPAN * 1.1, SPAN * 0.7);
        camera.lookAt(0, 0, 0);
        return;
      }
      const accel = (keys['arrowup'] || keys['w'] ? 1 : 0) - (keys['arrowdown'] || keys['s'] ? 1 : 0);
      const steer = (keys['arrowleft'] || keys['a'] ? 1 : 0) - (keys['arrowright'] || keys['d'] ? 1 : 0);
      speed += accel * 14 * dt;
      speed *= 1 - Math.min(1, (accel === 0 ? 2.0 : 0.5) * dt);
      speed = Math.max(-5, Math.min(13, speed));
      carYaw += steer * 1.6 * dt * Math.max(0.15, Math.min(1, Math.abs(speed) / 5)) * Math.sign(speed || 1);
      const fx = Math.sin(carYaw), fz = Math.cos(carYaw);
      const p = carRig.getPosition();
      const nx = Math.max(-SPAN, Math.min(SPAN, p.x + fx * speed * dt));
      const nz = Math.max(-SPAN, Math.min(SPAN, p.z + fz * speed * dt));
      carRig.setPosition(nx, 0, nz);
      carRig.setEulerAngles(0, (carYaw * 180) / Math.PI, 0);
      carTilt.setLocalEulerAngles(0, 0, -steer * Math.min(1, Math.abs(speed) / 6) * 5);
      const here = carRig.getPosition();
      const desired = tmp.set(here.x - fx * 9, 4.4, here.z - fz * 9);
      if (!camInit) { camPos.copy(desired); camInit = true; } else camPos.lerp(camPos, desired, Math.min(1, dt * 3.5));
      camera.setPosition(camPos);
      camera.lookAt(here.x + fx * 5, 1.4, here.z + fz * 5);
    });

    app.start();
    resize();
    window.addEventListener('resize', resize);
    return () => {
      window.removeEventListener('resize', resize);
      window.removeEventListener('keydown', kd); window.removeEventListener('keyup', ku);
      app.destroy();
    };
  }, [style]);

  return <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" style={{ touchAction: 'none' }} tabIndex={0} />;
}

// ---------------------------------------------------------------- layout constants
const GRID = 5;          // blocks per axis
const BLOCK = 13;        // block footprint
const ROAD_W = 6;        // street width
const CELL = BLOCK + ROAD_W;
const SPAN = (GRID * CELL) / 2;

function blockCenters(): [number, number][] {
  const out: [number, number][] = [];
  const start = -((GRID - 1) / 2) * CELL;
  for (let i = 0; i < GRID; i++) for (let j = 0; j < GRID; j++) out.push([start + i * CELL, start + j * CELL]);
  return out;
}

// ---------------------------------------------------------------- TOKYO (dusk, neon towers)
function buildTokyo(lit: MeshBuilder, emis: MeshBuilder, rng: () => number) {
  const SIDEWALK = 0x2a2f3a, TOWER = [0x2b3340, 0x333b48, 0x232a36, 0x3a4150];
  const WIN_ON = [0xffd98a, 0xfff0c8, 0x9fd0ff, 0xffe6a0];
  const NEON = [0xff4d8d, 0x37e0ff, 0xffd23d, 0xff6a3d, 0x8a6cff];
  for (const [bx, bz] of blockCenters()) {
    lit.boxTop([bx, 0.04, bz], [BLOCK, 0.08, BLOCK], SIDEWALK); // sidewalk pad
    const towers = 1 + Math.floor(rng() * 3);
    for (let t = 0; t < towers; t++) {
      const w = 3 + rng() * 3.5, d = 3 + rng() * 3.5;
      const h = 5 + rng() * 14;
      const x = bx + (rng() - 0.5) * (BLOCK - w - 1);
      const z = bz + (rng() - 0.5) * (BLOCK - d - 1);
      const body = TOWER[Math.floor(rng() * TOWER.length)];
      lit.box([x, h / 2 + 0.08, z], [w, h, d], body);
      // window grid baked into the emissive mesh on the 4 faces
      windowGrid(emis, x, z, w, d, h, rng, WIN_ON);
      // a neon blade on some street-facing towers
      if (rng() < 0.5) {
        const nh = 1.2 + rng() * 3;
        const col = NEON[Math.floor(rng() * NEON.length)];
        emis.box([x + (w / 2 + 0.12) * (rng() < 0.5 ? 1 : -1), h * 0.55, z], [0.18, nh, 0.6], col);
      }
    }
  }
  // street centre lines on the avenues
  drawStreets(lit, 0x3a3f48, 0xb9a44a, true);
}

function windowGrid(emis: MeshBuilder, x: number, z: number, w: number, d: number, h: number, rng: () => number, on: number[]) {
  const floors = Math.max(2, Math.floor(h / 1.4));
  const colsW = Math.max(2, Math.floor(w / 1.1));
  const colsD = Math.max(2, Math.floor(d / 1.1));
  const place = (fx: number, fz: number, faceW: number, axis: 'x' | 'z') => {
    const cols = axis === 'x' ? colsW : colsD;
    for (let f = 1; f < floors; f++) {
      for (let c = 0; c < cols; c++) {
        if (rng() < 0.32) continue; // some windows dark
        const yy = (f / floors) * h + 0.08;
        const off = (c + 0.5) / cols - 0.5;
        const col = on[Math.floor(rng() * on.length)];
        if (axis === 'x') emis.quadXZ(x + off * faceW, yy, fz, 0.55, 0.6, col, 'x');
        else emis.quadXZ(fx, yy, z + off * faceW, 0.55, 0.6, col, 'z');
      }
    }
  };
  place(0, z + d / 2 + 0.02, w, 'x');
  place(0, z - d / 2 - 0.02, w, 'x');
  place(x + w / 2 + 0.02, 0, d, 'z');
  place(x - w / 2 - 0.02, 0, d, 'z');
}

// ---------------------------------------------------------------- ADDIS (day, corrugated-roof settlement)
function buildAddis(lit: MeshBuilder, _emis: MeshBuilder, rng: () => number) {
  const EARTH = 0x9c7b54;
  const WALL = [0xcdb89a, 0xb8c2c0, 0xc8a07a, 0x9fb0a6, 0xd9c7a0, 0xa8bcc6];
  const ROOF = [0x8a4b3a, 0x9a9ea1, 0x7d4636, 0xb56b4a, 0x8f9499];
  for (const [bx, bz] of blockCenters()) {
    lit.boxTop([bx, 0.03, bz], [BLOCK + 1, 0.06, BLOCK + 1], EARTH); // packed-earth lot
    const huts = 3 + Math.floor(rng() * 4);
    for (let t = 0; t < huts; t++) {
      const w = 2 + rng() * 2.2, d = 2 + rng() * 2.2;
      const h = 1.6 + rng() * 1.6;
      const x = bx + (rng() - 0.5) * (BLOCK - w);
      const z = bz + (rng() - 0.5) * (BLOCK - d);
      lit.box([x, h / 2 + 0.03, z], [w, h, d], WALL[Math.floor(rng() * WALL.length)]);
      // corrugated roof: a thin wide slab, tilted, overhanging
      const roof = ROOF[Math.floor(rng() * ROOF.length)];
      lit.tiltedSlab(x, h + 0.03, z, w + 0.5, d + 0.5, 0.12, (rng() - 0.5) * 0.25, roof);
    }
  }
  drawStreets(lit, EARTH, 0, false);
}

// ---------------------------------------------------------------- shared world bits
function drawStreets(lit: MeshBuilder, roadCol: number, lineCol: number, lines: boolean) {
  const start = -((GRID - 1) / 2) * CELL;
  // we leave the ground as the road; just lay centre lines on Tokyo avenues
  if (!lines) return;
  for (let i = 0; i < GRID; i++) {
    const c = start + i * CELL - CELL / 2;
    for (let s = -SPAN; s < SPAN; s += 3) {
      lit.boxTop([c, 0.02, s], [0.18, 0.01, 1.6], lineCol);
      lit.boxTop([s, 0.02, c], [1.6, 0.01, 0.18], lineCol);
    }
  }
  void roadCol;
}

function addProps(app: pc.Application, style: Style, rng: () => number) {
  if (style === 'addis') {
    // eucalyptus + hills
    const trunk = mat(0x6b5a3c), canopy = mat(0x5f7a52);
    for (let i = 0; i < 40; i++) {
      const x = (rng() - 0.5) * SPAN * 1.9, z = (rng() - 0.5) * SPAN * 1.9;
      if (Math.abs(x) < SPAN && Math.abs(z) < SPAN && (Math.abs(x) % CELL < BLOCK)) { /* allow */ }
      const e = new pc.Entity('euc'); e.setLocalPosition(x, 0, z);
      const s = 0.8 + rng() * 0.8; e.setLocalScale(s, s, s);
      child(e, 'cylinder', [0, 1.6, 0], [0.22, 3.2, 0.22], trunk);
      child(e, 'cone', [0, 3.4, 0], [1.3, 1.8, 1.3], canopy);
      app.root.addChild(e);
    }
    const hill = mat(0x8a9a6c);
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2 + rng();
      const r = SPAN * 1.5 + rng() * 40, h = 14 + rng() * 22;
      app.root.addChild(primitive(`hill${i}`, 'cone', [Math.cos(a) * r, h / 2 - 2, Math.sin(a) * r], [h * 1.6, h, h * 1.6], hill));
    }
  } else {
    // tokyo: a couple of big rooftop neon billboards
    const NEON = [0xff4d8d, 0x37e0ff, 0xffd23d];
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + rng();
      const r = SPAN * 0.5 + rng() * SPAN * 0.4;
      const e = primitive(`bb${i}`, 'box', [Math.cos(a) * r, 6 + rng() * 10, Math.sin(a) * r], [0.3, 2 + rng() * 2, 3 + rng() * 2], emissiveMat(NEON[i % NEON.length]));
      e.setLocalEulerAngles(0, rng() * 360, 0);
      app.root.addChild(e);
    }
  }
}

// ---------------------------------------------------------------- mesh + helpers
type V3 = [number, number, number];
class MeshBuilder {
  positions: number[] = []; normals: number[] = []; colors: number[] = [];
  tri(a: V3, b: V3, c: V3, col: number) {
    const n = faceNormal(a, b, c);
    this.positions.push(...a, ...b, ...c);
    this.normals.push(...n, ...n, ...n);
    pushColor(this.colors, col); pushColor(this.colors, col); pushColor(this.colors, col);
  }
  quad(a: V3, b: V3, c: V3, d: V3, col: number) { this.tri(a, b, c, col); this.tri(a, c, d, col); }
  // axis-aligned box, 5 faces (no bottom), outward normals
  box(center: V3, size: V3, col: number) {
    const [cx, cy, cz] = center; const [w, h, d] = size;
    const x0 = cx - w / 2, x1 = cx + w / 2, y0 = cy - h / 2, y1 = cy + h / 2, z0 = cz - d / 2, z1 = cz + d / 2;
    this.quad([x0, y1, z0], [x0, y1, z1], [x1, y1, z1], [x1, y1, z0], col);   // top +y
    this.quad([x0, y0, z1], [x0, y1, z1], [x0, y1, z0], [x0, y0, z0], col);   // -x
    this.quad([x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1], col);   // +x
    this.quad([x1, y0, z1], [x1, y1, z1], [x0, y1, z1], [x0, y0, z1], col);   // +z
    this.quad([x0, y0, z0], [x0, y1, z0], [x1, y1, z0], [x1, y0, z0], col);   // -z
  }
  boxTop(center: V3, size: V3, col: number) { // just a top quad (pads/lines)
    const [cx, cy, cz] = center; const [w, , d] = size;
    this.quad([cx - w / 2, cy, cz - d / 2], [cx - w / 2, cy, cz + d / 2], [cx + w / 2, cy, cz + d / 2], [cx + w / 2, cy, cz - d / 2], col);
  }
  tiltedSlab(cx: number, cy: number, cz: number, w: number, d: number, t: number, tilt: number, col: number) {
    const dy = (d / 2) * tilt;
    this.quad([cx - w / 2, cy - dy, cz - d / 2], [cx - w / 2, cy + dy, cz + d / 2], [cx + w / 2, cy + dy, cz + d / 2], [cx + w / 2, cy - dy, cz - d / 2], col);
    void t;
  }
  quadXZ(x: number, y: number, z: number, w: number, h: number, col: number, face: 'x' | 'z') {
    if (face === 'x') this.quad([x - w / 2, y - h / 2, z], [x - w / 2, y + h / 2, z], [x + w / 2, y + h / 2, z], [x + w / 2, y - h / 2, z], col);
    else this.quad([x, y - h / 2, z - w / 2], [x, y + h / 2, z - w / 2], [x, y + h / 2, z + w / 2], [x, y - h / 2, z + w / 2], col);
  }
  entity(app: pc.Application, name: string, material: pc.Material): pc.Entity {
    const mesh = new pc.Mesh(app.graphicsDevice);
    mesh.setPositions(this.positions); mesh.setNormals(this.normals); mesh.setColors(this.colors, 4);
    mesh.update(pc.PRIMITIVE_TRIANGLES);
    const e = new pc.Entity(name);
    e.addComponent('render', { meshInstances: [new pc.MeshInstance(mesh, material)] });
    return e;
  }
}
function faceNormal(a: V3, b: V3, c: V3): V3 {
  const ab: V3 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], ac: V3 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
  const cr: V3 = [ab[1] * ac[2] - ab[2] * ac[1], ab[2] * ac[0] - ab[0] * ac[2], ab[0] * ac[1] - ab[1] * ac[0]];
  const l = Math.hypot(cr[0], cr[1], cr[2]) || 1; return [cr[0] / l, cr[1] / l, cr[2] / l];
}
function pushColor(a: number[], hex: number) { a.push(((hex >> 16) & 255) / 255, ((hex >> 8) & 255) / 255, (hex & 255) / 255, 1); }
function color(hex: number, i = 1) { return new pc.Color(((hex >> 16) & 255) / 255 * i, ((hex >> 8) & 255) / 255 * i, (hex & 255) / 255 * i, 1); }
function litVCMat() { const m = new pc.StandardMaterial(); m.diffuse = new pc.Color(1, 1, 1); m.diffuseVertexColor = true; m.update(); return m; }
function unlitVCMat() { const m = new pc.StandardMaterial(); m.useLighting = false; m.cull = pc.CULLFACE_NONE; m.diffuse = new pc.Color(0, 0, 0); m.emissive = new pc.Color(1, 1, 1); m.emissiveVertexColor = true; m.update(); return m; }
function mat(hex: number) { const m = new pc.StandardMaterial(); m.diffuse = color(hex); m.update(); return m; }
function emissiveMat(hex: number) { const m = new pc.StandardMaterial(); m.useLighting = false; m.diffuse = new pc.Color(0, 0, 0); m.emissive = color(hex); m.update(); return m; }
function primitive(name: string, type: 'box' | 'sphere' | 'cone' | 'cylinder', pos: V3, scale: V3, material: pc.Material) {
  const e = new pc.Entity(name); e.addComponent('render', { type, material });
  e.setLocalPosition(...pos); e.setLocalScale(...scale);
  if (e.render) e.render.castShadows = true;
  return e;
}
function child(parent: pc.Entity, type: 'box' | 'sphere' | 'cone' | 'cylinder', pos: V3, scale: V3, material: pc.Material) {
  const e = primitive(`${parent.name}-p`, type, pos, scale, material); parent.addChild(e); return e;
}
function box(parent: pc.Entity, pos: V3, scale: V3, material: pc.Material, opts?: { cast?: boolean }) {
  const e = primitive('box', 'box', pos, scale, material);
  if (e.render) { e.render.castShadows = opts?.cast !== false; e.render.receiveShadows = true; }
  parent.addChild(e); return e;
}
function makeRng(seed: number) { let s = seed >>> 0; return () => { s = (s + 0x6d2b79f5) >>> 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

const TOKYO = {
  sky: 0x2a3550, ground: 0x23262e, ambient: 0x3a4a66, ambientI: 1.1,
  sun: 0xffcea0, sunI: 1.6, sunEuler: [22, 40] as [number, number], fill: 0x4a6a9a,
  fog: 0x2a3550, fogStart: 30, fogEnd: 150,
};
const ADDIS = {
  sky: 0xcfd8d0, ground: 0x9c7b54, ambient: 0xc9c2a8, ambientI: 1.2,
  sun: 0xfff2d0, sunI: 3.0, sunEuler: [55, 30] as [number, number], fill: 0xbcc6c0,
  fog: 0xd6dcc8, fogStart: 45, fogEnd: 170,
};
