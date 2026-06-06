// §15: the MusicGenerator adapter — keeps fal.ai/MiniMax assumptions out of the room
// server so providers can be swapped (§19 dependency risk mitigation).

export interface MusicGeneratorInput {
  prompt: string;
  bpm: number;
  durationSec: number;
}

export interface MusicGeneratorOutput {
  audioUrl: string;
  latencyMs: number;
}

export interface MusicGenerator {
  generate(input: MusicGeneratorInput): Promise<MusicGeneratorOutput>;
}

// ---------------------------------------------------------------------------
// fal.ai → MiniMax Music v2.5  (§4 primary impl, key server-side)
// Uses the queue API for reliability: submit → poll → result.
// §16: generation abandon = 60s.
// ---------------------------------------------------------------------------
export class FalMiniMaxGenerator implements MusicGenerator {
  // Synchronous endpoint — single blocking fetch, no polling needed.
  // More reliable inside workerd than the queue+poll approach.
  private readonly base = 'https://fal.run/fal-ai/minimax-music/v2.5';

  constructor(private readonly key: string) {}

  async generate(input: MusicGeneratorInput): Promise<MusicGeneratorOutput> {
    const startTime = Date.now();

    const res = await fetch(this.base, {
      method: 'POST',
      headers: { Authorization: `Key ${this.key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: input.prompt,
        is_instrumental: true,
        audio_setting: { format: 'mp3', sample_rate: 44100, bitrate: 128000 },
      }),
    });

    if (!res.ok) throw new Error(`fal ${res.status}: ${await res.text()}`);

    const result = (await res.json()) as { audio?: { url?: string }; url?: string };
    const audioUrl = result.audio?.url ?? (result as { url?: string }).url;
    if (!audioUrl) throw new Error('fal: no audio url in result');

    return { audioUrl, latencyMs: Date.now() - startTime };
  }
}

// ---------------------------------------------------------------------------
// Mock — used when FAL_KEY is absent (local dev without spending credits).
// Returns immediately with a sentinel URL so the server harness can verify
// the rideStart broadcast path. The client handles unloadable URLs gracefully.
// ---------------------------------------------------------------------------
export class MockMusicGenerator implements MusicGenerator {
  async generate(_input: MusicGeneratorInput): Promise<MusicGeneratorOutput> {
    await sleep(2_000); // simulate latency
    return {
      // A short publicly licensed silent WAV served via data URI so the harness
      // test can verify the URL is present. In the browser this will load silently.
      audioUrl: 'mock://no-fal-key',
      latencyMs: 2_000,
    };
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
