// Coast — ocean horizon, cliffs, warm afternoon light.
import { makePair, drandAbs } from './utils';
import type { BuiltScene } from './types';

const SKY_TOP  = 0x87ceeb;
const SKY_MID  = 0xffd580;
const OCEAN    = 0x1a6e8a;
const CLIFF    = 0x8b7355;
const GRASS    = 0x4a7c59;
const ROAD_C   = 0x3a3a3a;

export function buildCoast(W: number, H: number): BuiltScene {
  const groundY = Math.round(H * 0.70);

  const skyPair = makePair(W, (g) => {
    g.rect(0, 0, W, H * 0.5).fill({ color: SKY_TOP });
    g.rect(0, H * 0.4, W, H * 0.25).fill({ color: SKY_MID });
  });

  const farPair = makePair(W, (g) => {
    // Ocean band
    g.rect(0, groundY - 60, W, 60).fill({ color: OCEAN });
    // Distant cliffs
    for (let i = 0; i < 5; i++) {
      const x  = drandAbs(i * 7.3) * W;
      const cw = 80 + drandAbs(i * 4.1) * 120;
      const ch = 20 + drandAbs(i * 5.9) * 35;
      g.rect(x, groundY - 60 - ch, cw, ch).fill({ color: CLIFF });
      g.rect(x, groundY - 60 - ch, cw, 6).fill({ color: GRASS });
    }
  });

  const midPair = makePair(W, (g) => {
    g.rect(0, groundY, W, H - groundY).fill({ color: GRASS });
    // Cliff edge
    g.rect(0, groundY - 18, W, 18).fill({ color: CLIFF });
    // Rolling grass bumps
    for (let i = 0; i < 8; i++) {
      const x = drandAbs(i * 11) * W;
      g.ellipse(x, groundY - 8, 30 + drandAbs(i) * 40, 12).fill({ color: GRASS });
    }
  });

  const nearPair = makePair(W, (g) => {
    g.rect(0, groundY, W, H - groundY).fill({ color: 0x3a5c45 });
    // Road
    const rw = W * 0.18; const rx = W * 0.41;
    g.rect(rx, groundY - 4, rw, H).fill({ color: ROAD_C });
    for (let d = 0; d < 8; d++) {
      g.rect(rx + rw * 0.48, groundY + d * 20, rw * 0.04, 10).fill({ color: 0xffffff });
    }
    // Coastal shrubs
    for (let i = 0; i < 5; i++) {
      const x = drandAbs(i * 13 + 2) * W;
      g.ellipse(x, groundY - 4, 18 + drandAbs(i) * 16, 10).fill({ color: GRASS });
    }
  });

  return {
    layers: [
      { pair: skyPair,  speed: 0   },
      { pair: farPair,  speed: 25  },
      { pair: midPair,  speed: 65  },
      { pair: nearPair, speed: 145 },
    ],
    groundY,
    roadColor: 0x3a3a3a,
    dashColor: 0xffffff,
  };
}
