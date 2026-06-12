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
  instruments: [string, string]; // v5.6 — each rider's featured instrument
  destinationFlavor?: string;
  vocals: boolean;
}

export interface PromptGate {
  check(text: string): Promise<GateResult>;
  /** The producer pass (v5.1): fuse everything into ONE coherent, listenable
   * brief — the alignment layer between two players' clashing prompts. */
  fuse(input: FuseInput): Promise<string | null>;
  /** v5.2: MiniMax requires lyrics text when is_instrumental=false — the
   * producer writes them from the fused brief. */
  lyrics(input: { brief: string; destinationName?: string }): Promise<string | null>;
}

const SYSTEM_PROMPT = `You are a content gate for a cozy two-player music game where players type a short prompt (up to 100 characters) describing the song they want to make together. You do NOT rewrite their creative intent.
Respond with ONLY minified JSON: {"ok":true,"display":"...","music":"..."} or {"ok":false}.
Rules:
- "display" is the player's text essentially verbatim (fix nothing, keep their voice and language). Only ok=false if the text is hateful, sexual, harassing, threatening, mostly profanity, or contains personal information (names of private people, addresses, phones) or URLs. A mild swear inside a genuine musical request is fine.
- "music" equals "display" EXCEPT: replace any artist, band, or song names with concise style descriptors of that artist's sound (e.g. "like Bill Withers" → "like early-70s warm soul with mellow electric piano"). If there are no such names, "music" is identical to "display".
- Never add content the player didn't imply. Keep both under 160 characters.`;

const FUSE_SYSTEM_PROMPT = `You are the record producer for a two-player music game. Two players each picked a featured instrument and wrote a short direction for ONE shared song. Write a single music-generation brief that fuses everything into one coherent, genuinely listenable track.
Rules:
- THE PLAYERS' WRITTEN DIRECTIONS LEAD. Be specific and faithful to them: if they ask for Ethiopian jazz, the brief is unmistakably Ethiopian jazz (pentatonic horn lines, vintage organ, swinging drums) — never dilute a specific request into generic mood music.
- BOTH featured instruments must be clearly present in the brief.
- Pick ONE unifying fusion when the two directions differ. Honor a recognizable element of EACH.
- Be concrete: genre, tempo feel, instruments, groove, mood.
- Any setting context provided is light seasoning only — a word or two at most, never the lead.
- No artist, band, or song names. Plain descriptive English. Maximum 220 characters.
- Output ONLY the brief text, no quotes, no preamble.`;

const LYRICS_SYSTEM_PROMPT = `You write song lyrics for a cozy two-player road-trip game. Given a musical brief, write the lyrics for a ~2 minute song.
Rules:
- Two short verses and a short chorus that repeats once: roughly 8–12 short lines total, MAXIMUM 480 characters.
- One line per lyric line, separated by newlines. No section labels, no brackets, no quotes.
- Warm, evocative, singable. Match the brief's mood and any place it mentions. If the brief implies a non-English language, write in it.
- No artist names, no profanity, no personal names.
- Output ONLY the lyrics.`;

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
        input.driverText ? `Player A's direction: ${input.driverText}` : null,
        input.passengerText ? `Player B's direction: ${input.passengerText}` : null,
        `Player A's featured instrument: ${input.instruments[0]}. Player B's: ${input.instruments[1]}.`,
        input.destinationFlavor ? `Setting (seasoning only): ${input.destinationFlavor}.` : null,
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

  async lyrics(input: { brief: string; destinationName?: string }): Promise<string | null> {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 10_000);
    try {
      const res = await fetch(this.base, {
        method: 'POST',
        headers: { Authorization: `Key ${this.key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'openai/gpt-4o-mini',
          system_prompt: LYRICS_SYSTEM_PROMPT,
          prompt: `Brief: ${input.brief}${input.destinationName ? `\nPlace: ${input.destinationName}.` : ''}`,
        }),
        signal: ctrl.signal,
      });
      if (!res.ok) throw new Error(`fal any-llm ${res.status}: ${await res.text()}`);
      const data = (await res.json()) as { output?: string };
      const lyrics = data.output?.trim().replace(/^["'\s]+|["'\s]+$/g, '');
      return lyrics ? lyrics.slice(0, 590) : null; // MiniMax lyrics cap ~600 chars
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
    return bits ? `${bits}, featuring ${input.instruments[0]} and ${input.instruments[1]} (mock brief)` : null;
  }

  async lyrics(input: { brief: string; destinationName?: string }): Promise<string | null> {
    await new Promise<void>((r) => setTimeout(r, 200));
    return `mock verse about the open road\nmock chorus we sing together\n(mock lyrics for: ${input.brief.slice(0, 40)})`;
  }
}
