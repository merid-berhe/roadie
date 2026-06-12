// v5.4 — the character roster (Quaternius, CC0). Two are dealt per ride,
// server-authoritative, distinct. Identity = character + stable rider color;
// glyphs retired from player-facing UI. No customization (§6 anonymity).

export type CharacterSet = 'men' | 'women';

export type CharacterDef = {
  id: string;
  name: string;     // fictional first name — zero PII, pure persona
  file: string;     // under /assets/characters/roster/
  set: CharacterSet; // the two packs ship different animation clip sets
};

export const CHARACTERS: CharacterDef[] = [
  { id: 'moss',     name: 'Moss',     file: 'man-longsleeves.glb', set: 'men' },
  { id: 'ray',      name: 'Ray',      file: 'man1.glb',            set: 'men' },
  { id: 'theo',     name: 'Theo',     file: 'man2.glb',            set: 'men' },
  { id: 'sterling', name: 'Sterling', file: 'man-suit.glb',        set: 'men' },
  { id: 'juno',     name: 'Juno',     file: 'w1.glb',              set: 'women' },
  { id: 'vex',      name: 'Vex',      file: 'w2.glb',              set: 'women' },
  { id: 'nia',      name: 'Nia',      file: 'w3.glb',              set: 'women' },
  { id: 'wren',     name: 'Wren',     file: 'w4.glb',              set: 'women' },
  { id: 'sol',      name: 'Sol',      file: 'w5.glb',              set: 'women' },
  { id: 'pia',      name: 'Pia',      file: 'w6.glb',              set: 'women' },
];

export const CHARACTER_IDS = CHARACTERS.map((c) => c.id);

export function characterById(id: string | undefined | null): CharacterDef | null {
  return CHARACTERS.find((c) => c.id === id) ?? null;
}

// Clip names differ per pack (matched by suffix at runtime):
//   men:   Idle, Sitting, Standing, Walk, Run, Clapping, Jump, …
//   women: Idle, Wave, Walk, Run, Roll, … (no Sitting — only chest-up is
//          visible through the windshield, so Idle at seat height works)
export const RIDE_CLIP: Record<CharacterSet, string> = { men: 'Sitting', women: 'Idle' };
export const IDLE_CLIP: Record<CharacterSet, string> = { men: 'Idle', women: 'Idle' };

/** Dance move → clip suffix, per set. Missing moves fall back to the
 * procedural wiggle — per-character move flavor is a feature. */
export const DANCE_CLIPS: Record<CharacterSet, Partial<Record<string, string>>> = {
  men:   { bounce: 'Jump', wave: 'Clapping' },
  women: { wave: 'Wave', spin: 'Roll' },
};
