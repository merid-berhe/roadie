// §15: MusicGenerator adapter — keeps provider assumptions out of the room server.

export interface MusicGeneratorInput {
  prompt: string;
  bpm: number;
  durationSec: number;
  vocals?: boolean; // §12 v5.0 — only true when BOTH riders opted in
}

export interface MusicGeneratorOutput {
  audioUrl: string;
  latencyMs: number;
}

export interface MusicGenerator {
  generate(input: MusicGeneratorInput): Promise<MusicGeneratorOutput>;
}

// ---------------------------------------------------------------------------
// fal.ai → MiniMax Music v2.5  (sync endpoint — queue API returns empty
// status responses on this account, sync endpoint confirmed working ~75s)
// ---------------------------------------------------------------------------
export class FalMiniMaxGenerator implements MusicGenerator {
  private readonly base = 'https://fal.run/fal-ai/minimax-music/v2.5';

  constructor(private readonly key: string) {}

  async generate(input: MusicGeneratorInput): Promise<MusicGeneratorOutput> {
    const startTime = Date.now();

    const res = await fetch(this.base, {
      method: 'POST',
      headers: { Authorization: `Key ${this.key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: input.prompt,
        is_instrumental: input.vocals !== true,
        audio_setting: { format: 'mp3', sample_rate: 44100, bitrate: 128000 },
      }),
    });

    if (!res.ok) throw new Error(`fal ${res.status}: ${await res.text()}`);

    const result = (await res.json()) as { audio?: { url?: string } };
    const audioUrl = result.audio?.url;
    if (!audioUrl) throw new Error('fal: no audio url in response');

    return { audioUrl, latencyMs: Date.now() - startTime };
  }
}

// ---------------------------------------------------------------------------
// Mock — local dev without FAL_KEY
// ---------------------------------------------------------------------------
export class MockMusicGenerator implements MusicGenerator {
  async generate(_input: MusicGeneratorInput): Promise<MusicGeneratorOutput> {
    await new Promise<void>((r) => setTimeout(r, 2_000));
    return { audioUrl: 'mock://no-fal-key', latencyMs: 2_000 };
  }
}
