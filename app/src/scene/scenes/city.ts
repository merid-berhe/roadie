// Night city — skyline glow, streetlights, rain reflections, deep purples.
import { Graphics } from 'pixi.js';
import { makePair, drandAbs } from './utils';
import type { BuiltScene } from './types';

const SKY      = 0x0d0d1a;
const GLOW     = 0x1a0a3a;
const BUILDING = 0x1a1a2e;
const BLDG_LIT = 0x2a2a4a;
const WIN_WARM = 0xffcc66;
const WIN_COOL = 0x66aaff;
const ROAD_N   = 0x1a1a1a;
const REFLECT  = 0x2a1a4a;
const LAMP     = 0xffd966;

export function buildCity(W: number, H: number): BuiltScene {
  const groundY = Math.round(H * 0.72);

  const skyPair = makePair(W, (g) => {
    g.rect(0, 0, W, H).fill({ color: SKY });
    // City glow on horizon
    g.rect(0, groundY - 80, W, 80).fill({ color: GLOW });
    // Stars
    for (let i = 0; i < 40; i++) {
      const sx = drandAbs(i * 17.3) * W;
      const sy = drandAbs(i * 9.1) * (groundY - 100);
      g.circle(sx, sy, drandAbs(i * 3.7) < 0.5 ? 1 : 0.5).fill({ color: 0xffffff });
    }
  });

  const farPair = makePair(W, (g) => {
    // Distant skyline
    for (let i = 0; i < 14; i++) {
      const x  = (i / 14) * W;
      const bw = 18 + drandAbs(i * 5.1) * 28;
      const bh = 40 + drandAbs(i * 7.3) * 80;
      g.rect(x, groundY - bh, bw, bh).fill({ color: BUILDING });
      // Windows
      for (let wy = groundY - bh + 6; wy < groundY - 6; wy += 10) {
        for (let wx = x + 3; wx < x + bw - 3; wx += 7) {
          if (drandAbs(wx * wy) > 0.4) {
            g.rect(wx, wy, 4, 5).fill({ color: drandAbs(wx + wy) > 0.6 ? WIN_WARM : WIN_COOL });
          }
        }
      }
    }
  });

  const midPair = makePair(W, (g) => {
    // Mid buildings
    for (let i = 0; i < 8; i++) {
      const x  = drandAbs(i * 11.1) * W;
      const bw = 25 + drandAbs(i * 4.3) * 35;
      const bh = 30 + drandAbs(i * 6.7) * 50;
      g.rect(x, groundY - bh, bw, bh).fill({ color: BLDG_LIT });
    }
    g.rect(0, groundY, W, H - groundY).fill({ color: ROAD_N });
    // Wet road reflection
    g.rect(0, groundY, W, 20).fill({ color: REFLECT });
  });

  const nearPair = makePair(W, (g) => {
    g.rect(0, groundY, W, H - groundY).fill({ color: 0x111118 });
    // Road
    const rw = W * 0.18; const rx = W * 0.41;
    g.rect(rx, groundY - 4, rw, H).fill({ color: ROAD_N });
    // Reflection on wet road
    g.rect(rx + rw * 0.3, groundY, rw * 0.4, 30).fill({ color: REFLECT });
    // Lane dashes
    for (let d = 0; d < 8; d++) {
      g.rect(rx + rw * 0.48, groundY + d * 20, rw * 0.04, 10).fill({ color: 0x555555 });
    }
    // Streetlights
    for (let i = 0; i < 4; i++) {
      const lx = (i / 4) * W + drandAbs(i * 19) * 30;
      drawLamp(g, lx, groundY, LAMP);
    }
  });

  return {
    layers: [
      { pair: skyPair,  speed: 0   },
      { pair: farPair,  speed: 15  },
      { pair: midPair,  speed: 55  },
      { pair: nearPair, speed: 135 },
    ],
    groundY,
    roadColor: 0x1a1a1a,
    dashColor: 0x555577,
  };
}

function drawLamp(g: Graphics, x: number, baseY: number, color: number) {
  g.rect(x - 1.5, baseY - 60, 3, 60).fill({ color: 0x444455 }); // pole
  g.rect(x - 1.5, baseY - 62, 18, 4).fill({ color: 0x444455 }); // arm
  g.circle(x + 15, baseY - 63, 5).fill({ color });               // lamp
  // Glow halo
  g.circle(x + 15, baseY - 63, 12).fill({ color, alpha: 0.15 });
}
