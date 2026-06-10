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

type Theme = {
  sky: number;
  fog: number;
  road: number;
  lane: number;
  shoulder: number;
  ground: number;
  accent: number;
  accent2: number;
  light: number;
};

type MovingEntity = {
  entity: pc.Entity;
  base: number;
  side?: -1 | 1;
};

const FAR = 170;
const WORLD_SPEED = 6.2;

const THEMES: Record<RoadId, Theme> = {
  desert: {
    sky: 0x241643,
    fog: 0xf48b5f,
    road: 0x302b2a,
    lane: 0xf4d35e,
    shoulder: 0x6f492c,
    ground: 0xb8733a,
    accent: 0x2f6f46,
    accent2: 0xcf7d3f,
    light: 0xffc77a,
  },
  coast: {
    sky: 0x7fc8df,
    fog: 0xffd88f,
    road: 0x34383c,
    lane: 0xf6f7f2,
    shoulder: 0x456d4d,
    ground: 0x6b8d56,
    accent: 0x146f8d,
    accent2: 0xd6b07a,
    light: 0xffe1a8,
  },
  mountain: {
    sky: 0x223656,
    fog: 0x7fa0c8,
    road: 0x2d3034,
    lane: 0xe8edf2,
    shoulder: 0x263f31,
    ground: 0x3d5b42,
    accent: 0x123021,
    accent2: 0xaab8c4,
    light: 0xdcecff,
  },
  city: {
    sky: 0x090a16,
    fog: 0x20133c,
    road: 0x121218,
    lane: 0x6f77ff,
    shoulder: 0x171821,
    ground: 0x101016,
    accent: 0xffc766,
    accent2: 0x54d6e3,
    light: 0xc8dcff,
  },
};

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
    app.scene.ambientLight = color(theme.light, 0.42);
    app.scene.fog.type = pc.FOG_LINEAR;
    app.scene.fog.color = color(theme.fog, 1);
    app.scene.fog.start = 34;
    app.scene.fog.end = FAR;

    const camera = new pc.Entity('camera');
    camera.addComponent('camera', {
      clearColor: color(theme.sky, 1),
      fov: 68,
      nearClip: 0.03,
      farClip: FAR + 20,
    });
    camera.setPosition(0, 1.08, 2.8);
    camera.lookAt(0, 0.42, -20);
    app.root.addChild(camera);

    const key = new pc.Entity('key-light');
    key.addComponent('light', {
      type: 'directional',
      color: color(theme.light, 1),
      intensity: road === 'city' ? 1.2 : 2.2,
      castShadows: false,
    });
    key.setEulerAngles(45, -35, 0);
    app.root.addChild(key);

    const roadMat = mat(theme.road, road === 'city' ? 0.15 : 0.45);
    const laneMat = mat(theme.lane, road === 'city' ? 1.0 : 0.2);
    const shoulderMat = mat(theme.shoulder, 0.28);
    const groundMat = mat(theme.ground, 0.34);
    const accentMat = mat(theme.accent, road === 'city' ? 0.8 : 0.18);
    const accent2Mat = mat(theme.accent2, road === 'city' ? 0.8 : 0.2);
    const darkMat = mat(0x080a11, 0.12);
    const trimMat = mat(0x161a24, 0.18);
    const glassMat = mat(0x87c7ff, 0.15, 0.18);

    const moving: MovingEntity[] = [];
    const gestures: pc.Entity[] = [];
    const fireworks: { entity: pc.Entity; vel: pc.Vec3; life: number }[] = [];
    let lastFirework = fireworkRef.current;

    createGround(app, groundMat, accentMat, road);
    createRoad(app, moving, roadMat, laneMat, shoulderMat);
    createThemeProps(app, moving, road, accentMat, accent2Mat, groundMat);
    createRideCapsule(app, camera, darkMat, trimMat, glassMat, driverColorRef.current, passengerColorRef.current, gestures);

    const resize = () => {
      const rect = mount.getBoundingClientRect();
      app.resizeCanvas(Math.max(1, rect.width), Math.max(1, rect.height));
    };
    const observer = new ResizeObserver(resize);
    observer.observe(mount);
    resize();

    app.on('update', (dt: number) => {
      const offset = positionRef.current * WORLD_SPEED;
      for (const item of moving) {
        const z = -FAR + positiveMod(item.base + offset, FAR);
        item.entity.setLocalPosition(item.entity.getLocalPosition().x, item.entity.getLocalPosition().y, z);
      }

      const sway = Math.sin(positionRef.current * 2.2) * 0.015;
      camera.setLocalPosition(sway, 1.08 + Math.sin(positionRef.current * 4.1) * 0.006, 2.8);
      camera.lookAt(sway * 0.6, 0.42, -20);

      updateCapsuleGestures(gestures, driverGestureRef.current, passengerGestureRef.current);

      const fw = fireworkRef.current;
      if (fw && fw !== lastFirework) {
        lastFirework = fw;
        spawnFirework(app, fireworks, fw.synced, colorToNumber(driverColorRef.current), colorToNumber(passengerColorRef.current));
      }
      for (let i = fireworks.length - 1; i >= 0; i--) {
        const p = fireworks[i];
        const pos = p.entity.getPosition();
        p.vel.y -= dt * 1.2;
        p.entity.setPosition(pos.x + p.vel.x * dt, pos.y + p.vel.y * dt, pos.z + p.vel.z * dt);
        p.life -= dt;
        const s = Math.max(0.01, p.life * 0.08);
        p.entity.setLocalScale(s, s, s);
        if (p.life <= 0) {
          p.entity.destroy();
          fireworks.splice(i, 1);
        }
      }
    });

    app.start();

    return () => {
      observer.disconnect();
      app.destroy();
      canvas.remove();
    };
  }, [road]);

  return <div ref={mountRef} className="absolute inset-0" />;
}

function createGround(app: pc.Application, groundMat: pc.Material, accentMat: pc.Material, road: RoadId) {
  box(app, 'ground-left', [-9, -0.7, -75], [16, 0.08, FAR], groundMat);
  box(app, 'ground-right', [9, -0.7, -75], [16, 0.08, FAR], groundMat);

  if (road === 'coast') {
    const ocean = box(app, 'ocean', [8.5, -0.64, -78], [12, 0.06, FAR], accentMat);
    ocean.setEulerAngles(0, 0, 0);
  }
}

function createRoad(
  app: pc.Application,
  moving: MovingEntity[],
  roadMat: pc.Material,
  laneMat: pc.Material,
  shoulderMat: pc.Material,
) {
  const segmentCount = 38;
  const gap = FAR / segmentCount;
  for (let i = 0; i < segmentCount; i++) {
    const base = i * gap;
    moving.push({ entity: box(app, `road-${i}`, [0, -0.62, -FAR + base], [3.2, 0.05, gap + 0.18], roadMat), base });
    moving.push({ entity: box(app, `shoulder-l-${i}`, [-2.1, -0.615, -FAR + base], [0.9, 0.035, gap + 0.18], shoulderMat), base });
    moving.push({ entity: box(app, `shoulder-r-${i}`, [2.1, -0.615, -FAR + base], [0.9, 0.035, gap + 0.18], shoulderMat), base });
  }

  for (let i = 0; i < 22; i++) {
    const base = i * 7.6;
    moving.push({ entity: box(app, `lane-${i}`, [0, -0.57, -FAR + base], [0.08, 0.04, 2.1], laneMat), base });
  }
}

function createThemeProps(
  app: pc.Application,
  moving: MovingEntity[],
  road: RoadId,
  accentMat: pc.Material,
  accent2Mat: pc.Material,
  groundMat: pc.Material,
) {
  for (let i = 0; i < 34; i++) {
    const base = i * 5.3;
    const side = i % 2 === 0 ? -1 : 1;
    const x = side * (3.2 + ((i * 13) % 4) * 0.45);

    if (road === 'city') {
      const h = 1.2 + ((i * 17) % 7) * 0.42;
      const b = box(app, `building-${i}`, [x + side * 0.8, -0.7 + h / 2, -FAR + base], [1.1 + (i % 3) * 0.4, h, 1.4], i % 3 === 0 ? accent2Mat : groundMat);
      moving.push({ entity: b, base, side });
      if (i % 2 === 0) moving.push({ entity: box(app, `lamp-${i}`, [side * 2.75, 0.1, -FAR + base + 1.2], [0.08, 1.4, 0.08], accentMat), base: base + 1.2, side });
    } else if (road === 'mountain') {
      const trunk = box(app, `pine-trunk-${i}`, [x, -0.15, -FAR + base], [0.13, 0.85, 0.13], groundMat);
      const crown = cone(app, `pine-${i}`, [x, 0.55, -FAR + base], [0.75, 1.25, 0.75], accentMat, 7);
      moving.push({ entity: trunk, base, side }, { entity: crown, base, side });
      if (i % 6 === 0) moving.push({ entity: cone(app, `peak-${i}`, [side * 7, 1.1, -FAR + base - 12], [3.2, 4.4, 3.2], accent2Mat, 5), base: base - 12, side });
    } else if (road === 'coast') {
      if (side < 0) {
        moving.push({ entity: box(app, `cliff-${i}`, [x - 0.8, -0.25, -FAR + base], [1.2, 0.9, 1.4], accent2Mat), base, side });
      } else {
        moving.push({ entity: box(app, `post-${i}`, [x, -0.25, -FAR + base], [0.16, 0.75, 0.16], accentMat), base, side });
      }
    } else {
      const trunk = cylinder(app, `cactus-trunk-${i}`, [x, 0.0, -FAR + base], [0.15, 0.95, 0.15], accentMat);
      moving.push({ entity: trunk, base, side });
      if (i % 3 === 0) moving.push({ entity: box(app, `mesa-${i}`, [side * 7.5, 0.15, -FAR + base - 8], [2.6, 0.8, 2.4], accent2Mat), base: base - 8, side });
    }
  }
}

function createRideCapsule(
  app: pc.Application,
  camera: pc.Entity,
  darkMat: pc.Material,
  trimMat: pc.Material,
  glassMat: pc.Material,
  driverColor: string,
  passengerColor: string,
  gestures: pc.Entity[],
) {
  const capsule = new pc.Entity('ride-capsule');
  camera.addChild(capsule);

  box(app, 'dash', [0, -0.54, -1.18], [2.7, 0.32, 0.42], trimMat, capsule);
  box(app, 'dash-lip', [0, -0.31, -1.25], [2.9, 0.09, 0.16], darkMat, capsule);
  box(app, 'left-pillar', [-1.18, 0.03, -1.34], [0.13, 1.32, 0.11], darkMat, capsule).setEulerAngles(0, 0, -8);
  box(app, 'right-pillar', [1.18, 0.03, -1.34], [0.13, 1.32, 0.11], darkMat, capsule).setEulerAngles(0, 0, 8);
  box(app, 'roof-band', [0, 0.73, -1.3], [2.7, 0.12, 0.12], darkMat, capsule);
  box(app, 'windshield-glow', [0, 0.13, -1.48], [2.05, 0.04, 0.06], glassMat, capsule);

  createOccupant(app, capsule, 'driver', [-0.44, -0.22, -1.52], driverColor, gestures);
  createOccupant(app, capsule, 'passenger', [0.44, -0.22, -1.52], passengerColor, gestures);
}

function createOccupant(app: pc.Application, parent: pc.Entity, name: string, pos: [number, number, number], colorHex: string, gestures: pc.Entity[]) {
  const bodyMat = mat(colorToNumber(colorHex), 0.18);
  const body = box(app, `${name}-body`, [pos[0], pos[1], pos[2]], [0.32, 0.38, 0.18], bodyMat, parent);
  const head = sphere(app, `${name}-head`, [pos[0], pos[1] + 0.32, pos[2] - 0.02], [0.18, 0.18, 0.18], bodyMat, parent);
  const hand = sphere(app, `${name}-gesture`, [pos[0] + (name === 'driver' ? 0.25 : -0.25), pos[1] + 0.36, pos[2] - 0.08], [0.08, 0.08, 0.08], bodyMat, parent);
  hand.enabled = false;
  gestures.push(body, head, hand);
}

function updateCapsuleGestures(gestures: pc.Entity[], driverGesture?: GestureKind | null, passengerGesture?: GestureKind | null) {
  const driverHand = gestures[2];
  const passengerHand = gestures[5];
  if (driverHand) driverHand.enabled = !!driverGesture;
  if (passengerHand) passengerHand.enabled = !!passengerGesture;
}

function spawnFirework(app: pc.Application, particles: { entity: pc.Entity; vel: pc.Vec3; life: number }[], synced: boolean, driverColor: number, passengerColor: number) {
  const colors = synced ? [driverColor, passengerColor, 0xffffff, 0xffd166] : [0xffffff, 0xd6d6d6];
  const count = synced ? 58 : 20;
  for (let i = 0; i < count; i++) {
    const angle = (Math.PI * 2 * i) / count;
    const radius = synced ? 2.4 : 1.2;
    const speed = 1.0 + ((i * 7) % 9) * 0.09;
    const entity = sphere(app, `spark-${Date.now()}-${i}`, [0, 1.7, -15], [0.07, 0.07, 0.07], mat(colors[i % colors.length], 1.0));
    particles.push({
      entity,
      vel: new pc.Vec3(Math.cos(angle) * radius * speed, Math.sin(angle) * radius * speed + 0.8, -0.4),
      life: synced ? 1.45 : 0.9,
    });
  }
}

function box(app: pc.Application, name: string, pos: [number, number, number], scale: [number, number, number], material: pc.Material, parent?: pc.Entity) {
  const e = primitive(name, 'box', pos, scale, material);
  (parent ?? app.root).addChild(e);
  return e;
}

function sphere(app: pc.Application, name: string, pos: [number, number, number], scale: [number, number, number], material: pc.Material, parent?: pc.Entity) {
  const e = primitive(name, 'sphere', pos, scale, material);
  (parent ?? app.root).addChild(e);
  return e;
}

function cone(app: pc.Application, name: string, pos: [number, number, number], scale: [number, number, number], material: pc.Material, sides = 8, parent?: pc.Entity) {
  const e = primitive(name, 'cone', pos, scale, material, { segments: sides });
  (parent ?? app.root).addChild(e);
  return e;
}

function cylinder(app: pc.Application, name: string, pos: [number, number, number], scale: [number, number, number], material: pc.Material, parent?: pc.Entity) {
  const e = primitive(name, 'cylinder', pos, scale, material);
  (parent ?? app.root).addChild(e);
  return e;
}

function primitive(name: string, type: 'box' | 'sphere' | 'cone' | 'cylinder', pos: [number, number, number], scale: [number, number, number], material: pc.Material, extra?: Record<string, unknown>) {
  const e = new pc.Entity(name);
  e.addComponent('render', { type, material, ...(extra ?? {}) });
  e.setLocalPosition(pos[0], pos[1], pos[2]);
  e.setLocalScale(scale[0], scale[1], scale[2]);
  return e;
}

function mat(hex: number, emissive = 0, opacity = 1) {
  const material = new pc.StandardMaterial();
  material.diffuse = color(hex, opacity);
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

function colorToNumber(hex: string) {
  return parseInt(hex.replace('#', ''), 16);
}

function positiveMod(n: number, m: number) {
  return ((n % m) + m) % m;
}
