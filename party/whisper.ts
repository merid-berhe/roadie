// §5a: WhisperTranslator adapter — gates and translates "tune the radio" free
// text into safe style descriptors. Raw player text never reaches the music
// API or the other player; only the minted `style` string leaves this layer.

export interface WhisperResult {
  ok: boolean;
  style?: string;
}

export interface WhisperTranslator {
  translate(text: string): Promise<WhisperResult>;
}

const SYSTEM_PROMPT = `You gate and translate short free-text notes for a cozy two-player music game. A player describes a musical vibe in up to 100 characters; you convert it into safe style descriptors for an instrumental music generator.
Respond with ONLY minified JSON: {"ok":true,"style":"..."} or {"ok":false}.
Rules:
- "style" is at most 90 characters of plain-English music descriptors: era, genre feel, instrumentation, mood, rhythm, texture.
- NEVER include artist, band, or song names in "style". If the input names one, translate it into descriptive style language instead (e.g. a 70s soul singer becomes "early-70s warm soul, mellow electric piano, easy groove").
- The music is instrumental: no vocal or lyric instructions.
- ok=false if the input is hateful, sexual, harassing, mostly profanity, or contains personal information or URLs. A mild word inside a genuine musical request is fine — translate the musical intent.
- Non-English input is fine; always answer in English.`;

// ---------------------------------------------------------------------------
// fal.ai any-llm — reuses the existing FAL_KEY, ~$0.001/call, gpt-4o-mini tier
// ---------------------------------------------------------------------------
export class FalLlmTranslator implements WhisperTranslator {
  private readonly base = 'https://fal.run/fal-ai/any-llm';

  constructor(private readonly key: string) {}

  async translate(text: string): Promise<WhisperResult> {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8_000);
    try {
      const res = await fetch(this.base, {
        method: 'POST',
        headers: { Authorization: `Key ${this.key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'openai/gpt-4o-mini',
          system_prompt: SYSTEM_PROMPT,
          prompt: text,
        }),
        signal: ctrl.signal,
      });
      if (!res.ok) throw new Error(`fal any-llm ${res.status}: ${await res.text()}`);
      const data = (await res.json()) as { output?: string };
      const match = data.output?.match(/\{[\s\S]*\}/);
      if (!match) return { ok: false };
      const parsed = JSON.parse(match[0]) as { ok?: boolean; style?: string };
      if (parsed.ok !== true || typeof parsed.style !== 'string' || !parsed.style.trim()) {
        return { ok: false };
      }
      return { ok: true, style: parsed.style.trim().slice(0, 90) };
    } finally {
      clearTimeout(timer);
    }
  }
}

// ---------------------------------------------------------------------------
// Mock — local dev without FAL_KEY. Crude word gate + pass-through.
// ---------------------------------------------------------------------------
const MOCK_BLOCKLIST = ['fuck', 'shit', 'bitch', 'cunt', 'slut', 'whore', 'nigg', 'fag'];

export class MockWhisperTranslator implements WhisperTranslator {
  async translate(text: string): Promise<WhisperResult> {
    await new Promise<void>((r) => setTimeout(r, 400));
    const lowered = text.toLowerCase();
    if (MOCK_BLOCKLIST.some((w) => lowered.includes(w))) return { ok: false };
    const style = text.replace(/[^\p{L}\p{N}\s',-]/gu, '').trim().slice(0, 90);
    return style ? { ok: true, style: `${style} (mock-tuned)` } : { ok: false };
  }
}
