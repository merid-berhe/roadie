import { buildDesert } from './desert';
import { buildCoast }  from './coast';
import { buildMountain } from './mountain';
import { buildCity }   from './city';
import type { BuiltScene } from './types';

export type RoadId = 'desert' | 'coast' | 'mountain' | 'city';

export const ROADS: { id: RoadId; label: string; emoji: string }[] = [
  { id: 'desert',   label: 'Route 66',     emoji: '🌵' },
  { id: 'coast',    label: 'Coastal',      emoji: '🌊' },
  { id: 'mountain', label: 'Mountain Pass', emoji: '🏔' },
  { id: 'city',     label: 'Night City',   emoji: '🌃' },
];

export function buildScene(road: RoadId, W: number, H: number): BuiltScene {
  switch (road) {
    case 'desert':   return buildDesert(W, H);
    case 'coast':    return buildCoast(W, H);
    case 'mountain': return buildMountain(W, H);
    case 'city':     return buildCity(W, H);
  }
}

export type { BuiltScene } from './types';
