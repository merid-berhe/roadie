// Desert / Route 66 — summer, bold oranges, long straight road, saguaro cacti.
// Florence-style: flat vector shapes, strong silhouettes, minimal texture.

import { Graphics } from 'pixi.js';
import { makePair, drandAbs } from './utils';
import type { BuiltScene } from './types';

const SKY    = 0xf4845f; // warm coral/orange horizon
const SUN    = 0xffd166; // sun glow
const FAR    = 0xc17f59; // distant mesa, terracotta
const MID    = 0x8b5e3c; // mid-ground scrub & rock
const NEAR   = 0x6b4226; // near ground, dark earth
const ROAD   = 0x3a3330; // road stripe
const GROUND = 0x9c6b3c; // flat desert floor

export function buildDesert(W: number, H: number): BuiltScene {
  const groundY = Math.round(H * 0.72);

  // Sky gradient band (drawn as two rects — top sky, bottom horizon glow)
  const skyPair = makePair(W, (g) => {
    g.rect(0, 0, W, H * 0.55).fill({ color: 0x1a1040 }); // deep sky top (pre-dawn/dusk)
    g.rect(0, H * 0.40, W, H * 0.30).fill({ color: SKY }); // warm horizon band
    g.rect(0, H * 0.60, W, H * 0.15).fill({ color: SUN }); // sun glow on horizon
  });

  // Far: flat-topped mesas, minimal detail
  const farPair = makePair(W, (g) => {
    g.rect(0, groundY, W, H - groundY).fill({ color: GROUND });
    for (let i = 0; i < 6; i++) {
      const x  = drandAbs(i * 7.1) * W;
      const mw = 60 + drandAbs(i * 3.3) * 120;
      const mh = 30 + drandAbs(i * 5.7) * 60;
      const my = groundY - mh;
      // Mesa: flat top with sloped sides (trapezoid)
      g.poly([x, groundY, x + mw * 0.15, my, x + mw * 0.85, my, x + mw, groundY]).fill({ color: FAR });
    }
  });

  // Mid: low scrub rocks and one distant saguaro per section
  const midPair = makePair(W, (g) => {
    // Ground plane
    g.rect(0, groundY - 10, W, H - groundY + 10).fill({ color: MID });
    // Rocks
    for (let i = 0; i < 10; i++) {
      const x = drandAbs(i * 11.3) * W;
      const rw = 12 + drandAbs(i * 4.1) * 28;
      const rh = 8 + drandAbs(i * 2.9) * 16;
      g.ellipse(x, groundY - rh * 0.3, rw, rh).fill({ color: FAR });
    }
    // Distant saguaro silhouettes
    for (let i = 0; i < 3; i++) {
      const x  = (i / 3) * W + drandAbs(i * 9) * 60;
      const ch = 40 + drandAbs(i * 6.3) * 30;
      drawSaguaro(g, x, groundY, ch, 0.7, MID);
    }
  });

  // Near: ground strip + road + closer cacti + road markings
  const nearPair = makePair(W, (g) => {
    g.rect(0, groundY, W, H - groundY).fill({ color: NEAR });
    // Road (narrow strip in the windshield center)
    const rw = W * 0.18;
    const rx = W * 0.41;
    g.rect(rx, groundY - 4, rw, H - groundY + 4).fill({ color: ROAD });
    // Road centre dashes
    for (let d = 0; d < 8; d++) {
      const dy = groundY + d * 20;
      g.rect(rx + rw * 0.48, dy, rw * 0.04, 10).fill({ color: 0xf4d03f });
    }
    // Near saguaros — taller, darker
    for (let i = 0; i < 4; i++) {
      const x  = drandAbs(i * 13.7 + 1) * W;
      const ch = 55 + drandAbs(i * 8.1) * 45;
      drawSaguaro(g, x, groundY, ch, 1, NEAR);
    }
    // Pebbles / scrub dots
    for (let i = 0; i < 20; i++) {
      const px = drandAbs(i * 17.3) * W;
      const pr = 2 + drandAbs(i * 5.1) * 4;
      g.circle(px, groundY + 4 + drandAbs(i * 3.7) * 12, pr).fill({ color: MID });
    }
  });

  return {
    layers: [
      { pair: skyPair,  speed: 0  },
      { pair: farPair,  speed: 30 },
      { pair: midPair,  speed: 70 },
      { pair: nearPair, speed: 150 },
    ],
    groundY,
    roadColor: 0x3a3330,
    dashColor: 0xf4d03f,
  };
}

function drawSaguaro(g: Graphics, x: number, baseY: number, h: number, s: number, color: number) {
  const tw = 7 * s; // trunk width
  // Trunk
  g.rect(x - tw / 2, baseY - h, tw, h).fill({ color });
  // Left arm
  const ah = h * 0.45;
  const aw = 5 * s;
  g.rect(x - tw / 2 - aw * 3, baseY - h + ah, aw, ah * 0.7).fill({ color });
  g.rect(x - tw / 2 - aw * 3, baseY - h + ah - aw, aw * 3.5, aw).fill({ color });
  // Right arm
  g.rect(x + tw / 2, baseY - h + ah * 1.2, aw, ah * 0.6).fill({ color });
  g.rect(x + tw / 2, baseY - h + ah * 1.2 - aw, aw * 3, aw).fill({ color });
}
