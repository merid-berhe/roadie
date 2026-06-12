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
});

describe('buildPrompt (§5 v5.6 — instruments + direction paragraphs)', () => {
  const destination = DESTINATIONS[0];

  it('user texts lead the prompt; instruments ride along via the brief', () => {
    const result = buildPrompt(destination, {
      driverInstrument: 'saxophone',
      passengerInstrument: 'rhodes',
      driverMusicText: 'rainy-night ethiopian jazz, melancholic but warm',
      passengerMusicText: 'something dreamy with strings',
      driverDisplayText: 'rainy-night ethiopian jazz, melancholic but warm',
      passengerDisplayText: 'something dreamy with strings',
    });

    expect(result.prompt).toContain('ethiopian jazz');
    expect(result.prompt).toContain('featuring saxophone and rhodes'); // no brief yet → raw path
    expect(result.prompt).not.toContain('road-trip'); // no generic washing on the text path
    expect(result.prompt).toContain(destination.name);
    expect(result.prompt).toContain('no vocals'); // instrumental by default
    expect(result.recipe.driver.instrument).toBe('saxophone');
    expect(result.recipe.driver.text).toContain('ethiopian jazz');
    expect(result.recipe.vocals).toBe(false);
  });

  it('a fused producer brief replaces the raw join AND the instrument tag', () => {
    const result = buildPrompt(destination, {
      driverInstrument: 'saxophone',
      passengerInstrument: 'rhodes',
      driverMusicText: 'ethiopian jazz',
      passengerMusicText: 'dreamy strings',
      fusedBrief: 'melancholic Ethio-jazz with smoky saxophone leads over warm rhodes and soft strings, slow swing',
    });
    expect(result.prompt).toContain('Ethio-jazz with smoky saxophone');
    expect(result.prompt).not.toContain('ethiopian jazz; dreamy strings'); // raw join replaced
    expect(result.prompt).not.toContain('featuring saxophone and rhodes'); // brief carries them
    expect(result.recipe.brief).toContain('rhodes');
  });

  it('instruments + destination carry the song when nobody typed', () => {
    const result = buildPrompt(destination, {
      driverInstrument: 'piano',
      passengerInstrument: 'percussion',
    });
    expect(result.prompt).toContain('featuring piano and percussion');
    expect(result.prompt).toContain('road-trip feel');
    expect(result.prompt).toContain('instrumental');
    expect(result.recipe.driver.text).toBeUndefined();
  });

  it('flips to vocals only when asked (both-opt-in is enforced server-side)', () => {
    const result = buildPrompt(destination, {
      driverInstrument: 'guitar',
      passengerInstrument: 'synth',
      vocals: true,
    });
    expect(result.vocals).toBe(true);
    expect(result.prompt).toContain('with vocals');
    expect(result.prompt).not.toContain('no vocals');
    expect(result.recipe.vocals).toBe(true);
  });
});
