# CLAUDE.md

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

---

**These guidelines are working if:** fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.

## 5. Context Before Code

**Reconstruct, don't assume. The codebase is the truth, not your memory.**

At the start of any session — or any time you feel uncertain — verify state before acting:

- Read `masterRule.md` end to end. Every product, architectural, and threshold decision lives there. It's the canonical source of truth and supersedes anything you "remember."
- Check the most recent Session Log entry (§7). It tells you where the last session ended.
- Run `npm test`. If foundation tests fail, stop and fix that before doing anything else.
- Check `git status` and `git log --oneline | head -5`. If they don't match what the Session Log claims was committed, surface the discrepancy.
- If a previous session "completed" creating a file, but `ls` doesn't find it on disk, the work was lost in transit. Say so explicitly. Don't assume the file exists because it was discussed.

If you can't reconstruct context from the files above, ask. Don't guess.

## 6. Decision Discipline

**Decisions made in conversation that aren't written down don't exist.**

When you and the user make an architectural, threshold, taxonomy, or schema decision:
- Write it to the relevant section of `masterRule.md` in the same change as the code that implements it.
- Add a Changelog entry to `masterRule.md` §12 with date and rationale.
- Bump the document version per the rules at the top of `masterRule.md`.

Decisions deferred for later go into masterRule.md's open-items section if it exists, otherwise into the Session Log (§7). Never into thin air.

The test: if a future session reads only the files in the repo, can it reconstruct every decision we've made? If no, the discipline is broken.

## 7. Session Log

**One entry per working session, written before stopping.**

Maintain a reverse-chronological log of session entries below. Each entry:
- Date and a short title
- Completed: files created/modified, decisions captured, tests added
- In flight: started but not finished
- Next: the concrete task for the next session

Update this at the *end* of every session. If a session ends without an entry, the next session is going to have a harder time picking up.

### Session Log

<!-- Most recent at the top. Append new entries above this line. -->

#### 2026-06-10 — Low-poly art direction: PlayCanvas scene rebuilt + screenshot-verified ✅
- **Completed:** masterRule bumped to v4.4 — committed flat-shaded low-poly art direction, fully procedural (no GLBs in player path). `PlayCanvasRideScene.tsx` rebuilt: gradient sky dome (vertex-colored custom mesh), per-theme sun/moon disc with tuned additive glow + halo, stars, drifting clouds, faceted vertex-colored terrain (two seamless leapfrogging tiles, per-theme height profiles incl. Big Sur cliff-to-ocean drop and alpine rock/snow bands), static far-silhouette backdrops (mesa/ridge/peaks/skyline), composed props per theme (saguaros with arms, strata mesas, Route-66 telephone poles; wind-swept cypress, guardrail+posts, ocean gradient plane, whitecaps, bobbing sailboats; tiered snow-capped pines, big peaks, boulders, snow patches; window-lit buildings, pagodas, torii gates, glowing street lamps, sidewalks), portrait-first cabin (roof band, A-pillars, mirror, low dash, occupant silhouettes). `ScenePreview` (`?scene=1`) now defaults to PlayCanvas with `engine`/`road`/`t`/`gesture`/`fw` URL params for deterministic headless screenshots. Same component props contract — `Riding.tsx` untouched.
- **Verified:** typecheck / tests 4/4 / build all green. **Visually judged via headless Chromium screenshots** (the step every earlier visual attempt skipped): all 4 themes portrait, coast landscape, wave gesture, synced firework, late-ride wrap (t=87/95). Iterated 4 rounds (cockpit proportions, sun glow wash-out, palm→cypress, torus steering wheel removed).
- **In flight:** nothing.
- **Next:** user visual review on a real phone (`?scene=1` or a full two-phone ride). Candidate follow-ups: mood-seed tint blended into theme sky/fog (masterRule §7 mood→palette), per-destination landmark variants within a theme, draw-call batching if low-end phones struggle (~200–250 draw calls/scene).

---

#### 2026-06-09 — Real-world treasure ride pivot
- **Completed:** masterRule bumped to v4.3 with the real-world treasure ride decision and PlayCanvas scene spike: rooms get one curated destination; scenes are stylized/place-inspired, not literal Google tile street reconstructions; Google Photorealistic 3D Tiles and rough R3F car/terrain stay experimental/debug for now. Added shared destination contract + curated seed list (`shared/src/destinations.ts`), PartyKit room destination assignment, destination-aware generation prompt, Zustand destination projection, Compose/Generating/Riding/Arrival/Glovebox destination UI, Supabase `destinations` + `treasures` schema/RLS/seed data, treasure save events, destination prompt tests, switched normal rides away from rough R3F, then added PlayCanvas as the default ride renderer with Pixi fallback via `?engine=pixi`.
- **Verified:** `npm run typecheck`, `npm test`, `npm run build` all pass. Build still reports the existing Vite large-chunk warning.
- **In flight:** PlayCanvas spike is functional but not visually judged in-browser by the agent. no discovery/map UI yet; treasures are persisted/read-model-ready but not browsed by players. Google tile preview, Pixi fallback, and R3F car scene remain local experimental work.
- **Next:** user visual review of PlayCanvas ride. If direction is promising, create one polished destination scene/art kit; if not, try Godot web export spike before investing further.

---

#### 2026-06-07 — Production scene work: Three.js, terrain, characters (parked)
- **Completed:** Three.js + R3F fully wired replacing PixiJS. Cicada GLB car interior loaded with back-seat camera (pos [0.05, 1.25, 0], looking −X). Real desert terrain (`road_terrain.glb`, scale 0.01) with 2-tile looping + world-Y elevation follower (terrain adjusts under car, camera stays inside). Cruise speed 4 units/sec. `?scene=1` preview shortcut (no party server, live road/gesture/colour controls). `?inspect=1` updated with live camera coords + terrain Y slider. masterRule bumped to v4.0 (production). MOCK_MUSIC flag. 4 procedural 3D scene themes (desert/coast/mountain/city).
- **Parked:** Character silhouettes — programmatic blobs look bad; real GLB files (psxprop_male + russian_girl_animated) are in wrong pose/orientation for front seats. Need proper seated-pose GLBs. Revisit when right assets are sourced.
- **Next options:** Scene environment quality (sky, lighting, atmosphere per mood); Lounge/landing page; camera free-look (Tier 1 from backlog); other road terrain assets for coast/mountain/city.

---

#### 2026-06-06 — Production begins: Three.js migration decision
- **Completed:** masterRule.md bumped to v4.0 (Production). Scene engine decision: PixiJS 2D → Three.js + @react-three/fiber. Back-seat POV becomes a real 3D camera inside a GLB car interior. 4 scene themes stay but built in 3D. MOCK_MUSIC flag added (skip fal.ai charges during visual testing: `npm run dev:party:mock`). Forward-perspective road with animated vanishing-point dashes added to current PixiJS scene (interim). All docs updated (masterRule, BACKLOG, session log).
- **In flight:** Three.js migration (PixiJS removed, R3F scene component replacing SceneCanvas).
- **Next:** Install three + @react-three/fiber + @react-three/drei. Build R3F scene: back-seat camera, procedural 3D road + scenery for each theme, GLB loader slot for car interior asset.

---

#### 2026-06-05 — M6: arrival + glovebox + §13 instrumentation ✅ MVP COMPLETE
- **Completed:** `supabase/schema.sql` (§14 full schema — users/rides/songs/glovebox_entries/reports/events + RLS); `lib/analytics.ts` (best-effort `track()` → Supabase events); `Arrival.tsx` (each rider submits a word, song titled + saved with §5 recipe attribution); `PostRide.tsx` (§13 validation question "Definitely/Sort of/Not really", positive token rating, report path, events fired); `Glovebox.tsx` (list + play saved songs, `song_replayed` event); `RideScreen.tsx`: full §13 tuning-phase funnel (`tuning_started`, `tuning_Xs_reached`, `tuning_completed`) + `paired`, `ride_started`, `ride_completed` + arrival phase routing + post-ride flow (arrival → post-ride → glovebox). Party server: `arrival` phase after 120s, `nameWord` relay. typecheck clean / tests 2/2 / build green. Merged to `main`, pushed.
- **In flight:** nothing.
- **Next:** set up Supabase project + add keys to `app/.env.local`; run the schema SQL; test a full two-phone session with real generation (`FAL_KEY` in `party/.dev.vars`); evaluate against §13 pre-registered success signals.

---

#### 2026-06-05 — M5: gesture layer + firework finale
- **Completed:** Server gesture rate-limit (1/s per rider), `peerGesture` relay to peer only; firework 1500ms sync window — both tap → `fireworkSynced{true}` to both, timeout → `fireworkSynced{false}` to tapper only (§8c). `audio/gestures.ts`: beat-locked tambourine/shaker/chime via `Tone.Transport.nextSubdivision('4n')`; `playFireworkAccent()` polyphonic chord sting. `player.ts`: starts Tone Transport at correct BPM when track is scheduled. `SceneCanvas`: floating gesture symbols above occupants (1.5s fade), PixiJS particle firework burst (20 single / 60 synced bloom). `Riding.tsx`: 6-button gesture row (3 warm + 3 beat-sound), firework button at 80% of ride, client-side rate limit, own/peer gesture state. Also: bug fixes — Compose "Let's drive" shows what's still missing + button visually inactive until all chosen; Riding `h-screen` fix; "new ride" escape link; SceneCanvas explicit-dims init. Verified live: 10/10 — relay, rate-limit, synced bloom, single-tap isolation. Merged to `main`, pushed.
- **In flight:** nothing. **Next:** M6 — arrival + glovebox + instrumentation: co-name the song, save with attribution, rating + report + survey question, Glovebox list/playback, all §13 events firing.

---

#### 2026-06-05 — M4: synced ride + PixiJS scene
- **Completed:** ping/pong clock offset (§9) — server returns `pong {serverTime}` immediately, client averages RTT-corrected offset across 3 pings, stored in `useRoom.clockOffset`; server broadcasts `sync {positionSec}` every 10s during riding; client drift correction in `Riding.tsx` — nudges `playbackRate` ±5% if |drift|>250ms; `audio/player.ts` uses `clockOffset` to schedule track at the right local time; `net/clock.ts` for RTT math. PixiJS v8 scene: `scene/palette.ts` (6 mood palettes, blended from both seeds §7), `scene/SceneCanvas.tsx` (3-layer double-buffer parallax, cabin frame overlay with windshield cutout + pillar darkening, occupant glyph silhouettes, clock-synced scroll). `Riding.tsx`: full screen scene + progress bar + mood attribution HUD. `RideScreen.tsx`: pings on connect. Verified live: 9/9 — pong format correct, sync fires on schedule, positionSec accurate to 0.00s error. Merged to `main`, pushed.
- **In flight:** nothing. **Next:** M5 — gesture layer + firework finale: warm reactions (wave/headlights/heart), beat-locked sounds (Tone.js quantised to next beat), co-launched firework with 1500ms sync window.

---

#### 2026-06-05 — M3: generation + latency mask
- **Completed:** `MusicGenerator` interface + `FalMiniMaxGenerator` (fal.ai queue API, 60s timeout §16) + `MockMusicGenerator` (local dev, no credits); room server fires `generate()` async on `advanceToGenerating`, broadcasts `rideStart` on success (phase→`riding`) and `generationFailed` on failure; `generationFailed` added to `RoomMsg`; `useRoom` handles `rideStart`/`generationFailed`; `audio/bed.ts` (drone+noise pad, silent during compose for iOS keepalive §11, fades in at generating); `audio/player.ts` (fetch+decode+schedule+3s crossfade); `Generating` screen ("tuning" animated UI); `Riding` placeholder (M4); `RideScreen` crossfade useEffect + generation-failed screen. Verified live: 11/11 — both clients receive `rideStart` with audioUrl+bpm+rideStartAt, phase=riding, same values across both clients, no userId leak. Merged to `main`, pushed.
- **In flight:** nothing. **Next:** M4 — synced ride: PixiJS scenery, server-authoritative clock sync, drift correction (±250ms). Accept: playback position within ~250ms across two devices.

---

#### 2026-06-05 — M2: lobby composition
- **Completed:** §5 recipe types + `buildPrompt()` + option constants in `/shared`; room server handles `seed`/`choice`/`ready`, validates field-to-role, broadcasts `peerChoice` to peer, advances to `generating` when both ready with all choices; `useRoom` gains `peerChoices`/`seeded`/`readyRoles`/`recipe`/`send`; `RideScreen` (connection manager, persists across phase transitions); `Compose` screen (mood-word grid, driver/passenger choice panels, live peer-choice display, Let's drive button); `Lobby` simplified to display-only. Verified live: 13/13 assertions — recipe correct, phase transitions, no userId leak (§6). Merged to `main`, pushed.
- **In flight:** nothing.
- **Next:** M3 — generation + latency mask. fal.ai MiniMax call in the room, procedural ambient bed, crossfade to generated track on `rideStart`.

---

#### 2026-06-05 — M1: room & pairing
- **Completed:** `/party` PartyKit room (v0.0.115) — join, server-authoritative role assignment (first in = driver), presence broadcast, disconnect handling; §15 `ClientMsg`/`RoomMsg` types in `/shared`; `PartySocket` client wrapper + `useRoom` store (read-only projection of room state, §3); invite-link room codes (`?room=`); `Lobby` presence screen + identity-gated routing. Two-client harness test: 8/8 assertions — both see 2 riders, correct roles, each other's glyph, `full=true`, no `userId` leak (§6). Merged to `main`, pushed. Remote URL corrected to `github.com/merid-berhe/roadie.git`.
- **In flight:** nothing.
- **Next:** M2 — lobby composition.

---

#### 2026-06-05 — M0: skeleton
- **Completed:** npm-workspace monorepo (`/shared`, `/app`); `@roadie/shared` identity (glyph palette + stable `deriveIdentity`); Vite+React+TS+Tailwind v4+Vitest; "Get in" → Tone audio unlock + idle engine hum + `statechange` slashed-speaker indicator (§11); Supabase anon auth + best-effort `users` upsert with local-UUID fallback; 18+ self-attest gate. `npm test` (2/2) / `typecheck` / `build` all green; dev server serves on LAN (`host: true`). Committed to `main`.
- **Awaiting manual check (user):** AudioContext `running` after tap on real iPhone/Safari (idle hum audible); identity stable across refresh.
- **Next:** M1 — room & pairing.

---

#### 2026-06-05 — Spec import, evaluation, architecture decisions
- **Completed:** Build Spec v3 imported as `masterRule.md`; `CLAUDE.md` operating guide created. Verified "check at build time" dependencies: PartyKit alive (Cloudflare-owned, DO-backed) ✅; MiniMax duration cap ~60–90s/call discovered ⚠️ — ride shortened to ~2 min (see decision below).
- **Decisions (recorded in masterRule.md v3.1):** Ride ~2 min on **MiniMax via fal.ai** behind `MusicGenerator` adapter. Suno evaluated — best quality but no official public API (resellers only → vendor-fragility §19), kept as deferred upgrade. npm workspaces instead of pnpm (corepack needs sudo). Analytics → Supabase `events` table (PostHog deferred). Generation call folded into PartyKit room. Stray empty `roadie` file removed; CLAUDE.md §5 health check fixed from `python -m pytest` → `npm test`.
- **In flight:** nothing.
- **Next:** M0 — skeleton.
