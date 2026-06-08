# Roadie — Build Spec v4.0 (Production)

**Status: PRODUCTION BUILD** — MVP validation complete (M0–M6 shipped 2026-06-05). Core loop validated. Now building for quality, not speed.

**Audience:** the engineer/agent (Claude Code) implementing this.
**Document type:** opinionated, executable build specification. Stacks are chosen, not suggested.
**Platform:** mobile-first responsive web (must work in mobile Safari and Chrome; desktop is a bonus, not a target).

---

## 0. The one question this build exists to answer

> **When two strangers compose a piece of music together and then ride along to it, does it feel like *we* made something?**

Everything in this spec serves that question. If a feature does not help measure or produce that feeling, it is out of scope (see §2). This is a **validation prototype**, not a launch. Optimize for *learning fast and cheap*, not for scale, polish, or revenue. Treat instrumentation (§13) as a first-class feature, not an afterthought — the prototype is worthless if we can't read the result.

---

## 1. The experience, end to end (what gets built)

A single playthrough, called a **ride**:

1. **Get in the car (audio unlock + identity).** User opens a link, taps a single "Get in" control. That tap (a) unlocks the Web Audio context — mandatory on iOS Safari, see §11 — and (b) establishes an anonymous-persistent identity (§6). Engine idle hum begins.
2. **Pairing.** Two users are placed in the same room. For validation we primarily use **invite-link pairing** (two recruited testers join the same room code) and a simple FIFO **random queue** as secondary. See §10.
3. **Compose together (the lobby).** Before the car moves, the two riders — assigned fixed roles **Driver** and **Passenger** — make a short, *visible, turn-aware* set of choices that together define the song. Each rider controls different musical dimensions ("two hands on one wheel," §7). They can see each other's choices land. When both tap **"Let's drive,"** generation fires.
4. **Tuning the radio (latency mask — critical).** Generation takes ~10–30s. During this, the car pulls out, scenery starts, a **procedural ambient bed plays instantly** (Tone.js), and the **live gesture layer is already active** so the two can wave/react while they wait. When the generated track arrives, crossfade the bed into it ("the radio tuning in"). The rider must **never** sit in silent dead air with a stranger.
5. **The ride (~2 min, listen + light presence).** The generated song plays, synced for both. Scenery scrolls. The riders are mostly listening together, with a *thin* layer of live interaction: reskinned warm reactions, beat-locked sound flourishes, and a co-launched firework finale (§8).
6. **Arrival (keepsake + rate).** The song resolves. Riders co-name it (each contributes a word, or one names + other taps approve). The track is saved to the **Glovebox** with both anonymous contributor glyphs and the road/date. Then a short post-ride rating (positive tokens + a separate "something went wrong" path) and **one validation question** (§13).

---

## 2. Scope

### In scope (build this)
- Anonymous-persistent identity (device-based, no PII).
- Invite-link + simple random pairing for exactly **2 players**.
- One road / one scenery theme.
- Lobby composition UI with the Driver/Passenger split.
- Front-loaded **single-call AI music generation** (instrumental).
- Procedural ambient bed + crossfade to generated track.
- Synced two-player playback with a server-authoritative clock.
- Live gesture layer: warm reactions, beat-locked sounds, co-launched firework finale.
- Minimal Glovebox (your saved songs, playable).
- Post-ride rating + report + validation survey.
- Full instrumentation/analytics.

### Explicitly OUT of scope (deferred — see the v2 brief)
Monetization, subscriptions, payments, cosmetics shop, scene selection, multiple roads, community "Radio" library, gifts/collectibles, real-time/live AI mixing, vocals + lyric moderation, email/social accounts, full reputation-gated matchmaking, bots/solo mode, internationalization. **Do not build these.** If a shortcut now would block one later, leave a `// DEFERRED:` note, but build the prototype.

---

## 3. Architecture overview

```
                 ┌──────────────────────────────────────────┐
   Mobile Web    │  React + TS (Vite) SPA                    │
   (2 clients)   │  • Tone.js audio engine                   │
                 │  • PixiJS scenery + particle FX           │
                 │  • Zustand game state                     │
                 └───────────────┬───────────────┬───────────┘
                                 │ WebSocket      │ HTTPS (auth/db/storage)
                                 ▼                ▼
          ┌───────────────────────────┐   ┌──────────────────────────┐
          │ PartyKit room server (TS) │   │ Supabase                 │
          │  • matchmaking / room     │   │  • Anonymous Auth        │
          │  • authoritative clock    │   │  • Postgres (Glovebox,   │
          │  • relays choices+gestures│   │    rides, reports, rep)  │
          │  • firework sync window   │   │  • Storage (audio files) │
          │  • triggers generation ───┼──▶│                          │
          └─────────────┬─────────────┘   └──────────────────────────┘
                        │ HTTPS (server-side key)
                        ▼
          ┌───────────────────────────┐
          │ Music gen API (fal.ai →    │
          │ MiniMax Music). Swappable  │
          │ behind a thin adapter.     │
          └───────────────────────────┘
```

**Key principle:** the **PartyKit room is the single source of truth** for a ride (clock, state machine, who's done what). Clients are dumb renderers of room state plus local audio/visual playback. The generation API key lives only server-side.

**State authority rules (codify in code, not just in heads):**
- **Zustand is a read-only projection of room state** for everything that affects correctness — current phase, timestamps, generation status, ride identity, peer presence. Local code reads from it; only the room-message handler writes to it. Components never write phase-affecting state directly.
- **Optimistic local updates are allowed *only* for individually rendered gestures** (wave, headlights, heart, beat-locked sounds): the local animation plays the instant the user taps, *and* the message is sent to the room, which echoes to the peer. If the room rejects (rate-limit, suspended user), absorb silently — no rollback needed because gestures are visual flourishes.
- **The firework synced bloom is server-authoritative — *not* optimistic.** The synchrony arbitration ("did both taps land within ~1500ms?") *is* the feature, so the client must wait for `fireworkSynced` from the room before rendering the bloom. A pre-emptive local bloom would lie about co-presence — the entire point is that the magic only happens when the server confirms both taps landed in the window.
- **Conflict resolution rule:** when local optimistic state and room state disagree on anything other than gesture animations, **room wins, always.** Replace, don't merge.

---

## 4. Stack decisions (chosen, with rationale)

| Layer | Choice | Why this, for a 1–2 person team on a four-figure budget |
|---|---|---|
| Language | **TypeScript** everywhere | One language client+server; types catch sync-contract bugs. |
| Frontend framework | **React + Vite** (SPA) | A game is a stateful SPA, not a content site. Vite = fast, simple. **Not Next.js** — SSR adds nothing here and complicates audio/canvas. |
| Styling | **Tailwind CSS** | Fast iteration; keep it minimal, this is a prototype. |
| Game state | **Zustand** | Tiny, no boilerplate; good for fast-changing local state. |
| Audio | **Tone.js** (over Web Audio API) | Needs beat-synced scheduling (gesture sounds snap to tempo) + an ambient bed + transport clock. Tone.js is built exactly for this. Use a plain `<audio>`/`AudioBufferSourceNode` for the generated track, wired into Tone's context. |
| Scenery + FX | **Three.js + @react-three/fiber** (WebGL 3D) | Production decision (2026-06-06): PixiJS 2D parallax validated the loop but horizontal scroll reads as sideways motion. 3D is the right medium — proper back-seat POV, GLB car interior assets load natively, forward road perspective is real not faked, 4 scene themes rendered in actual 3D space. R3F gives React-native integration with clean component model. |
| Realtime / rooms | **PartyKit** (Cloudflare Durable Objects) | Purpose-built for "one stateful server per room" with authoritative logic — ideal for clock, gesture relay, and the firework window. Cheap on Cloudflare. **Fallback:** a small Node + `ws` server on Fly.io/Railway, or raw Durable Objects. *(Verify PartyKit's current status at build time; if changed, use the fallback — the architecture is identical: one authoritative WS room server.)* |
| Auth + DB + Storage | **Supabase** | One vendor covers Anonymous Auth, Postgres, and file Storage with a generous free tier. Minimizes ops. |
| Music generation | **fal.ai → MiniMax Music v2.5** (instrumental) | **$0.15/generation** (confirmed 2026-06-08 from actual billing). Behind a `MusicGenerator` adapter so providers swap without touching the room server. Alternatives evaluated: Suno — no official API (resellers only, §19 risk); **Google Lyria 2** — now available on fal.ai at $0.10/30s (~$0.40 for 2-min track, ~3× MiniMax), commercial licensing murky (Google Preview Product terms restrict production use without written permission). Keep Lyria 2 as quality upgrade candidate once licensing is clarified. |
| Hosting (frontend) | **Cloudflare Pages** or **Vercel** | Free tier; trivial deploys. |
| Analytics | **PostHog** (free tier) or Supabase table | Event capture for §13. PostHog gives funnels out of the box. |

Total expected cost for the validation run: **~$0 infra + ~$0.15 per ride** (confirmed from actual fal.ai billing 2026-06-08). 1,000 test rides ≈ $150 in generation. Still well within budget.

---

## 5. The composition → generation mapping ("two hands on one wheel") — THE HEART

This is the most important section. Mutuality must be **structural**: each rider controls *different* dimensions so the song is impossible to make alone, and the final generation prompt visibly contains *both* people's inputs.

**Shared seed (both, pre-roll):** before roles diverge, each rider taps one **mood word** from a small rotating set (e.g., `golden-hour`, `rainy`, `restless`, `dreaming`, `midnight`, `wide-open`). Both seeds are combined. This guarantees the song reflects both people before anyone "does" anything.

**Driver controls the FOUNDATION:**
- `groove` — e.g. `cruising` | `winding` | `open-highway` (maps to rhythm feel)
- `tempo` — slow / medium / brisk
- `energy` — mellow / steady / driving

**Passenger controls the COLOR:**
- `lead_instrument` — e.g. `piano` | `nylon-guitar` | `synth-pad` | `rhodes` | `strings`
- `brightness` — warm / neutral / bright
- `texture` — clean / lush / lo-fi

Keep each set to **3 choices of ~3 options** — small enough to finish in ~45–60s, large enough to feel expressive. **Use only curated tappable options. No free-text input anywhere** (removes the entire text-abuse vector; see §12).

**Mapping function (server-side, deterministic):**

```ts
function buildPrompt(seedDriver: string, seedPassenger: string, d: DriverChoices, p: PassengerChoices) {
  return {
    // human-readable prompt sent to the generator
    prompt: `Instrumental, ${seedDriver} + ${seedPassenger} mood, ${d.groove} groove, `
          + `${d.energy} energy, ${p.lead_instrument} lead, ${p.brightness} tone, ${p.texture} texture, `
          + `relaxing road-trip feel, no vocals`,
    bpm: tempoToBpm(d.tempo),          // slow≈72, medium≈92, brisk≈112
    durationSec: 120,                   // ~2 min ride (MiniMax single-call; clamp to model max)
    // keep the structured recipe so the UI can attribute each part to a rider
    recipe: {
      driver: { seed: seedDriver, ...d },
      passenger: { seed: seedPassenger, ...p },
    },
  };
}
```

**Attribution in the keepsake:** persist `recipe` with the song. On the saved-song card, render each contribution tagged to its author glyph — *"▲ brought the winding groove; ● brought the rhodes & lush texture."* This is what makes "we made this together" legible after the fact.

---

## 6. Identity & persistence (anonymous-persistent)

- Use **Supabase Anonymous Auth**: on first "Get in," call `signInAnonymously()`. This yields a stable `user_id` persisted in the browser. **No email, no PII.**
- Each user gets a randomly assigned **glyph + color** (e.g. ▲ amber, ● teal) used as their anonymous identity in-ride and on saved songs. Never expose the `user_id` or any cross-ride linkage to the other player.
- Persist the **Glovebox** (saved songs) keyed by `user_id`, so it survives refresh on the same device.
- Leave a `// DEFERRED:` hook for later account upgrade (link email) — do not build it now.

---

## 7. Visual production & scene architecture

**Engine (production): Three.js + @react-three/fiber (R3F)** — replaced PixiJS 2D (2026-06-06). PixiJS was correct for MVP validation speed; 3D is correct for production quality. R3F integrates natively with React, GLB/glTF assets load directly, and the back-seat POV is a real 3D camera rather than a 2D illusion.

**Visual model: 3D back-seat POV.** Camera positioned in the rear of a car interior (loaded as GLB), looking forward through the windshield. The world moves toward the camera. Four scene themes (Desert/Route 66, Coast, Mountain Pass, Night City), each with procedural 3D geometry as placeholder and slots for real 3D assets. Do NOT use Unity or Godot — keep everything in the React/TS/Three.js stack for instant-web mobile loading.

### Camera & composition (back-seat POV)
A **single shared third-person camera in the back seat**, looking forward. Both players see the same view: two front-seat occupants, the windshield ahead, and a side window on each side. (Note: this is third-person "a portrait of the two of us," not first-person — chosen deliberately to maximize the sense of *co-presence*, which is the thing the prototype is validating.)

Layer stack, back to front:
1. **Sky / gradient** — full-bleed, driven by mood palette (§ below). Procedural gradient, cheapest.
2. **Far scenery** — distant silhouette layer (mountains/horizon), slow drift.
3. **Mid scenery** — hills/treelines, faster.
4. **Near scenery** — roadside objects, fastest; these are the call-and-response "things" you point at.
5. **Cabin frame** — the car interior foreground: roof line, seat-backs, side-window edges, door panels. One mostly-static sprite with transparent cutouts (windshield + two side windows) through which the scenery layers show. Optional tiny idle motion (a swaying mirror charm).
6. **Occupants** — two front-seat figures rendered as **anonymous glyph silhouettes**, tinted to each rider's glyph color (▲ amber, ● teal). No faces, no avatar customization. Gestures animate the matching silhouette (a raised-hand wave, a head turn). This *is* the §6 identity, embodied — and it sidesteps expensive character art entirely.
7. **FX layer** — particles for fireworks (§8), weather (rain/snow), light bloom.
8. **UI layer** — glovebox, prompts/billboards, controls, anchored to the cabin frame.

### Motion model (how it feels like you're moving, cheaply)
Forward motion through the windshield is the *hard* case to fake. **Solution: lean on the side windows.** Scenery streaming laterally through the two side windows is ordinary horizontal parallax (the easy, cheap case the asset packs are built for) and the eye reads it as "we're moving" very convincingly. Keep the **windshield simple**: a looping road texture scrolling toward a vanishing point + slow horizon drift. **No pseudo-3D / Mode-7 required for the prototype.** (True forward-perspective road = `// DEFERRED:`.)

### Implementation notes
- Each scrolling scenery layer = a PixiJS **`TilingSprite`** (loops infinitely for free); advance each layer's `tilePosition.x` per frame at a speed proportional to depth. This is the whole parallax system.
- The cabin frame is a static sprite on top with alpha cutouts; scenery `TilingSprite`s are masked to the window regions so they only show *through* the glass.
- Occupant silhouettes are simple sprites/SVG over the cabin; swap to a "wave" frame on gesture.
- **Mood → palette mapping (visuals as co-creation):** the §5 mood-seed drives a global PixiJS `ColorMatrixFilter` / gradient + weather particles — `golden-hour` (warm tint, long light), `rainy` (grey, rain particles, droplets on the glass), `midnight` (deep blue, stars, moon), `wide-open` (bright, high horizon). This makes the *atmosphere* part of what the two riders made together, not just the song — and it's a free parameter swap, not new art. It also unifies mismatched bought assets under one grade.

### Asset sourcing — checklist before buying anything
For each scenery asset, require: **(1) separated transparent layers** (PNG layers or layered PSD — a single flat image is nearly useless); **(2) horizontally seamless / loopable** (no seam on repeat); **(3) works in portrait** (most packs are wide/landscape — confirm it composes upright behind a window); **(4) commercial license** confirmed, with a per-asset license record kept; **(5) style consistency** with the cabin frame (or unify via the global color-grade).

### Where to get assets
- **Scenery (easy):** CraftPix.net (layered parallax nature backgrounds, free + cheap premium, clear commercial licenses) · itch.io (filter "parallax"; e.g. ansimuz — free, commercial, layered, loopable, PSD) · Kenney.nl (CC0, fully free, consistent flat style — ideal for prototyping) · GameDev Market (Pro Licence = commercial, unlimited projects) · OpenGameArt.org (free; licenses vary — prefer CC0/CC-BY).
- **Cabin interior + occupants (hard — back-seat POV is a rare, specific composition; most "car" assets are top-down/side racing views and are useless here):** cheapest path is to **AI-generate** the cabin frame + seat-backs in one locked style and make the **silhouette occupants in SVG/code** (near-trivial, on-theme); or **commission a single cabin frame** cheaply (Fiverr / itch.io artist boards / r/gameDevClassifieds). Stock-vector sites (Freepik, Vecteezy) carry "car interior" art but almost always front-driver POV — verify before relying on it.

### Deferred (post-validation)
Pseudo-3D / true-perspective forward road; richer animated characters or expressive occupants; multiple roads & scene themes; weather variety beyond the mood set; a defining hand-crafted art direction from a single commissioned artist (the highest-leverage art hire — but only after the loop earns a yes).

---

## 8. The live gesture layer (thin thread of presence)

**Design rule that governs everything here: a *positive-only grammar, in the world's vocabulary.*** Nothing in the live layer can express negativity or rejection — this is both the cozy feeling and the core safety design (cruelty is impossible to *say*, not merely moderated). Reporting is a **system action**, never an in-world expression (§12).

Build three things:

**(a) Warm reactions (reskinned — NOT emoji).** One-tap, in-world: a **wave** from the window, a **headlight flash**, a **heart that puffs from the exhaust**. Sent as a small message, rendered as a brief animation on both screens. Rate-limit (e.g. max ~1/sec) to prevent spam.

**(b) Beat-locked sound flourishes.** A tiny curated palette (e.g. tambourine, shaker, a soft chime). When a rider triggers one, **quantize it to the next beat** using Tone.js transport so it lands *on* the music and sounds intentional — never as noise over the track. Rate-limit. The receiver hears it positioned in the shared mix.

**(c) The co-launched firework finale (the synchrony peak).** As the destination/outro approaches, both riders get a "launch" control. The **PartyKit room arbitrates**: if both taps arrive within a **sync window (≈1500ms)**, trigger a **bigger "synced bloom"** firework (PixiJS particles) on both screens + a musical accent; if only one taps, still show a nice single firework (inaction is never punished). This is the emotional climax and a key thing to measure (`firework_synced` true/false).

---

## 9. Synchronization model

- The **PartyKit room holds the authoritative clock.** On ride start it broadcasts `rideStartAt` (server timestamp) + the audio URL. Clients schedule playback against an offset-corrected clock (do a tiny round-trip offset estimate on join).
- Music is a **single generated file** played locally by each client, started at the agreed timestamp — so we sync *playback position*, not stream audio between clients (cheap, robust). Periodic drift correction: room broadcasts current expected position every ~10s; clients nudge if drift > ~250ms.
- Gestures/reactions are **relayed via the room** (broadcast to the other client). Latency tolerance is generous (these are flourishes); only the firework window needs server-side timing arbitration.
- Handle disconnect/reconnect (§11): if one rider drops, the other should get a gentle "your co-rider hit traffic" state and still be able to finish + save the song solo.

---

## 10. Matchmaking (validation-first)

1. **Invite-link pairing (primary for validation):** `?/room/:code`. Two recruited testers open the same link → same room. This is how you'll run controlled test sessions — prioritize it.
2. **Random FIFO queue (secondary):** a lobby that pairs the next two waiting users. Keep dead-simple; no skill/region matching.
3. If no second player within ~30s in random mode, show a calm waiting state (and, `// DEFERRED:`, a future solo/bot ride). Do **not** build bots now.

---

## 11. Mobile / browser gotchas (do not skip)

- **iOS Safari audio unlock & keepalive (don't skimp here — it's the #1 silent-failure mode):**
  - `AudioContext` starts suspended; resume it (and `Tone.start()`) on the **"Get in" tap**. iOS will only let you do this inside a user-gesture handler — first tap, no exceptions.
  - **Keep the context warm through the lobby.** iOS aggressively suspends idle audio contexts during the 45–60s composition phase or if the user switches tabs. **Start the procedural bed at the *lobby* phase held at zero volume** — this both warms Tone.js nodes (so there's zero initialization stutter when the car pulls out, §1 step 4) *and* keeps the context awake as a continuous silent keepalive. Same move solves both problems.
  - **Reactive state indicator.** Subscribe to `audioContext.statechange` (not only `visibilitychange`) and render a small in-cabin **slashed-speaker affordance** whenever `state !== 'running'`. Tapping it resumes the context. This is your safety net for the edge cases keepalive doesn't catch.
- **Autoplay:** the generated track must begin from a user-gesture-initiated context; the "Get in" tap covers this.
- **Backgrounding / tab switch:** on `visibilitychange` resume the context, re-sync to room clock, and verify drift.
- **WebSocket resilience:** reconnect with backoff; rejoin room by id; restore ride state from room snapshot.
- **Low-end devices:** cap PixiJS particle counts; degrade gracefully.
- **Preload** the procedural bed samples on app boot — by the time "Get in" is tapped, everything is in memory.

---

## 12. Safety (minimal but correct for a prototype)

The architecture makes this small — **there is no voice and no free text**, so the major abuse vectors don't exist. Build only:
- **Positive-only gesture grammar** (§8) — the primary safety mechanism by design.
- **Curated inputs only** — no free-text fields anywhere.
- **One-tap report** (system action, outside the in-world vocabulary) → writes a `report` row, ends the ride, blocks re-match between those two for the session.
- **Basic rate-limiting** on gestures/sounds.
- **Reputation counter** (reports received per `user_id`) — store it; auto-suspend logic is `// DEFERRED:` but capture the data now.
- **Age gate** at entry (self-attest 18+ for the prototype) + a `// DEFERRED:` note for stronger measures. No PII stored.
- Generated music is **instrumental** (no lyrics → no lyric moderation needed for the prototype).

---

## 13. Instrumentation & success criteria (the actual point)

Capture these events (PostHog or a Supabase `events` table):

```
session_started, audio_unlocked, audio_context_state_changed (state),
paired (mode: invite|random),
composition_started, composition_completed (with recipe),
generation_requested, generation_succeeded (latency_ms), generation_failed (reason),

# Tuning-phase funnel (the highest-risk window — break it out, don't lump into ride_abandoned)
tuning_started,
tuning_heartbeat (every 5s while in tuning, includes ms_elapsed),
tuning_10s_reached, tuning_20s_reached, tuning_30s_reached,
tuning_completed (own | borrowed, ms_elapsed),
tuning_abandoned (ms_elapsed, reason: user_left | socket_closed | tab_hidden),

ride_started (music_source: own | borrowed),
track_swapped (from: borrowed, to: own, at_position_sec),
gesture_sent (type, sender_glyph),
firework_attempted, firework_synced (bool),
ride_completed | ride_abandoned (at_position_sec, reason: user_left | socket_closed),
song_named, song_saved, song_replayed,
no_song_saved (reason: borrowed_finish | generation_failed),  # see §16
rating_submitted (tokens[]), report_submitted,
survey_answer (the one question below)
```

**Two important splits to capture:** (a) `tuning_abandoned` vs `ride_abandoned` (different failure modes, different fixes); (b) within each, `user_left` vs `socket_closed` vs `tab_hidden` — *very* different diagnoses (boredom/UX vs network/server vs platform interruption). Without this granularity, "users dropped off in tuning" tells you nothing actionable.

**The one validation question** shown post-ride (single tap):
> *"Did it feel like you made that song *together*?"* — `Definitely / Sort of / Not really`

**Pre-registered success signals** (decide before testing; don't move goalposts):
- High **ride completion rate** (few abandons mid-ride).
- Majority of rides have **both** players sending ≥1 gesture (mutual engagement).
- High **`firework_synced` success rate** when both are present.
- Majority answer **"Definitely/Sort of"** on the togetherness question.
- Meaningful **song save + replay** rate (people want to keep it).

If these come back weak, the fix is the *interaction design* (§5/§8), not more features.

---

## 14. Data model (Supabase / Postgres)

```sql
-- users: anonymous, no PII
create table users (
  id uuid primary key,                 -- = supabase anon auth uid
  glyph text not null, color text not null,
  reports_received int default 0,
  created_at timestamptz default now()
);

create table rides (
  id uuid primary key,
  room_code text,
  driver_id uuid references users(id),
  passenger_id uuid references users(id),
  status text,                          -- composing|generating|riding|completed|abandoned
  recipe jsonb,                         -- the §5 recipe
  created_at timestamptz default now(),
  completed_at timestamptz
);

create table songs (
  id uuid primary key,
  ride_id uuid references rides(id),
  audio_url text not null,              -- Supabase Storage
  title text,
  recipe jsonb,                         -- for per-rider attribution
  contributor_glyphs text[],            -- ['▲','●']
  road text default 'coast',
  created_at timestamptz default now()
);

-- glovebox = join of songs to the two contributor user_ids
create table glovebox_entries (
  user_id uuid references users(id),
  song_id uuid references songs(id),
  primary key (user_id, song_id)
);

create table reports (
  id uuid primary key,
  ride_id uuid references rides(id),
  reporter_id uuid references users(id),
  created_at timestamptz default now()
);

create table events ( -- if not using PostHog
  id bigserial primary key,
  user_id uuid, ride_id uuid,
  name text not null, props jsonb,
  created_at timestamptz default now()
);
```
Apply Row Level Security so a user can only read their own Glovebox.

---

## 15. Key contracts

**PartyKit room messages (client ⇄ room):**
```ts
type ClientMsg =
  | { t: 'join'; userId: string; role?: 'driver'|'passenger' }
  | { t: 'seed'; word: string }
  | { t: 'choice'; field: string; value: string }
  | { t: 'ready' }                       // "Let's drive"
  | { t: 'gesture'; kind: 'wave'|'headlights'|'heart'|'tambourine'|'shaker'|'chime' }
  | { t: 'firework' }
  | { t: 'name'; word: string }
  | { t: 'report' };

type RoomMsg =
  | { t: 'state'; phase: 'lobby'|'generating'|'riding'|'arrival'; ... }
  | { t: 'peerChoice'; glyph: string; field: string; value: string }
  // ride can start on the pair's own track OR a borrowed one under load (§16)
  | { t: 'rideStart'; audioUrl: string; source: 'own'|'borrowed'; rideStartAt: number; bpm: number }
  | { t: 'trackReady'; audioUrl: string; bpm: number }   // swap borrowed → own, crossfade on a bar
  | { t: 'sync'; positionSec: number }
  | { t: 'peerGesture'; glyph: string; kind: string; atBeat?: number }
  | { t: 'fireworkSynced'; synced: boolean }
  | { t: 'peerLeft' };
```

**Generation endpoint (room/server → adapter):**
```ts
interface MusicGenerator {
  generate(input: { prompt: string; bpm: number; durationSec: number })
    : Promise<{ audioUrl: string; latencyMs: number }>;
}
// Primary impl: FalMiniMaxGenerator (key server-side). Swappable.
```
Flow (happy path): room receives the first composition choices → **pre-fires** `MusicGenerator.generate` (don't wait for `ready`) → on `ready`, if the track is done it broadcasts `rideStart {source:'own'}`; if not, it starts the ride on the procedural bed and emits `trackReady` when done. Under sustained load the room may instead start on a borrowed track and swap later — see §16.

---

## 16. Concurrency & scale (load behaviour)

**Verdict at the target scale:** 50 concurrent players = ~25 independent rides. The room layer, sockets, DB, and storage are all trivially fine here — this design scales to *hundreds* of concurrent rides before any of them strains. What breaks first is **not infrastructure; it's the generation API**. Specify the two soft spots below; leave the rest alone until you're an order of magnitude bigger.

### What scales for free
Each ride is an isolated room instance (PartyKit / Durable Object), so N players = N/2 independent rooms that don't contend with each other — the platform spins them up horizontally. Each client renders its own audio/visuals locally (no shared render resource). Supabase handles auth + the handful of writes per ride comfortably. **No work needed here at this scale.**

### Soft spot #1 — music generation is the real ceiling
When pairs start rides, generation calls burst toward fal.ai/MiniMax, which enforce **concurrency / rate limits**. Exceed them and calls queue *provider-side*, so generation latency stretches exactly when you're busiest. Dollar cost is negligible (25 × ~$0.035); throughput is the constraint. Mitigations, in order:

1. **Pre-generate during composition.** Fire `generate` on the first composition choices, not on `ready` (§15). The ~45–60s of composing usually covers generation, so most rides start on their *own* track with zero wait.
2. **Server-side generation queue with backpressure.** Cap in-flight calls at the provider's documented concurrency limit; queue the rest; track queue depth.
3. **Procedural bed** covers short waits (already in §3).
4. **Borrowed-track degradation (graceful overflow).** When the queue is backed up beyond what the bed should cover, **start the ride immediately on a pre-existing track** and swap to the pair's own when ready (`trackReady`, §15). Framed in-world as *"the radio's already playing — then it tunes into your station."* *(With ~2-min rides and ~20–30s MiniMax generation pre-fired during the ~45–60s composition phase, the pair's own track is almost always ready before ride start — borrowed-track should rarely trigger in practice; it remains the documented overflow path for provider rate-limit bursts.)* Rules:
   - **Source:** early on, a small **pre-generated cache** of tracks spanning the recipe space (community songs are too sparse pre-scale); once the Radio exists and you're at scale, recent community songs.
   - **Pick a near match:** borrow a track whose recipe is close to theirs (same mood-seed/tempo) so it isn't jarring and stays "in the same world."
   - **Crossfade on a bar** when their own track lands; never hard-cut.
   - **This is a last resort,** after 1–3 above — not a default.
   - **Two thresholds, not one (critical — protects keepsake integrity, not compute cost):**
     - **Generation abandon = 60s** after the API call was fired. If not returned, kill the request, log `generation_failed (reason: timeout)`, finish the ride on the borrowed track.
     - **Swap window = first ≤40% of the ride** (e.g. first ~45s of a 2-minute ride). Even if the custom track arrives *after* this point, **do not swap.** Swapping in the back half means the pair barely hears "their" song after already bonding with the borrowed one — that's not their song any more, it's a coda. Better to finish cleanly on the borrowed track.
   - **Glovebox integrity rule (the one that matters more than compute):** if a ride ends on a borrowed track (either threshold tripped), **no song is saved to either Glovebox.** Show a kind in-world message — *"the studio was busy today — your song didn't print. The road's still open."* — and emit `no_song_saved (reason: borrowed_finish)`. The Glovebox only ever contains songs the pair *actually heard themselves make.* The integrity of "this song is ours because we heard it become a song" is the whole product; never break it to salvage a ride.
   - **Instrument it:** log `ride.music_source = own | borrowed` and the swap time (or its absence). **Borrowed rides may contaminate the togetherness signal (§13) — flag/segment them when reading results.** A load hack must not quietly corrupt the experiment.
5. **Multiple providers** behind the `MusicGenerator` adapter — spread load and add headroom (also the §19 dependency hedge).

### Soft spot #2 — matchmaking is the one shared component
Everyone funnels through one coordinator to get paired. Specify it concretely: a **single matchmaking room** (its own Durable Object) holds a FIFO **waiting list**; on each new joiner it pops the head and the new arrival into a fresh ride room, then hands both clients that room id. Invite-link rides **bypass** the queue (they target a known room code). If no partner within ~30s in random mode, show the calm waiting state (§10). At 50–few-hundred waiting this single coordinator is fine; **shard by region / time-bucket** only at much larger scale (`// DEFERRED:`).

### The departure-windows trap
The "departure windows" liquidity idea (batching starts to manufacture density, v2 brief / §20) is a **thundering-herd generator** — it deliberately makes many pairs hit `generate` simultaneously, the exact burst that trips rate limits. The generation queue (above) is what reconciles the two; if you run departure windows, size the queue and cache for the expected burst.

### Where each component tops out, and the lever
| Component | Comfortable at 50 concurrent? | First lever when it strains |
|---|---|---|
| Room servers (PartyKit/DO + WebSockets) | Yes — into the hundreds of rooms | Platform auto-scales; none needed |
| Matchmaking coordinator | Yes | Shard by region/time-bucket |
| **Music generation API** | **The binding constraint** | Pre-gen → queue → cache → borrowed-track → multi-provider |
| Supabase (auth + writes) | Yes | Connection pooling (Supavisor); batch event writes |
| Audio storage/delivery | Yes | CDN in front of the Storage bucket |
| Analytics events | Yes | Batch client-side / use PostHog ingestion |

**Build implication:** the generation queue + pre-generation belong in M3, and the matchmaking coordinator in M1 — don't leave either as the one-line "simple FIFO" from §10.

---

## 17. Suggested project structure

```
/app            # React+Vite client
  /audio        # Tone.js engine, procedural bed, beat-quantized gestures
  /scene        # PixiJS scenery + fireworks
  /state        # Zustand stores
  /screens      # GetIn, Lobby/Compose, Ride, Arrival, Glovebox
  /net          # PartyKit client, clock offset, reconnection
/party          # PartyKit room server (state machine, clock, gen trigger)
/server         # serverless fn(s): music-gen adapter (holds fal.ai key)
/supabase       # schema.sql, RLS policies
/shared         # message types, recipe types, mapping fn
```

---

## 18. Build milestones (with acceptance criteria)

- **M0 — Skeleton.** Vite+React+TS app; "Get in" unlocks audio (verified on a real iPhone); Supabase anon auth issues a stable id + glyph. *Accept:* refresh keeps the same identity; AudioContext is `running` after the tap on iOS Safari.
- **M1 — Room & pairing.** PartyKit room; invite-link puts two clients in one room; roles assigned; presence shown. *Accept:* two phones on the same link see each other's glyph.
- **M2 — Lobby composition.** Seed + Driver/Passenger choices; each sees the other's choices land; both `ready` advances phase. *Accept:* the combined `recipe` is correct server-side.
- **M3 — Generation + latency mask.** Room builds prompt, calls MiniMax via fal.ai, stores audio; procedural bed plays instantly on phase `generating`, crossfades to the track on `rideStart`. *Accept:* no silent gap; generation latency logged; failure falls back to bed + retry.
- **M4 — Synced ride.** Both play the track in sync against the room clock; drift correction works; scenery scrolls. *Accept:* playback position within ~250ms across two devices.
- **M5 — Gesture layer + finale.** Warm reactions, beat-locked sounds, co-launched firework with the sync window. *Accept:* both-tap-within-window → synced bloom; sounds land on the beat.
- **M6 — Arrival + Glovebox + instrumentation.** Co-name, save song (with attribution), rating + report + the one survey question; Glovebox lists/plays saved songs; all §13 events firing. *Accept:* a full ride is saved, replayable, and every event appears in analytics.

Ship M0→M6 in order. Each milestone should be demoable on two real phones before moving on.

---

## 19. Open risks to watch during the build

1. **Generation latency feel.** If MiniMax is slow/variable, the "tuning the radio" mask must hold attention. If latency hurts the feel, pre-generate during composition (kick off generation on first choices, refine on `ready`) or cache common recipes. This is the top UX risk.
2. **Mutuality is real, not theatrical.** Watch the togetherness survey + dual-gesture rate. If weak, enrich §5/§8 (more legible attribution, more call-and-response), not more features.
3. **Provider dependency.** Keep everything behind the `MusicGenerator` adapter; never hard-code fal.ai/MiniMax assumptions outside it. The music-AI provider landscape is shifting (settlements, model deprecations) — swappability is insurance.
4. **Sync edge cases** (disconnects, backgrounding, drift). Budget time for §9/§11; they're where multiplayer prototypes usually break.

---

## 20. What this deliberately leaves for after validation

If the togetherness signal is strong, layer back in (from the v2 brief, roughly in this order): the community **Radio**, **found/earned collectibles + gifting** (never bought — shop sells self-cosmetics only), **scene selection & multiple roads**, **subscription + free-ride cap**, optional **premium AI render / vocals / stems**, stronger **age & reputation** systems, and async **"ghost ride"** mode to solve liquidity. None of it matters until the core loop earns a *yes*.

---

## Changelog

| Version | Date | Change | Rationale |
|---|---|---|---|
| v3 | 2026-06-05 | Initial import of build spec | Canonical source of truth established |
| v3.1 | 2026-06-05 | Ride 6–8 min → ~2 min; MiniMax via fal.ai confirmed. | See entry. |
| v4.0 | 2026-06-06 | **Production build begins.** Spec version bumped from v3.x (MVP prototype) to v4.0. Scene engine: **PixiJS 2D → Three.js + R3F**. Back-seat POV is a real 3D camera; 4 scene themes in 3D; GLB car interior assets load natively. Audio validated and works; visual quality is now the priority. | MVP loop validated — togetherness feeling confirmed. Now building for real users. |
| v3.2 | 2026-06-06 | Art direction: **clean vector/SVG (Florence-style)**. 4 scenes, driver picks. | Superseded by v4.0 Three.js decision same day. | Ride length 6–8 min → **~2 min**; generation target `durationSec` 420 → 120; confirmed **MiniMax via fal.ai** behind the `MusicGenerator` adapter; §16 swap-window numbers rescaled; Suno noted as deferred upgrade (no official API). | Shorter ride fits MiniMax in one official single call (no looping/borrowed-track gymnastics), keeps cost ~$0.035/ride & official-provider swappability (§19), and likely improves completion + togetherness signal (§13). Decided with user. |
