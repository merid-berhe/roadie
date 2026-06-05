// Anonymous-persistent identity (§6): a user IS a glyph + color. No faces, no PII.
// The glyph silhouette is also the in-cabin embodiment of the rider (§7, layer 6).

export type GlyphIdentity = {
  /** Single-character glyph rendered as the rider's silhouette + on saved songs. */
  glyph: string;
  /** Hex color tinting the glyph. */
  color: string;
  /** Human-readable color name, for attribution copy ("● teal brought the rhodes"). */
  colorName: string;
};

export const IDENTITY_PALETTE: readonly GlyphIdentity[] = [
  { glyph: '▲', color: '#F5A623', colorName: 'amber' },
  { glyph: '●', color: '#1FB6C4', colorName: 'teal' },
  { glyph: '◆', color: '#E0566B', colorName: 'rose' },
  { glyph: '■', color: '#7C6FF0', colorName: 'violet' },
  { glyph: '★', color: '#3FB36B', colorName: 'meadow' },
  { glyph: '⬣', color: '#E8893B', colorName: 'ember' },
] as const;

/**
 * Derive a stable glyph identity from a user id. Deterministic so identity
 * survives a refresh even before the §14 `users` row exists — the persisted
 * id is the only thing we need to keep the same glyph (M0 acceptance: refresh
 * keeps the same identity).
 */
export function deriveIdentity(userId: string): GlyphIdentity {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = (hash * 31 + userId.charCodeAt(i)) | 0;
  }
  const index = Math.abs(hash) % IDENTITY_PALETTE.length;
  return IDENTITY_PALETTE[index];
}
