// §15: MusicGenerator adapter — keeps provider assumptions out of the room server.

export interface MusicGeneratorInput {
  prompt: string;
  bpm: number;
  durationSec: number;
  vocals?: boolean; // §12 v5.0 — only true when BOTH riders opted in
  lyrics?: string;  // v5.2 — REQUIRED by MiniMax when vocals=true (422 otherwise)
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

  // One flaky fal request must not kill the ride: each attempt gets a hard
  // timeout (vocal mode has high latency variance — we've measured >5min
  // hangs), and a failed attempt is retried once. Errors are labeled by
  // origin so the logs distinguish fal HTTP errors from runtime aborts.
  async generate(input: MusicGeneratorInput): Promise<MusicGeneratorOutput> {
    const startTime = Date.now();
    let lastErr: Error | null = null;
    for (let attempt = 1; attempt <= 2; attempt++) {
      const t0 = Date.now();
      try {
        const out = await this.attempt(input);
        return { ...out, latencyMs: Date.now() - startTime };
      } catch (err) {
        lastErr = err instanceof Error ? err : new Error(String(err));
        console.error(`[music] attempt ${attempt} failed after ${Math.round((Date.now() - t0) / 1000)}s: ${lastErr.message}`);
      }
    }
    throw lastErr ?? new Error('generation failed');
  }

  private async attempt(input: MusicGeneratorInput): Promise<{ audioUrl: string }> {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 240_000); // §16 generation abandon
    try {
      let res: Response;
      try {
        res = await fetch(this.base, {
          method: 'POST',
          headers: { Authorization: `Key ${this.key}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt: input.prompt,
            // vocal mode requires non-empty lyrics (fal 422 otherwise); the server
            // guarantees lyrics are present whenever vocals=true
            is_instrumental: input.vocals !== true || !input.lyrics,
            ...(input.vocals === true && input.lyrics ? { lyrics: input.lyrics, lyrics_optimizer: true } : {}),
            audio_setting: { format: 'mp3', sample_rate: 44100, bitrate: 128000 },
          }),
          signal: ctrl.signal,
        });
      } catch (err) {
        // runtime-level failure (workerd "internal error", socket drop, our abort)
        const msg = err instanceof Error ? err.message : String(err);
        throw new Error(ctrl.signal.aborted ? 'transport: timed out at 240s' : `transport: ${msg}`);
      }

      if (!res.ok) throw new Error(`fal ${res.status}: ${await res.text()}`);

      const result = (await res.json()) as { audio?: { url?: string } };
      const audioUrl = result.audio?.url;
      if (!audioUrl) throw new Error('fal: no audio url in response');
      return { audioUrl };
    } finally {
      clearTimeout(timer);
    }
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
