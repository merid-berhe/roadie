import { describe, expect, it } from 'vitest';
import { IDENTITY_PALETTE, deriveIdentity } from '@roadie/shared';

// Foundation test (§5 health check): proves the workspace import resolves and
// that identity is stable across refresh (M0 acceptance).
describe('deriveIdentity', () => {
  it('is stable for the same id', () => {
    expect(deriveIdentity('user-abc-123')).toEqual(deriveIdentity('user-abc-123'));
  });

  it('always returns a member of the palette', () => {
    for (const id of ['a', 'user-1', crypto.randomUUID(), '★weird★']) {
      expect(IDENTITY_PALETTE).toContainEqual(deriveIdentity(id));
    }
  });
});
