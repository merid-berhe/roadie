# Roadie

Two strangers compose a short instrumental together, then ride along to it. Mobile-first web. **MVP validation prototype.**

- **Spec / single source of truth:** [`masterRule.md`](./masterRule.md) — change scope/architecture here.
- **Operating rules:** [`CLAUDE.md`](./CLAUDE.md)

## Run it

```bash
npm install
npm run dev        # http://localhost:5173  (also prints a Network URL for your phone)
```

Other scripts: `npm test` · `npm run typecheck` · `npm run build`

> Test "Get in" on a **real iPhone** (Safari), not just desktop — iOS audio unlock is the #1 silent-failure mode (§11). Open the printed Network URL on a phone on the same Wi-Fi.

## Supabase (optional for M0)

M0 runs **without** keys — it falls back to a local UUID identity. To enable real anonymous auth + persistence, copy `.env.example` to `app/.env.local`:

```
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

## Layout

```
/shared   contract spine — identity now; §15 message types + §5 recipe next
/app      React + Vite + TS SPA — Tone.js audio, Zustand state, Tailwind v4
```

`/party` (PartyKit room) arrives in M1.

## Status

**M0 — Skeleton: ✅** "Get in" unlocks the audio context (with an audible idle hum), and an anonymous glyph identity persists across refresh.
