import type { Graphics } from 'pixi.js';

// A scrollable layer pair (double-buffer) for seamless horizontal looping
export type LayerPair = [Graphics, Graphics];

export type SceneLayer = {
  pair: LayerPair;
  speed: number; // px per second of ride time
};

export type BuiltScene = {
  layers: SceneLayer[];      // back-to-front order
  groundY: number;           // y where the ground meets the road (for occupant placement)
};
