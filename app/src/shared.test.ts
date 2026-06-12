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

describe('buildPrompt (§5 v5.0 — prompt-first)', () => {
  const destination = DESTINATIONS[0];

  it('weaves both riders’ music texts, moods, and destination into the prompt', () => {
    const result = buildPrompt('midnight', 'wide-open', destination, {
      driverMusicText: 'early-70s warm soul with mellow electric piano',
      passengerMusicText: 'dusty desert blues',
      driverDisplayText: 'like bill withers',
      passengerDisplayText: 'dusty desert blues',
    });

    expect(result.prompt).toContain('early-70s warm soul');
    expect(result.prompt).toContain('dusty desert blues');
    expect(result.prompt).toContain('midnight + wide-open mood');
    expect(result.prompt).toContain(destination.name);
    expect(result.prompt).toContain('no vocals'); // instrumental by default
    // the recipe records the DISPLAY texts (what the riders saw), not the music-side swaps
    expect(result.recipe.driver.text).toBe('like bill withers');
    expect(result.recipe.vocals).toBe(false);
  });

  it('still builds a valid prompt when nobody typed anything', () => {
    const result = buildPrompt('rainy', 'dreaming', destination, {});
    expect(result.prompt).toContain('rainy + dreaming mood');
    expect(result.prompt).toContain('instrumental');
    expect(result.recipe.driver.text).toBeUndefined();
  });

  it('flips to vocals only when asked (both-opt-in is enforced server-side)', () => {
    const result = buildPrompt('rainy', 'dreaming', destination, { vocals: true });
    expect(result.vocals).toBe(true);
    expect(result.prompt).toContain('with vocals');
    expect(result.prompt).not.toContain('no vocals');
    expect(result.recipe.vocals).toBe(true);
  });

  it('a fused producer brief replaces the raw text join (§5a alignment)', () => {
    const result = buildPrompt('midnight', 'wide-open', destination, {
      driverMusicText: 'psychedelic guitar rock',
      passengerMusicText: 'afrobeat percussion',
      driverDisplayText: 'like jimi hendrix',
      passengerDisplayText: 'afro beats',
      fusedBrief: 'psychedelic funk-rock guitar over afrobeat grooves, mid-tempo, warm and driving',
    });
    expect(result.prompt).toContain('psychedelic funk-rock guitar over afrobeat grooves');
    expect(result.prompt).not.toContain('psychedelic guitar rock; afrobeat percussion'); // raw join replaced
    expect(result.recipe.brief).toContain('afrobeat grooves');
    expect(result.recipe.driver.text).toBe('like jimi hendrix'); // display attribution intact
  });
});
