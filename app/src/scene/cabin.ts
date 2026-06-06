// Florence-style flat vector cabin frame — back-seat POV looking forward.
// Designed to be replaced by a commissioned illustration; geometry matches
// the same windshield cutout so real art drops in without layout changes.

import { Graphics, Container } from 'pixi.js';

export type CabinLayout = {
  winX: number; winY: number; winW: number; winH: number;
  seatY: number;
  driverX: number; passengerX: number;
};

/** Returns the windshield bounds and occupant anchor points. */
export function getCabinLayout(W: number, H: number): CabinLayout {
  const winX = Math.round(W * 0.05);
  const winY = Math.round(H * 0.06);
  const winW = W - winX * 2;
  const winH = Math.round(H * 0.58);
  const seatY = winY + winH + Math.round(H * 0.04); // just below windshield bottom
  return {
    winX, winY, winW, winH,
    seatY,
    driverX:    Math.round(W * 0.30),
    passengerX: Math.round(W * 0.70),
  };
}

/** Draw the cabin frame overlay on top of the scenery. */
export function drawCabin(W: number, H: number, layout: CabinLayout): Graphics {
  const { winX, winY, winW, winH } = layout;
  const g = new Graphics();

  const DARK  = 0x0d0f18;  // deep cabin interior
  const TRIM  = 0x1a1e2e;  // door panels / dashboard
  const GLASS = 0x1e2a3a;  // window frame tint
  const DASH  = 0x131620;  // dashboard face

  // ── Roof / headliner ──────────────────────────────────────────────
  g.rect(0, 0, W, winY).fill({ color: DARK });
  // Subtle headliner curve
  g.poly([0, winY, W, winY, W, winY - 4, W * 0.5, winY - 10, 0, winY - 4]).fill({ color: TRIM });

  // ── A-pillars ─────────────────────────────────────────────────────
  const pillarW = winX;
  // Left A-pillar (tapers slightly toward top)
  g.poly([0, winY, pillarW, winY, pillarW + 6, winY + winH, 0, winY + winH]).fill({ color: DARK });
  // Right A-pillar
  g.poly([W - pillarW, winY, W, winY, W, winY + winH, W - pillarW - 6, winY + winH]).fill({ color: DARK });

  // ── Windshield rim (thin border around the glass area) ────────────
  g.rect(winX, winY, winW, 3).fill({ color: GLASS });
  g.rect(winX, winY + winH - 3, winW, 3).fill({ color: GLASS });

  // ── Dashboard ─────────────────────────────────────────────────────
  const dashTop = winY + winH;
  const dashH   = H - dashTop;
  g.rect(0, dashTop, W, dashH).fill({ color: TRIM });

  // Dashboard face panel
  g.poly([0, dashTop, W, dashTop, W * 0.88, dashTop + dashH * 0.55, W * 0.12, dashTop + dashH * 0.55]).fill({ color: DASH });

  // Steering wheel (driver side, lower dashboard)
  drawSteeringWheel(g, W * 0.28, dashTop + dashH * 0.62, 18, TRIM);

  // Centre console / radio area
  const cx = W * 0.5;
  const cy = dashTop + dashH * 0.35;
  g.roundRect(cx - 22, cy - 10, 44, 26, 4).fill({ color: 0x0a0c14 });
  // Two small indicator dots
  g.circle(cx - 8, cy + 3, 3).fill({ color: 0x3a8ecc });
  g.circle(cx + 8, cy + 3, 3).fill({ color: 0xcc3a3a });

  // Rear-view mirror (hanging from roof centre)
  g.roundRect(W * 0.47, winY + 4, W * 0.06, 10, 2).fill({ color: GLASS });
  // Mirror mount
  g.rect(W * 0.499, winY, 2, 6).fill({ color: TRIM });

  // Seat-back tops (two front seats visible as dark headrests)
  const seatBackY = dashTop - 6;
  const seatW = W * 0.22;
  // Driver headrest
  g.roundRect(W * 0.16, seatBackY - 28, seatW, 30, 6).fill({ color: 0x181c28 });
  // Passenger headrest
  g.roundRect(W * 0.62, seatBackY - 28, seatW, 30, 6).fill({ color: 0x181c28 });

  // Door panels (left + right strips)
  g.rect(0, dashTop, 28, dashH).fill({ color: DARK });
  g.rect(W - 28, dashTop, 28, dashH).fill({ color: DARK });

  return g;
}

function drawSteeringWheel(g: Graphics, cx: number, cy: number, r: number, color: number) {
  // Outer ring
  for (let a = 0; a < Math.PI * 2; a += 0.12) {
    g.rect(
      cx + Math.cos(a) * r - 2,
      cy + Math.sin(a) * r - 2,
      4, 4
    ).fill({ color });
  }
  // Spokes
  g.rect(cx - 1, cy - r, 2, r * 1.8).fill({ color });
  g.rect(cx - r, cy - 1, r * 1.2, 2).fill({ color });
  g.rect(cx, cy - 1, r, 2).fill({ color });
  // Hub
  g.circle(cx, cy, 4).fill({ color });
}

/** Draw SVG-style head+shoulder silhouette for one occupant. */
export function drawOccupant(
  container: Container,
  x: number,
  y: number,
  color: number,
  gestureKind?: string | null,
): Graphics {
  const g = new Graphics();

  const HEAD_R = 14;
  const NECK_H = 8;
  const SHLDR_W = 38;
  const SHLDR_H = 22;

  // Shoulder / upper body
  g.roundRect(x - SHLDR_W / 2, y - SHLDR_H, SHLDR_W, SHLDR_H, 6).fill({ color });

  // Neck
  g.rect(x - 5, y - SHLDR_H - NECK_H, 10, NECK_H).fill({ color });

  // Head
  g.circle(x, y - SHLDR_H - NECK_H - HEAD_R, HEAD_R).fill({ color });

  // Gesture: raise arm for wave, lean for heart
  if (gestureKind === 'wave') {
    // Raised arm (upper-right of silhouette)
    g.poly([
      x + SHLDR_W / 2 - 4, y - SHLDR_H + 4,
      x + SHLDR_W / 2 + 12, y - SHLDR_H - 20,
      x + SHLDR_W / 2 + 18, y - SHLDR_H - 15,
      x + SHLDR_W / 2 + 2, y - SHLDR_H + 9,
    ]).fill({ color });
    // Hand
    g.circle(x + SHLDR_W / 2 + 15, y - SHLDR_H - 22, 5).fill({ color });
  } else if (gestureKind === 'heart') {
    // Slight head tilt (lean toward centre)
    g.circle(x + 4, y - SHLDR_H - NECK_H - HEAD_R - 6, 5).fill({ color });
  }

  container.addChild(g);
  return g;
}
