import { Graphics } from 'pixi.js';
import type { LayerPair } from './types';

/** Build a double-buffer layer pair from a draw function. */
export function makePair(W: number, drawFn: (g: Graphics, W: number) => void): LayerPair {
  const g1 = new Graphics(); drawFn(g1, W);
  const g2 = new Graphics(); drawFn(g2, W);
  g2.x = W;
  return [g1, g2];
}

/** Deterministic pseudo-random based on position — no Math.random() so scenes are consistent. */
export function drand(seed: number): number {
  return (Math.sin(seed * 127.1 + 311.7) * 43758.5453) % 1;
}
export function drandAbs(seed: number): number {
  return Math.abs(drand(seed));
}
