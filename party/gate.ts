// §5a (v5.0): PromptGate — moderation-only. fal is the arbiter of musical
// interpretation, so the gate no longer translates style. It produces two
// outputs from one call:
//   display — what the co-rider sees: the text essentially verbatim, blocked
//             only for abuse/PII (the §12 stranger-safety line)
//   music   — what the music API gets: display, with artist/band/song names
//             swapped for style descriptors (provider-policy/rights, §19)

export interface GateResult {
  ok: boolean;
  display?: string;
  music?: string;
}

export interface FuseInput {
  driverText?: string;     // music-side texts (artist names already swapped)
  passengerText?: string;
  moods: [string, string];
  destinationFlavor?: string;
  vocals: boolean;
}

export interface PromptGate {
  check(text: string): Promise<GateResult>;
  /** The producer pass (v5.1): fuse everything into ONE coherent, listenable
   * brief — the alignment layer between two players' clashing prompts. */
  fuse(input: FuseInput): Promise<string | null>;
}

const SYSTEM_PROMPT = `You are a content gate for a cozy two-player music game where players type a short prompt (up to 100 characters) describing the song they want to make together. You do NOT rewrite their creative intent.
Respond with ONLY minified JSON: {"ok":true,"display":"...","music":"..."} or {"ok":false}.
Rules:
- "display" is the player's text essentially verbatim (fix nothing, keep their voice and language). Only ok=false if the text is hateful, sexual, harassing, threatening, mostly profanity, or contains personal information (names of private people, addresses, phones) or URLs. A mild swear inside a genuine musical request is fine.
- "music" equals "display" EXCEPT: replace any artist, band, or song names with concise style descriptors of that artist's sound (e.g. "like Bill Withers" → "like early-70s warm soul with mellow electric piano"). If there are no such names, "music" is identical to "display".
- Never add content the player didn't imply. Keep both under 160 characters.`;

const FUSE_SYSTEM_PROMPT = `You are the record producer for a cozy two-player road-trip game. Two players each wrote a short request for ONE shared song. Write a single music-generation brief that fuses everything into one coherent, genuinely listenable track.
Rules:
- Pick ONE unifying genre or fusion direction. When the requests clash, find the tasteful overlap — do not list everything side by side.
- Be concrete: tempo feel, 2–4 instruments, groove, mood. Honor a recognizable element of EACH player's request.
- The result must read like a track a person would enjoy on a drive — coherent and musical above all.
- No artist, band, or song names. Plain descriptive English. Maximum 220 characters.
- Output ONLY the brief text, no quotes, no preamble.`;

// ---------------------------------------------------------------------------
// fal.ai any-llm — reuses the existing FAL_KEY, ~$0.001/call, gpt-4o-mini tier
// ---------------------------------------------------------------------------
export class FalLlmGate implements PromptGate {
  private readonly base = 'https://fal.run/fal-ai/any-llm';

  constructor(private readonly key: string) {}

  async check(text: string): Promise<GateResult> {
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
      const parsed = JSON.parse(match[0]) as { ok?: boolean; display?: string; music?: string };
      if (parsed.ok !== true || !parsed.display?.trim() || !parsed.music?.trim()) return { ok: false };
      return {
        ok: true,
        display: parsed.display.trim().slice(0, 160),
        music: parsed.music.trim().slice(0, 160),
      };
    } finally {
      clearTimeout(timer);
    }
  }

  async fuse(input: FuseInput): Promise<string | null> {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 10_000);
    try {
      const parts = [
        input.driverText ? `Player A asked for: ${input.driverText}` : null,
        input.passengerText ? `Player B asked for: ${input.passengerText}` : null,
        `Shared moods: ${input.moods[0]} + ${input.moods[1]}.`,
        input.destinationFlavor ? `Setting: ${input.destinationFlavor}.` : null,
        input.vocals ? 'The track will have vocals.' : 'The track is instrumental.',
      ].filter(Boolean).join('\n');

      const res = await fetch(this.base, {
        method: 'POST',
        headers: { Authorization: `Key ${this.key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'openai/gpt-4o-mini',
          system_prompt: FUSE_SYSTEM_PROMPT,
          prompt: parts,
        }),
        signal: ctrl.signal,
      });
      if (!res.ok) throw new Error(`fal any-llm ${res.status}: ${await res.text()}`);
      const data = (await res.json()) as { output?: string };
      const brief = data.output?.trim().replace(/^["'\s]+|["'\s]+$/g, '');
      return brief ? brief.slice(0, 220) : null;
    } finally {
      clearTimeout(timer);
    }
  }
}

// ---------------------------------------------------------------------------
// Mock — local dev without FAL_KEY. Crude word gate + pass-through.
// ---------------------------------------------------------------------------
const MOCK_BLOCKLIST = ['fuck', 'shit', 'bitch', 'cunt', 'slut', 'whore', 'nigg', 'fag'];

export class MockPromptGate implements PromptGate {
  async check(text: string): Promise<GateResult> {
    await new Promise<void>((r) => setTimeout(r, 300));
    const lowered = text.toLowerCase();
    if (MOCK_BLOCKLIST.some((w) => lowered.includes(w))) return { ok: false };
    const clean = text.trim().slice(0, 160);
    return clean ? { ok: true, display: clean, music: clean } : { ok: false };
  }

  async fuse(input: FuseInput): Promise<string | null> {
    await new Promise<void>((r) => setTimeout(r, 300));
    const bits = [input.driverText, input.passengerText].filter(Boolean).join(' meets ');
    return bits ? `${bits}, fused into one ${input.moods[0]} groove (mock brief)` : null;
  }
}
