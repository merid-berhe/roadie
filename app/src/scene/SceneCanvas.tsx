// PixiJS 2.5D parallax scene (§7). Three scrolling layers + cabin frame + occupant glyphs.
// Scroll position is derived from the server-authoritative clock so both clients see
// the same landscape at the same moment (§9).
// M5: gesture floating symbols + firework particle burst (§8).

import { useEffect, useRef } from 'react';
import {
  Application,
  Container,
  Graphics,
  Text,
  TextStyle,
} from 'pixi.js';
import type { GestureKind } from '@roadie/shared';
import type { Palette } from './palette';

type Props = {
  palette: Palette;
  positionSec: number;
  driverGlyph: string;
  driverColor: string;
  passengerGlyph: string;
  passengerColor: string;
  // M5
  driverGestureKind?: GestureKind | null;
  passengerGestureKind?: GestureKind | null;
  firework?: { synced: boolean } | null;
};

const SPEEDS = { far: 40, mid: 80, near: 160 };

const GESTURE_SYMBOLS: Partial<Record<GestureKind, string>> = {
  wave: '👋', headlights: '✦', heart: '♥',
  tambourine: '♪', shaker: '≈', chime: '♫',
};

type Particle = { g: Graphics; vx: number; vy: number; life: number };

export default function SceneCanvas({
  palette, positionSec,
  driverGlyph, driverColor, passengerGlyph, passengerColor,
  driverGestureKind, passengerGestureKind, firework,
}: Props) {
  const mountRef = useRef<HTMLDivElement>(null);
  const posRef = useRef(positionSec);
  const driverGestureRef = useRef<GestureKind | null | undefined>(driverGestureKind);
  const passengerGestureRef = useRef<GestureKind | null | undefined>(passengerGestureKind);
  const fireworkRef = useRef<{ synced: boolean } | null | undefined>(firework);

  useEffect(() => { posRef.current = positionSec; }, [positionSec]);
  useEffect(() => { driverGestureRef.current = driverGestureKind; }, [driverGestureKind]);
  useEffect(() => { passengerGestureRef.current = passengerGestureKind; }, [passengerGestureKind]);
  useEffect(() => { fireworkRef.current = firework; }, [firework]);

  useEffect(() => {
    if (!mountRef.current) return;
    const el = mountRef.current;
    let app: Application | null = null;
    let destroyed = false;

    (async () => {
      try {
        const rect = el.getBoundingClientRect();
        const W0 = Math.round(rect.width)  || window.innerWidth;
        const H0 = Math.round(rect.height) || window.innerHeight;

        app = new Application();
        await app.init({
          width: W0, height: H0,
          background: 'transparent',
          antialias: true,
          resolution: Math.min(window.devicePixelRatio, 2),
          autoDensity: true,
        });
        if (destroyed) { app.destroy(true); return; }

        const canvas = app.canvas as HTMLCanvasElement;
        canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%';
        el.appendChild(canvas);

        const W = app.screen.width;
        const H = app.screen.height;
        console.log(`[scene] ${W}×${H}`);

        const winY = Math.round(H * 0.08);
        const winH = Math.round(H * 0.60);
        const winX = Math.round(W * 0.04);
        const winW = W - winX * 2;
        const seatY = winY + winH - Math.round(winH * 0.22);

        // Scenery layers masked to windshield
        const scenery = new Container();
        app.stage.addChild(scenery);
        const winMask = new Graphics().rect(winX, winY, winW, winH).fill(0xffffff);
        scenery.mask = winMask;
        app.stage.addChild(winMask);

        const farPair  = makeLayers(W, winH, winY, palette.far,  200);
        const midPair  = makeLayers(W, winH, winY, palette.mid,  120);
        const nearPair = makeLayers(W, winH, winY, palette.near,  70);
        scenery.addChild(...farPair, ...midPair, ...nearPair);

        // Cabin frame
        const frame = new Graphics();
        frame.rect(0, 0, W, winY).fill({ color: 0x0b1020 });
        frame.rect(0, winY, winX, winH).fill({ color: 0x0b1020 });
        frame.rect(winX + winW, winY, W - winX - winW, winH).fill({ color: 0x0b1020 });
        frame.rect(0, winY + winH, W, H - winY - winH).fill({ color: 0x0b1020 });
        frame.rect(winX, winY, winW, 3).fill({ color: 0x1a2030 });
        frame.rect(winX, winY + winH - 3, winW, 3).fill({ color: 0x1a2030 });
        app.stage.addChild(frame);

        // Occupant glyphs
        addOccupant(app, W * 0.28, seatY, driverGlyph, driverColor);
        addOccupant(app, W * 0.72, seatY, passengerGlyph, passengerColor);

        // Gesture display texts (M5)
        const driverGestureText    = makeGestureText(driverColor);
        const passengerGestureText = makeGestureText(passengerColor);
        driverGestureText.x    = W * 0.28; driverGestureText.y    = seatY - 60;
        passengerGestureText.x = W * 0.72; passengerGestureText.y = seatY - 60;
        app.stage.addChild(driverGestureText, passengerGestureText);

        // Firework particle container (M5)
        const particles: Particle[] = [];
        const fx = new Container();
        app.stage.addChild(fx);

        // Ticker state
        let prevPos = posRef.current;
        let prevDriverGesture: GestureKind | null | undefined = null;
        let prevPassengerGesture: GestureKind | null | undefined = null;
        let prevFirework: { synced: boolean } | null | undefined = null;
        let driverGestureMs   = 0;
        let passengerGestureMs = 0;

        app.ticker.add(({ deltaMS }) => {
          // Parallax scroll
          const pos = posRef.current;
          const delta = pos - prevPos;
          prevPos = pos;
          if (delta > 0) {
            scrollLayer(farPair,  W, SPEEDS.far  * delta);
            scrollLayer(midPair,  W, SPEEDS.mid  * delta);
            scrollLayer(nearPair, W, SPEEDS.near * delta);
          }

          // Driver gesture display
          const dg = driverGestureRef.current;
          if (dg && dg !== prevDriverGesture) {
            driverGestureText.text = GESTURE_SYMBOLS[dg] ?? dg;
            driverGestureText.alpha = 1;
            driverGestureMs = 1500;
            prevDriverGesture = dg;
          }
          if (!dg) prevDriverGesture = null;
          if (driverGestureMs > 0) {
            driverGestureMs -= deltaMS;
            driverGestureText.alpha = Math.max(0, driverGestureMs / 800);
          }

          // Passenger gesture display
          const pg = passengerGestureRef.current;
          if (pg && pg !== prevPassengerGesture) {
            passengerGestureText.text = GESTURE_SYMBOLS[pg] ?? pg;
            passengerGestureText.alpha = 1;
            passengerGestureMs = 1500;
            prevPassengerGesture = pg;
          }
          if (!pg) prevPassengerGesture = null;
          if (passengerGestureMs > 0) {
            passengerGestureMs -= deltaMS;
            passengerGestureText.alpha = Math.max(0, passengerGestureMs / 800);
          }

          // Firework trigger (M5, §8c)
          const fw = fireworkRef.current;
          if (fw && fw !== prevFirework) {
            prevFirework = fw;
            const count  = fw.synced ? 60 : 20;
            const colors = fw.synced
              ? [0xF5A623, 0x1FB6C4, 0xffffff, 0xffdd66]
              : [0xffffff, 0xdddddd];
            const cx = W / 2;
            const cy = winY + winH * 0.4;
            for (let i = 0; i < count; i++) {
              const angle  = (Math.PI * 2 * i) / count + (Math.random() * 0.3);
              const speed  = fw.synced ? 3 + Math.random() * 5 : 2 + Math.random() * 2.5;
              const color  = colors[i % colors.length];
              const radius = fw.synced ? 4 : 3;
              const g = new Graphics().circle(0, 0, radius).fill(color);
              g.x = cx; g.y = cy; g.alpha = 1;
              fx.addChild(g);
              particles.push({ g, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - 2, life: 1 });
            }
          }

          // Animate particles
          for (let i = particles.length - 1; i >= 0; i--) {
            const p = particles[i];
            p.vx *= 0.97;
            p.vy += 0.18; // gravity
            p.g.x += p.vx;
            p.g.y += p.vy;
            p.life -= deltaMS / 1800;
            p.g.alpha = Math.max(0, p.life);
            if (p.life <= 0) { fx.removeChild(p.g); p.g.destroy(); particles.splice(i, 1); }
          }
        });
      } catch (err) {
        console.error('[scene] PixiJS init failed:', err);
      }
    })();

    return () => {
      destroyed = true;
      setTimeout(() => app?.destroy(true), 0);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [palette, driverGlyph, driverColor, passengerGlyph, passengerColor]);

  return <div ref={mountRef} className="absolute inset-0" />;
}

// --- helpers ---

function makeLayers(W: number, H: number, y: number, color: number, peakH: number): Graphics[] {
  const g1 = buildHorizon(W, H, color, peakH);
  const g2 = buildHorizon(W, H, color, peakH);
  g1.y = y; g2.y = y; g2.x = W;
  return [g1, g2];
}

function buildHorizon(W: number, H: number, color: number, peakH: number): Graphics {
  const g = new Graphics();
  const pts: number[] = [0, H];
  const steps = 12;
  for (let i = 0; i <= steps; i++) {
    const x = (W / steps) * i;
    const seed = Math.sin(i * 1.618 + color * 0.001) * 0.5 + 0.5;
    pts.push(x, H - (peakH * 0.5 + seed * peakH * 0.5));
  }
  pts.push(W, H);
  g.poly(pts).fill({ color });
  return g;
}

function addOccupant(app: Application, x: number, y: number, glyph: string, color: string) {
  const t = new Text({ text: glyph, style: new TextStyle({ fill: color, fontSize: 36, fontFamily: 'system-ui' }) });
  t.anchor.set(0.5, 1); t.x = x; t.y = y;
  app.stage.addChild(t);
}

function makeGestureText(color: string): Text {
  const t = new Text({ text: '', style: new TextStyle({ fill: color, fontSize: 28, fontFamily: 'system-ui' }) });
  t.anchor.set(0.5, 1); t.alpha = 0;
  return t;
}

function scrollLayer(pair: Graphics[], W: number, dx: number) {
  for (const g of pair) g.x -= dx;
  if (pair[0].x < -W) pair[0].x = pair[1].x + W;
  if (pair[1].x < -W) pair[1].x = pair[0].x + W;
}
