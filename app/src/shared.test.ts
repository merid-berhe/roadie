import { describe, expect, it } from 'vitest';
import {
  DESTINATIONS,
  IDENTITY_PALETTE,
  buildPrompt,
  deriveIdentity,
  pickDestinationForRoom,
} from '@roadie/shared';

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

describe('destinations', () => {
  it('picks a stable destination for a room code', () => {
    expect(pickDestinationForRoom('room-paris-1')).toEqual(pickDestinationForRoom('room-paris-1'));
  });

  it('adds destination flavor to the generation prompt', () => {
    const destination = DESTINATIONS[0];
    const result = buildPrompt(
      'midnight',
      'wide-open',
      { groove: 'cruising', tempo: 'medium', energy: 'steady' },
      { lead_instrument: 'rhodes', brightness: 'warm', texture: 'lush' },
      destination,
    );

    expect(result.prompt).toContain(destination.name);
    expect(result.prompt).toContain(destination.promptFlavor);
  });

  it('weaves minted radio styles into the prompt and recipe (§5a)', () => {
    const radio = { driver: 'early-70s warm soul, mellow electric piano', passenger: 'dusty desert blues' };
    const result = buildPrompt(
      'midnight',
      'wide-open',
      { groove: 'cruising', tempo: 'medium', energy: 'steady' },
      { lead_instrument: 'rhodes', brightness: 'warm', texture: 'lush' },
      DESTINATIONS[0],
      radio,
    );

    expect(result.prompt).toContain(radio.driver);
    expect(result.prompt).toContain(radio.passenger);
    expect(result.prompt).toContain('no vocals'); // instrumental stays non-negotiable
    expect(result.recipe.radio).toEqual(radio);
  });

  it('omits radio from prompt and recipe when no whispers were tuned', () => {
    const result = buildPrompt(
      'midnight',
      'wide-open',
      { groove: 'cruising', tempo: 'medium', energy: 'steady' },
      { lead_instrument: 'rhodes', brightness: 'warm', texture: 'lush' },
      DESTINATIONS[0],
      {},
    );

    expect(result.recipe.radio).toBeUndefined();
  });
});
