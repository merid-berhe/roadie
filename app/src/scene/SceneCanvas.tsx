// PixiJS 2.5D parallax scene (§7). Three scrolling layers + cabin frame + occupant glyphs.
// Scroll position is derived from the server-authoritative clock so both clients see
// the same landscape at the same moment (§9).

import { useEffect, useRef } from 'react';
import {
  Application,
  Container,
  Graphics,
  Text,
  TextStyle,
} from 'pixi.js';
import type { Palette } from './palette';

type Props = {
  palette: Palette;
  positionSec: number;       // clock-synced ride position from parent
  driverGlyph: string;
  driverColor: string;
  passengerGlyph: string;
  passengerColor: string;
};

// Scroll speeds (px per second of ride time) for each depth layer
const SPEEDS = { far: 40, mid: 80, near: 160 };

export default function SceneCanvas({ palette, positionSec, driverGlyph, driverColor, passengerGlyph, passengerColor }: Props) {
  const mountRef = useRef<HTMLDivElement>(null);
  const posRef = useRef(positionSec);

  // Keep posRef in sync each render without re-running the heavy PixiJS effect
  useEffect(() => { posRef.current = positionSec; }, [positionSec]);

  useEffect(() => {
    if (!mountRef.current) return;
    const el = mountRef.current;
    let app: Application | null = null;
    let destroyed = false;

    (async () => {
      try {
        // Use explicit dims — resizeTo can get 0 if layout hasn't settled yet
        const rect = el.getBoundingClientRect();
        const W0 = Math.round(rect.width)  || window.innerWidth;
        const H0 = Math.round(rect.height) || window.innerHeight;

        app = new Application();
        await app.init({
          width: W0,
          height: H0,
          background: 'transparent',
          antialias: true,
          resolution: Math.min(window.devicePixelRatio, 2),
          autoDensity: true,
        });
        if (destroyed) { app.destroy(true); return; }

        const canvas = app.canvas as HTMLCanvasElement;
        canvas.style.position = 'absolute';
        canvas.style.inset = '0';
        canvas.style.width = '100%';
        canvas.style.height = '100%';
        el.appendChild(canvas);

        const W = app.screen.width;
        const H = app.screen.height;
        console.log(`[scene] PixiJS ${W}×${H}`);

      // Windshield area: upper 68% of the canvas
      const winY = Math.round(H * 0.08);
      const winH = Math.round(H * 0.60);
      const winX = Math.round(W * 0.04);
      const winW = W - winX * 2;

      // --- Scenery layers (double-buffer horizontal wrap) ---
      const scenery = new Container();
      app.stage.addChild(scenery);

      // Mask scenery to the windshield cutout
      const winMask = new Graphics().rect(winX, winY, winW, winH).fill(0xffffff);
      scenery.mask = winMask;
      app.stage.addChild(winMask);

      const farPair  = makeLayers(W, winH, winY, palette.far,  200);
      const midPair  = makeLayers(W, winH, winY, palette.mid,  120);
      const nearPair = makeLayers(W, winH, winY, palette.near,  70);
      scenery.addChild(...farPair, ...midPair, ...nearPair);

      // --- Cabin frame (dark overlay with windshield cut out) ---
      const frame = new Graphics();
      // Roof
      frame.rect(0, 0, W, winY).fill({ color: 0x0b1020 });
      // Left pillar
      frame.rect(0, winY, winX, winH).fill({ color: 0x0b1020 });
      // Right pillar
      frame.rect(winX + winW, winY, W - winX - winW, winH).fill({ color: 0x0b1020 });
      // Dashboard / bottom
      frame.rect(0, winY + winH, W, H - winY - winH).fill({ color: 0x0b1020 });
      // Windshield rim (thin dark border)
      frame.rect(winX, winY, winW, 3).fill({ color: 0x1a2030 });
      frame.rect(winX, winY + winH - 3, winW, 3).fill({ color: 0x1a2030 });
      app.stage.addChild(frame);

      // --- Occupant silhouettes (front-seat head/shoulder shapes, §7 layer 6) ---
      const seatY = winY + winH - Math.round(winH * 0.25);
      addOccupant(app, W * 0.28, seatY, driverGlyph, driverColor);
      addOccupant(app, W * 0.72, seatY, passengerGlyph, passengerColor);

      // --- Ticker: advance scroll each frame ---
      let prevPos = posRef.current;
        app.ticker.add(() => {
          const pos = posRef.current;
          const delta = pos - prevPos;
          prevPos = pos;
          if (delta <= 0) return;

          scrollLayer(farPair,  W, SPEEDS.far  * delta);
          scrollLayer(midPair,  W, SPEEDS.mid  * delta);
          scrollLayer(nearPair, W, SPEEDS.near * delta);
        });
      } catch (err) {
        console.error('[scene] PixiJS init failed:', err);
      }
    })();

    return () => {
      destroyed = true;
      // Defer to let the async init path also check destroyed and bail
      setTimeout(() => app?.destroy(true), 0);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [palette, driverGlyph, driverColor, passengerGlyph, passengerColor]);

  return <div ref={mountRef} className="absolute inset-0" />;
}

// --- helpers ---

/** Two copies of a procedural layer for seamless wrapping. */
function makeLayers(W: number, H: number, y: number, color: number, peakH: number): Graphics[] {
  const g1 = buildHorizonGraphic(W, H, color, peakH);
  const g2 = buildHorizonGraphic(W, H, color, peakH);
  g1.y = y; g2.y = y; g2.x = W;
  return [g1, g2];
}

/** Procedural mountain/hill silhouette filling the bottom portion of the layer. */
function buildHorizonGraphic(W: number, H: number, color: number, peakH: number): Graphics {
  const g = new Graphics();
  const points: number[] = [0, H];
  const steps = 12;
  for (let i = 0; i <= steps; i++) {
    const x = (W / steps) * i;
    // Use deterministic pseudo-random peaks (no Math.random — breaks resume, §workflow rules)
    const seed = Math.sin(i * 1.618 + color * 0.001) * 0.5 + 0.5;
    const h = peakH * 0.5 + seed * peakH * 0.5;
    points.push(x, H - h);
  }
  points.push(W, H);
  g.poly(points).fill({ color });
  return g;
}

function addOccupant(app: Application, x: number, y: number, glyph: string, color: string) {
  const style = new TextStyle({ fill: color, fontSize: 36, fontFamily: 'system-ui, sans-serif' });
  const t = new Text({ text: glyph, style });
  t.anchor.set(0.5, 1);
  t.x = x; t.y = y;
  app.stage.addChild(t);
}

/** Advance both layer copies and wrap when the first goes off screen. */
function scrollLayer(pair: Graphics[], W: number, dx: number) {
  for (const g of pair) g.x -= dx;
  // Wrap: if first copy is fully off-screen to the left, jump it behind the second
  if (pair[0].x < -W) { pair[0].x = pair[1].x + W; }
  if (pair[1].x < -W) { pair[1].x = pair[0].x + W; }
}
