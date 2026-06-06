# Roadie — Post-Validation Backlog

Items in priority order within each section. Scope and approach are decided in conversation before building — this is the planning document, not a spec.

---

## 1. Scene Rebuild (Visual Overhaul)

The current scene is procedurally generated placeholder art. Replace with a proper game-quality visual system.

### 1a. Art direction decision (discuss before building)
- **Option A — Hand-drawn / illustrated style** (e.g. Alto's Odyssey, Monument Valley): flat but expressive, warm and timeless. Works well with the co-presence theme.
- **Option B — Lo-fi / retro pixel art** (e.g. Minit, Shovel Knight): nostalgic, affordable to produce, pairs well with the AI music angle.
- **Option C — Painterly / watercolour** (e.g. Gris, Hoa): emotional, premium feel. Highest art cost.
- **Option D — Clean vector / SVG** (e.g. Florence): modern, mobile-native, easy to animate. Good compromise.

### 1b. Multiple scene themes (roads)
Currently hardcoded to `road: 'coast'`. Post-validation, unlock:
- Coast (default) — ocean horizon, cliffs, warm light
- Desert highway — long straight, heat haze, sunset palette
- Mountain pass — switchbacks, pine trees, snow peaks
- Night city — skyline glow, streetlights, rain reflections

Each scene: a set of parallax layer assets (far / mid / near) + a cabin frame variant + a mood-palette override. The TilingSprite system is already in place — drop in real assets.

### 1c. Cabin frame
Current: programmatic dark rectangles. Replace with:
- A real illustrated back-seat POV cabin frame (commissioned or AI-generated in a consistent style)
- Two seat-back silhouettes as separate SVG/sprite layers
- Optional: subtle idle animation (hanging charm, rear-view mirror)
- Back-seat POV is rare in stock art — cheapest path is Fiverr commission or AI-generation in a locked style

### 1d. Occupant silhouettes
Current: Unicode glyph characters. Replace with:
- Simple SVG head/shoulder silhouettes, tinted to glyph color
- Gesture animations: a "wave" arm frame, head turn for reactions
- No faces, no customisation — identity stays anonymous (§6)

### 1e. Asset sourcing checklist (§7)
Before buying any scenery asset: (1) separated transparent layers, (2) horizontally seamless/loopable, (3) works in portrait, (4) commercial license confirmed, (5) style consistent with cabin frame.

Sources: CraftPix.net · itch.io (ansimuz) · Kenney.nl (CC0) · GameDev Market · OpenGameArt.

---

## 2. Lounge (Pre-Ride Landing Experience)

The current flow goes straight to Get In. A production app needs:

### 2a. Landing / Lounge page
- The "lobby" before pairing — sets tone, builds anticipation
- Shows recent community songs playing (the Radio, §20) or a teaser loop
- Clear CTA: "Get in" (invite-link) or "Find a co-rider" (random queue)
- Could show live ride count ("3 rides happening now")

### 2b. Random queue (FIFO matchmaking)
Currently only invite-link pairing works. Build the random FIFO queue (§10):
- Single matchmaking Durable Object holds a waiting list
- New joiner → pop head → pair into a fresh ride room
- 30s timeout → calm waiting state ("finding you a co-rider…")
- Invite-link rides bypass the queue entirely

### 2c. Scene / road selection
Currently one road. Post-validation:
- Show a selection screen before the ride ("pick your road")
- 2–4 scene options with preview thumbnails
- Both riders see the same selection or driver picks (decide in design)

---

## 3. Production Infrastructure

### 3a. Deploy PartyKit to Cloudflare
- `partykit deploy` → live Cloudflare Workers instance
- FAL_KEY as a Cloudflare secret (`wrangler secret put FAL_KEY`)
- Custom domain for the party server

### 3b. Deploy frontend to Cloudflare Pages or Vercel
- Connect GitHub repo → auto-deploy on push to main
- Environment variables set in dashboard

### 3c. Real anonymous auth persistence
- Currently: Supabase anon auth on device. Test cross-device persistence.
- Deferred hook for account upgrade (link email) — `// DEFERRED:` already in code

### 3d. Audio quality
- MiniMax Music quality is acceptable for validation; explore alternatives post-signal:
  - Suno (if official API launches)
  - Stable Audio 3 (up to 6min, higher cost)
  - Self-hosted MusicGen (full control, zero per-track cost at scale)
- All swappable behind the `MusicGenerator` adapter (§15)

---

## 4. Post-Validation Features (§20 order)

Only build these after the togetherness signal is strong.

- **Community Radio** — browse/play songs made by others
- **Collectibles + gifting** — found/earned, never bought; shop sells self-cosmetics only
- **Subscription + free-ride cap**
- **Stronger age + reputation systems**
- **Async "ghost ride"** — ride along to a song made by a past pair (liquidity solution)
- **Vocals + lyric mode** — requires lyric moderation layer
- **Multiple departure windows** — manufacture density at scale

---

## 5. Open Technical Debt

- Bundle size: Tone.js + PixiJS = ~800kB. Code-split both behind dynamic imports.
- iOS audio context: verify keepalive works across full 2-min ride on real device.
- Drift correction: verify ±250ms across two real phones (not just local harness).
- Borrowed-track degradation path: pre-generated cache for overflow (§16).
- `npm audit` — 5 vulnerabilities (1 critical) in transitive deps. Review before production.
- Supabase RLS: currently tested via schema only. Run a full auth flow test.
