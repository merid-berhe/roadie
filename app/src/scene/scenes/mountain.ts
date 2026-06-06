// Mountain pass — switchbacks, pine silhouettes, snow peaks, cool blues.
import { Graphics } from 'pixi.js';
import { makePair, drandAbs } from './utils';
import type { BuiltScene } from './types';

const SKY_TOP  = 0x1a2a4a;
const SKY_MID  = 0x4a6fa5;
const SNOW     = 0xe8edf2;
const PEAK     = 0x6b7c8a;
const PINE_FAR = 0x2a4a3a;
const PINE_MID = 0x1a3a2a;
const GROUND   = 0x3a5040;
const ROAD_M   = 0x2a2a2a;

export function buildMountain(W: number, H: number): BuiltScene {
  const groundY = Math.round(H * 0.68);

  const skyPair = makePair(W, (g) => {
    g.rect(0, 0, W, H * 0.55).fill({ color: SKY_TOP });
    g.rect(0, H * 0.35, W, H * 0.3).fill({ color: SKY_MID });
  });

  const farPair = makePair(W, (g) => {
    // Snow-capped peaks
    for (let i = 0; i < 5; i++) {
      const x = drandAbs(i * 8.1) * W;
      const ph = 80 + drandAbs(i * 4.3) * 80;
      const pw = 60 + drandAbs(i * 6.1) * 80;
      g.poly([x - pw / 2, groundY - 20, x, groundY - 20 - ph, x + pw / 2, groundY - 20]).fill({ color: PEAK });
      // Snow cap (top 30%)
      const sc = ph * 0.3;
      g.poly([x - pw * 0.15, groundY - 20 - ph + sc, x, groundY - 20 - ph, x + pw * 0.15, groundY - 20 - ph + sc]).fill({ color: SNOW });
    }
  });

  const midPair = makePair(W, (g) => {
    g.rect(0, groundY, W, H - groundY).fill({ color: GROUND });
    // Pine treeline
    for (let i = 0; i < 12; i++) {
      const x = (i / 12) * W + drandAbs(i * 9.3) * 20;
      const th = 25 + drandAbs(i * 5.7) * 25;
      drawPine(g, x, groundY, th, PINE_FAR);
    }
  });

  const nearPair = makePair(W, (g) => {
    g.rect(0, groundY, W, H - groundY).fill({ color: 0x2a3a30 });
    // Road
    const rw = W * 0.18; const rx = W * 0.41;
    g.rect(rx, groundY - 4, rw, H).fill({ color: ROAD_M });
    for (let d = 0; d < 8; d++) {
      g.rect(rx + rw * 0.48, groundY + d * 20, rw * 0.04, 10).fill({ color: 0xffffff });
    }
    // Near pine trees — taller
    for (let i = 0; i < 5; i++) {
      const x  = drandAbs(i * 14 + 3) * W;
      const th = 50 + drandAbs(i * 7.1) * 40;
      drawPine(g, x, groundY, th, PINE_MID);
    }
  });

  return {
    layers: [
      { pair: skyPair,  speed: 0   },
      { pair: farPair,  speed: 20  },
      { pair: midPair,  speed: 60  },
      { pair: nearPair, speed: 140 },
    ],
    groundY,
    roadColor: 0x2a2a2a,
    dashColor: 0xffffff,
  };
}

function drawPine(g: Graphics, x: number, baseY: number, h: number, color: number) {
  // Three stacked triangles = pine silhouette
  for (let t = 0; t < 3; t++) {
    const ty  = baseY - h * (0.4 + t * 0.2);
    const tw  = h * (0.5 - t * 0.12);
    const th2 = h * 0.32;
    g.poly([x - tw, ty + th2, x, ty, x + tw, ty + th2]).fill({ color });
  }
  // Trunk
  g.rect(x - 2, baseY - h * 0.25, 4, h * 0.25).fill({ color: 0x5c3d1e });
}
