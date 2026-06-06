// §15: MusicGenerator adapter — keeps provider assumptions out of the room server.

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
// fal.ai → MiniMax Music v2.5  (queue API + polling, §16 timeout = 210s)
// MiniMax takes ~30–180s for a 2-min track depending on server load.
// We pre-fire during composition (§15) so most of this is covered.
// ---------------------------------------------------------------------------
export class FalMiniMaxGenerator implements MusicGenerator {
  private readonly base = 'https://queue.fal.run/fal-ai/minimax-music/v2.5';

  constructor(private readonly key: string) {}

  async generate(input: MusicGeneratorInput): Promise<MusicGeneratorOutput> {
    const startTime = Date.now();
    const elapsed = () => Date.now() - startTime;
    const headers = { Authorization: `Key ${this.key}`, 'Content-Type': 'application/json' };

    // 1. Submit
    const submitRes = await fetch(this.base, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        prompt: input.prompt,
        is_instrumental: true,
        audio_setting: { format: 'mp3', sample_rate: 44100, bitrate: 128000 },
      }),
    });
    if (!submitRes.ok) throw new Error(`fal submit ${submitRes.status}: ${await submitRes.text()}`);
    const { request_id } = (await submitRes.json()) as { request_id: string };
    console.log(`[room] fal queued request_id=${request_id}`);

    // 2. Poll — §16 abandon threshold extended to 210s for MiniMax
    while (elapsed() < 210_000) {
      await sleep(5_000);
      const statusRes = await fetch(`${this.base}/requests/${request_id}/status`, { headers });
      if (!statusRes.ok) continue;
      const { status } = (await statusRes.json()) as { status: string };
      console.log(`[room] fal status=${status} elapsed=${Math.round(elapsed() / 1000)}s`);
      if (status === 'FAILED') throw new Error('fal: generation FAILED');
      if (status !== 'COMPLETED') continue;

      // 3. Fetch result
      const resultRes = await fetch(`${this.base}/requests/${request_id}`, { headers });
      if (!resultRes.ok) throw new Error(`fal result ${resultRes.status}`);
      const result = (await resultRes.json()) as { audio?: { url?: string } };
      const audioUrl = result.audio?.url;
      if (!audioUrl) throw new Error('fal: no audio url in result');
      return { audioUrl, latencyMs: elapsed() };
    }

    throw new Error('fal: generation timeout (210s)');
  }
}

// ---------------------------------------------------------------------------
// Mock — local dev without FAL_KEY
// ---------------------------------------------------------------------------
export class MockMusicGenerator implements MusicGenerator {
  async generate(_input: MusicGeneratorInput): Promise<MusicGeneratorOutput> {
    await sleep(2_000);
    return { audioUrl: 'mock://no-fal-key', latencyMs: 2_000 };
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
