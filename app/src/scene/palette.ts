// §7: mood → visual palette mapping. The atmosphere the two riders made together.

export type Palette = {
  skyTop: string;
  skyBottom: string;
  far: number;   // PixiJS hex color for distant layer
  mid: number;
  near: number;
  tint: number;  // overall ColorMatrix tint (0xRRGGBB or 0xffffff for none)
};

const palettes: Record<string, Palette> = {
  'golden-hour': { skyTop: '#c85a1a', skyBottom: '#0d0820', far: 0x6b2a10, mid: 0x7a3515, near: 0x3a2010, tint: 0xffaa66 },
  'rainy':        { skyTop: '#3a4050', skyBottom: '#151820', far: 0x2a3040, mid: 0x354050, near: 0x252e30, tint: 0x99aabb },
  'restless':     { skyTop: '#0a2040', skyBottom: '#060e20', far: 0x0d2035, mid: 0x102840, near: 0x081520, tint: 0x8899bb },
  'dreaming':     { skyTop: '#1a0a40', skyBottom: '#080515', far: 0x1a1050, mid: 0x251560, near: 0x100a28, tint: 0xaa88dd },
  'midnight':     { skyTop: '#020510', skyBottom: '#000205', far: 0x060a20, mid: 0x080e30, near: 0x040810, tint: 0x5566bb },
  'wide-open':    { skyTop: '#084878', skyBottom: '#031020', far: 0x083858, mid: 0x0a4858, near: 0x062838, tint: 0x66aacc },
};

const defaultPalette: Palette = { skyTop: '#0f1a30', skyBottom: '#060c18', far: 0x111e30, mid: 0x182430, near: 0x0e1820, tint: 0xffffff };

/** Return a palette blended from both mood seeds — the visual is a co-creation too (§7). */
export function getPalette(seedDriver?: string, seedPassenger?: string): Palette {
  const p1 = palettes[seedDriver ?? ''] ?? defaultPalette;
  const p2 = palettes[seedPassenger ?? ''] ?? p1;
  if (p1 === p2) return p1;
  // Simple blend: average the hex channels for the hex-int colors
  return {
    skyTop: p1.skyTop,       // use driver's sky (more dominant)
    skyBottom: p2.skyBottom, // use passenger's base (subtle influence)
    far:  blendHex(p1.far, p2.far),
    mid:  blendHex(p1.mid, p2.mid),
    near: blendHex(p1.near, p2.near),
    tint: blendHex(p1.tint, p2.tint),
  };
}

function blendHex(a: number, b: number): number {
  const r = (((a >> 16) & 0xff) + ((b >> 16) & 0xff)) >> 1;
  const g = (((a >> 8)  & 0xff) + ((b >> 8)  & 0xff)) >> 1;
  const bl = ((a & 0xff) + (b & 0xff)) >> 1;
  return (r << 16) | (g << 8) | bl;
}
