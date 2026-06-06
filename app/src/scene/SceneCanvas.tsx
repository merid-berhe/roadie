// PixiJS scene — Florence-style flat vector. Four road themes, real cabin frame,
// SVG-style occupant silhouettes with gesture animation.

import { useEffect, useRef } from 'react';
import { Application, Container, Graphics, Text, TextStyle } from 'pixi.js';
import type { GestureKind } from '@roadie/shared';
import type { RoadId } from './scenes';
import { buildScene } from './scenes';
import { getCabinLayout, drawCabin, drawOccupant } from './cabin';
import type { LayerPair } from './scenes/types';

type Props = {
  road: RoadId;
  positionSec: number;
  driverGlyph: string;
  driverColor: string;
  passengerGlyph: string;
  passengerColor: string;
  driverGestureKind?: GestureKind | null;
  passengerGestureKind?: GestureKind | null;
  firework?: { synced: boolean } | null;
};

type Particle = { g: Graphics; vx: number; vy: number; life: number };

const GESTURE_SYMBOLS: Partial<Record<GestureKind, string>> = {
  wave: '👋', headlights: '✦', heart: '♥',
  tambourine: '♪', shaker: '≈', chime: '♫',
};

export default function SceneCanvas({
  road, positionSec,
  driverColor, passengerColor,
  driverGestureKind, passengerGestureKind, firework,
}: Props) {
  const mountRef = useRef<HTMLDivElement>(null);
  const posRef   = useRef(positionSec);
  const drGRef   = useRef(driverGestureKind);
  const pgGRef   = useRef(passengerGestureKind);
  const fwRef    = useRef(firework);

  useEffect(() => { posRef.current = positionSec; }, [positionSec]);
  useEffect(() => { drGRef.current = driverGestureKind; }, [driverGestureKind]);
  useEffect(() => { pgGRef.current = passengerGestureKind; }, [passengerGestureKind]);
  useEffect(() => { fwRef.current = firework; }, [firework]);

  useEffect(() => {
    if (!mountRef.current) return;
    const el = mountRef.current;
    let app: Application | null = null;
    let destroyed = false;

    (async () => {
      try {
        const rect = el.getBoundingClientRect();
        const W = Math.round(rect.width)  || window.innerWidth;
        const H = Math.round(rect.height) || window.innerHeight;
        const layout = getCabinLayout(W, H);

        app = new Application();
        await app.init({
          width: W, height: H,
          background: 0x0d0f18,
          antialias: true,
          resolution: Math.min(window.devicePixelRatio, 2),
          autoDensity: true,
        });
        if (destroyed) { app.destroy(true); return; }

        const canvas = app.canvas as HTMLCanvasElement;
        canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%';
        el.appendChild(canvas);
        console.log(`[scene] ${W}×${H} road=${road}`);

        // ── Build scene layers ──────────────────────────────────────
        const scene = buildScene(road, W, H);

        // Scenery container, masked to windshield
        const scenery = new Container();
        app.stage.addChild(scenery);
        const mask = new Graphics()
          .rect(layout.winX, layout.winY, layout.winW, layout.winH)
          .fill(0xffffff);
        scenery.mask = mask;
        app.stage.addChild(mask);

        for (const layer of scene.layers) {
          scenery.addChild(layer.pair[0], layer.pair[1]);
        }

        // ── Cabin frame ──────────────────────────────────────────────
        const cabin = drawCabin(W, H, layout);
        app.stage.addChild(cabin);

        // ── Occupants ────────────────────────────────────────────────
        const occupantContainer = new Container();
        app.stage.addChild(occupantContainer);

        const driverColor6   = parseInt(driverColor.replace('#', ''),   16);
        const passengerColor6 = parseInt(passengerColor.replace('#', ''), 16);

        // Occupants are re-drawn each frame via refs (gesture-driven)
        // We keep one Graphics per occupant and redraw when gesture changes
        let driverG   = drawOccupant(occupantContainer, layout.driverX,    layout.seatY, driverColor6,    drGRef.current);
        let passengerG = drawOccupant(occupantContainer, layout.passengerX, layout.seatY, passengerColor6, pgGRef.current);

        // Gesture floating text
        const makeGestureText = (color: string) => {
          const t = new Text({ text: '', style: new TextStyle({ fill: color, fontSize: 26, fontFamily: 'system-ui' }) });
          t.anchor.set(0.5, 1); t.alpha = 0;
          app!.stage.addChild(t);
          return t;
        };
        const drText = makeGestureText(driverColor);
        drText.x = layout.driverX; drText.y = layout.seatY - 70;
        const pgText = makeGestureText(passengerColor);
        pgText.x = layout.passengerX; pgText.y = layout.seatY - 70;

        // Firework particles
        const particles: Particle[] = [];
        const fx = new Container();
        app.stage.addChild(fx);

        // ── Ticker ───────────────────────────────────────────────────
        let prevPos = posRef.current;
        let prevDrG: typeof drGRef.current = null;
        let prevPgG: typeof pgGRef.current = null;
        let prevFw:  typeof fwRef.current  = null;
        let drGestureMs = 0; let pgGestureMs = 0;
        let prevDrGKind: string | null | undefined = null;
        let prevPgGKind: string | null | undefined = null;

        app.ticker.add(({ deltaMS }) => {
          // Parallax scroll
          const pos   = posRef.current;
          const delta = pos - prevPos; prevPos = pos;
          if (delta > 0) {
            for (const layer of scene.layers) scrollLayer(layer.pair, W, layer.speed * delta);
          }

          // Occupant redraw on gesture change
          const dg = drGRef.current;
          const pg = pgGRef.current;
          if (dg !== prevDrG) {
            occupantContainer.removeChild(driverG); driverG.destroy();
            driverG = drawOccupant(occupantContainer, layout.driverX, layout.seatY, driverColor6, dg);
            prevDrG = dg;
          }
          if (pg !== prevPgG) {
            occupantContainer.removeChild(passengerG); passengerG.destroy();
            passengerG = drawOccupant(occupantContainer, layout.passengerX, layout.seatY, passengerColor6, pg);
            prevPgG = pg;
          }

          // Gesture text
          if (dg && dg !== prevDrGKind) { drText.text = GESTURE_SYMBOLS[dg] ?? dg; drText.alpha = 1; drGestureMs = 1500; prevDrGKind = dg; }
          if (!dg) prevDrGKind = null;
          if (drGestureMs > 0) { drGestureMs -= deltaMS; drText.alpha = Math.max(0, drGestureMs / 800); }

          if (pg && pg !== prevPgGKind) { pgText.text = GESTURE_SYMBOLS[pg] ?? pg; pgText.alpha = 1; pgGestureMs = 1500; prevPgGKind = pg; }
          if (!pg) prevPgGKind = null;
          if (pgGestureMs > 0) { pgGestureMs -= deltaMS; pgText.alpha = Math.max(0, pgGestureMs / 800); }

          // Fireworks
          const fw = fwRef.current;
          if (fw && fw !== prevFw) {
            prevFw = fw;
            const count  = fw.synced ? 70 : 22;
            const colors = fw.synced
              ? [0xF5A623, 0x1FB6C4, 0xffffff, 0xffdd66, 0xff88aa]
              : [0xffffff, 0xdddddd];
            const cx = W / 2; const cy = layout.winY + layout.winH * 0.4;
            for (let i = 0; i < count; i++) {
              const angle = (Math.PI * 2 * i) / count + (Math.abs(Math.sin(i * 3.7)) * 0.4);
              const speed = fw.synced ? 3 + Math.abs(Math.sin(i * 7.1)) * 5 : 2 + Math.abs(Math.sin(i * 5)) * 2.5;
              const g = new Graphics().circle(0, 0, fw.synced ? 4 : 3).fill(colors[i % colors.length]);
              g.x = cx; g.y = cy; g.alpha = 1;
              fx.addChild(g);
              particles.push({ g, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - 2.5, life: 1 });
            }
          }
          for (let i = particles.length - 1; i >= 0; i--) {
            const p = particles[i];
            p.vx *= 0.97; p.vy += 0.18;
            p.g.x += p.vx; p.g.y += p.vy;
            p.life -= deltaMS / 1800;
            p.g.alpha = Math.max(0, p.life);
            if (p.life <= 0) { fx.removeChild(p.g); p.g.destroy(); particles.splice(i, 1); }
          }
        });
      } catch (err) {
        console.error('[scene] PixiJS init failed:', err);
      }
    })();

    return () => { destroyed = true; setTimeout(() => app?.destroy(true), 0); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [road, driverColor, passengerColor]);

  return <div ref={mountRef} className="absolute inset-0" />;
}

function scrollLayer(pair: LayerPair, W: number, dx: number) {
  for (const g of pair) g.x -= dx;
  if (pair[0].x < -W) pair[0].x = pair[1].x + W;
  if (pair[1].x < -W) pair[1].x = pair[0].x + W;
}
