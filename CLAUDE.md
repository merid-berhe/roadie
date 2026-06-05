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

<!-- Most recent at the top. Append new entries above the marker. -->

#### 2026-06-05 — Spec import + initial evaluation/architecture
- **Completed:** Imported Build Spec v3 as `masterRule.md` (canonical) and created `CLAUDE.md` operating guide. Verified the two "check at build time" dependencies: PartyKit is alive (Cloudflare-owned, Durable-Object-backed; `partyserver` is the native fallback) — no change needed. Generation API verified — see open decision below.
- **Architecture decisions taken (defaults, simplicity bar):** pnpm workspaces monorepo per §17; `/shared` holds §15 message types + §5 recipe types + `buildPrompt()`; generation call folded into the PartyKit room (fal key as Cloudflare secret) — dropping a standalone `/server`; analytics via Supabase `events` table (PostHog deferred); Vitest as test runner.
- **RESOLVED DECISION (recorded in masterRule.md v3.1):** Ride shortened to **~2 min** on **MiniMax via fal.ai**, behind the `MusicGenerator` adapter. This collapses the duration problem into one official single-call generation (no looping/borrowed-track gymnastics). Suno was evaluated — best quality/length but **no official public API** (resellers only → vendor-fragility), so it's kept as the deferred quality upgrade behind the adapter.
- **Flagged (still open):** CLAUDE.md §5 references `python -m pytest tests/unit/` — wrong for an all-TS repo; proposed fix to `pnpm test` (Vitest), awaiting confirmation. Stray empty `roadie` file at repo root (not created by us) — flagged, not deleted.
- **Tooling deviation (2026-06-05):** Using **npm workspaces**, not pnpm — corepack can't symlink pnpm into `/usr/local/bin` without sudo in this env, and npm 11 is already present and sufficient. masterRule.md unaffected (package manager isn't a product/architecture decision). Stray empty `roadie` file removed; CLAUDE.md §5 health check fixed to `npm test`.
- **M0 DONE (build-verified):** npm-workspace monorepo (`/shared`, `/app`); `@roadie/shared` identity (glyph palette + stable `deriveIdentity`); Vite+React+TS+Tailwind v4+Vitest app; "Get in" → Tone audio unlock + idle hum + statechange slashed-speaker indicator (`AudioIndicator`); Supabase anon auth + best-effort `users` upsert with local-UUID fallback; 18+ self-attest gate. `npm test` (2 pass) / `typecheck` / `build` all green; dev server serves on LAN. Note: Tone makes the bundle ~644kB — code-split later.
- **Awaiting manual check (user, real iPhone/Safari):** AudioContext `running` after the tap (idle hum audible); identity stable across refresh.
- **Next:** M1 — PartyKit room + invite-link pairing; add `/party` workspace; lift §15 message types into `/shared`; accept: two phones on one link see each other's glyph.
