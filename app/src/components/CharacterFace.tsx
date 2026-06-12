// v5.4 — a roster character's baked portrait, with the rider's color as the ring.
// Unknown ids (legacy glyph strings like ▲) render as plain text.
import { characterById } from '@roadie/shared';

export function CharacterFace({
  id,
  color,
  size = 40,
}: {
  id?: string | null;
  color?: string;
  size?: number;
}) {
  const def = characterById(id);
  if (!def) {
    return (
      <span style={{ color: color ?? 'rgba(255,255,255,0.6)', fontSize: size * 0.7 }}>{id ?? '○'}</span>
    );
  }
  return (
    <img
      src={`/assets/characters/portraits/${def.id}.png`}
      alt={def.name}
      title={def.name}
      className="rounded-full"
      style={{ width: size, height: size, border: `2px solid ${color ?? 'rgba(255,255,255,0.25)'}` }}
    />
  );
}

export function characterName(id?: string | null): string | null {
  return characterById(id)?.name ?? null;
}
