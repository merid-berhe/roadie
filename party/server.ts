import type * as Party from 'partykit/server';
import type { ClientMsg, DanceMove, Destination, Phase, Rider, Role, RoomMsg } from '@roadie/shared';
import {
  buildPrompt,
  CHARACTER_IDS,
  pickDestinationForRoom,
  PROMPT_MAX_CHARS,
  PROMPT_MAX_TRIES,
  type Recipe,
} from '@roadie/shared';
import { FalMiniMaxGenerator, MockMusicGenerator, type MusicGenerator, type MusicGeneratorInput } from './music';
import { FalLlmGate, MockPromptGate, type PromptGate } from './gate';

type Participant = {
  userId: string; // server-side only — never sent to peer (§6)
  role: Role;
  glyph: string;
  color: string;
  character: string; // v5.4 — dealt at join, distinct per rider
};

const DANCE_SYNC_WINDOW_MS = 1500;

export default class RideRoom implements Party.Server {
  private participants = new Map<string, Participant>();
  private phase: Phase = 'lobby';

  // Composition (§5 v5.0 — prompt-first)
  private chosenInstruments = new Map<string, string>();
  private prompts = new Map<Role, { display: string; music: string }>();
  private promptCounts = new Map<string, number>();
  private gateInFlight = 0;
  private vocalsVotes = new Map<Role, boolean>();
  private readyConnIds = new Set<string>();
  private generationInput: ReturnType<typeof buildPrompt> | null = null;
  private readonly destination: Destination;
  private readonly gate: PromptGate;

  // Generation (M3)
  private audioUrl: string | null = null;
  private rideStartAt: number | null = null;
  private lyricsText: string | null = null; // v5.2 — required by MiniMax for vocal rides
  private trackDurationSec: number | null = null; // v5.8 — client-measured real length
  private arrivalTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly generator: MusicGenerator;

  // Clock sync (M4) — §9
  private syncTimer: ReturnType<typeof setInterval> | null = null;

  // Gestures (M5) — §8
  private lastGestureMs = new Map<string, number>(); // connId → last gesture timestamp
  private fireworkWindow: { connId: string; at: number } | null = null;
  private fireworkTimer: ReturnType<typeof setTimeout> | null = null;

  // The Meeting (§8d) — dance-off during generation
  private lastDance = new Map<string, { move: DanceMove; at: number }>();
  private lastDanceSentMs = new Map<string, number>();

  constructor(readonly room: Party.Room) {
    const falKey   = room.env['FAL_KEY']     as string | undefined;
    const mockMode = room.env['MOCK_MUSIC']  as string | undefined;
    const useMock  = mockMode === 'true' || !falKey;
    this.destination = pickDestinationForRoom(room.id);
    this.generator = useMock ? new MockMusicGenerator() : new FalMiniMaxGenerator(falKey!);
    this.gate = useMock ? new MockPromptGate() : new FalLlmGate(falKey!);
    console.log(`[room] generator=${useMock ? 'mock (no charges)' : 'fal.ai MiniMax'} destination=${this.destination.id}`);
  }

  onMessage(raw: string, sender: Party.Connection): void {
    let msg: ClientMsg;
    try { msg = JSON.parse(raw) as ClientMsg; } catch { return; }
    switch (msg.t) {
      case 'join':    return this.handleJoin(msg, sender);
      case 'instrument': return this.handleInstrument(msg, sender);
      case 'prompt':  return this.handlePrompt(msg, sender);
      case 'vocals':  return this.handleVocals(msg, sender);
      case 'ready':   return this.handleReady(sender);
      case 'ping':    return this.handlePing(msg, sender);
      case 'trackDuration': return this.handleTrackDuration(msg);
      case 'dance':   return this.handleDance(msg, sender);
      case 'gesture': return this.handleGesture(msg, sender);
      case 'firework':return this.handleFirework(sender);
      case 'name':    return this.handleName(msg, sender);
      case 'road':    return this.handleRoad(msg, sender);
    }
  }

  onClose(conn: Party.Connection): void {
    if (this.participants.delete(conn.id)) {
      this.chosenInstruments.delete(conn.id);
      this.readyConnIds.delete(conn.id);
      this.lastDance.delete(conn.id);
      if (this.participants.size === 0 && this.syncTimer) {
        clearInterval(this.syncTimer);
        this.syncTimer = null;
      }
      this.broadcastState();
    }
  }

  // --- join ---

  private handleJoin(msg: Extract<ClientMsg, { t: 'join' }>, sender: Party.Connection): void {
    const existing = this.participants.get(sender.id);
    if (existing) {
      existing.userId = msg.userId; existing.glyph = msg.glyph; existing.color = msg.color;
    } else {
      if (this.participants.size >= 2) {
        sender.send(JSON.stringify({ t: 'roomFull' } satisfies RoomMsg)); return;
      }
      const role: Role = this.roleTaken('driver') ? 'passenger' : 'driver';
      // deal a character nobody in the room is already wearing (v5.4)
      const taken = new Set([...this.participants.values()].map((p) => p.character));
      const free = CHARACTER_IDS.filter((id) => !taken.has(id));
      const character = free[Math.floor(Math.random() * free.length)] ?? CHARACTER_IDS[0];
      this.participants.set(sender.id, { userId: msg.userId, role, glyph: msg.glyph, color: msg.color, character });
    }
    // Re-send rideStart to a reconnecting client if ride is already underway (§9)
    if (this.phase === 'riding' && this.audioUrl && this.rideStartAt) {
      sender.send(JSON.stringify({
        t: 'rideStart', audioUrl: this.audioUrl, source: 'own',
        rideStartAt: this.rideStartAt, bpm: this.generationInput!.bpm,
      } satisfies RoomMsg));
    }
    this.broadcastState();
  }

  // --- composition (§5 v5.0) ---

  private handleInstrument(msg: Extract<ClientMsg, { t: 'instrument' }>, sender: Party.Connection): void {
    const p = this.participants.get(sender.id);
    if (!p || this.phase !== 'lobby') return;
    this.chosenInstruments.set(sender.id, msg.name);
    this.broadcastToPeer(sender.id, { t: 'peerChoice', glyph: p.glyph, field: 'instrument', value: msg.name });
    this.broadcastState();
  }

  // gate + relay free text; the peer sees the gated display text, the music API
  // gets the artist-name-swapped version — raw text is never persisted
  private handlePrompt(msg: Extract<ClientMsg, { t: 'prompt' }>, sender: Party.Connection): void {
    const p = this.participants.get(sender.id);
    if (!p || this.phase !== 'lobby') return;
    const text = msg.text.trim().slice(0, PROMPT_MAX_CHARS);
    if (!text) return;
    const count = this.promptCounts.get(sender.id) ?? 0;
    if (count >= PROMPT_MAX_TRIES) return; // bounds LLM spend per rider
    this.promptCounts.set(sender.id, count + 1);

    this.gateInFlight++;
    this.gate
      .check(text)
      .then((res) => {
        this.gateInFlight--;
        if (this.phase !== 'lobby') return; // generation already fired — too late
        if (!res.ok || !res.display || !res.music) {
          this.room.getConnection(sender.id)?.send(
            JSON.stringify({ t: 'promptRejected' } satisfies RoomMsg),
          );
          return;
        }
        this.prompts.set(p.role, { display: res.display, music: res.music });
        const card: RoomMsg = { t: 'promptCard', role: p.role, glyph: p.glyph, display: res.display };
        for (const connId of this.participants.keys()) {
          this.room.getConnection(connId)?.send(JSON.stringify(card));
        }
      })
      .catch((err: unknown) => {
        this.gateInFlight--;
        console.error('[room] prompt_gate_failed:', err);
        this.room.getConnection(sender.id)?.send(
          JSON.stringify({ t: 'promptRejected' } satisfies RoomMsg),
        );
      });
  }

  private handleVocals(msg: Extract<ClientMsg, { t: 'vocals' }>, sender: Party.Connection): void {
    const p = this.participants.get(sender.id);
    if (!p || this.phase !== 'lobby') return;
    this.vocalsVotes.set(p.role, msg.on);
    this.broadcastState();
  }

  private handleReady(sender: Party.Connection): void {
    if (!this.chosenInstruments.has(sender.id) || this.phase !== 'lobby') return;
    this.readyConnIds.add(sender.id);
    this.broadcastState();
    if (this.readyConnIds.size === 2 && this.participants.size === 2) {
      const allPicked = [...this.participants.keys()].every((id) => this.chosenInstruments.has(id));
      if (allPicked) this.fireWhenGateSettles(0);
    }
  }

  // a prompt may still be at the gate when both riders hit ready — give it a moment
  private fireWhenGateSettles(attempt: number): void {
    if (this.phase !== 'lobby') return;
    if (this.gateInFlight > 0 && attempt < 20) {
      setTimeout(() => this.fireWhenGateSettles(attempt + 1), 500);
      return;
    }
    this.fireGeneration();
  }

  // --- generation (M3). No pre-fire: the wait IS the Meeting (§8d) ---

  private fireGeneration(): void {
    const driverConn = this.getConnIdForRole('driver');
    const passengerConn = this.getConnIdForRole('passenger');
    if (!driverConn || !passengerConn) return;
    const driverInstrument = this.chosenInstruments.get(driverConn);
    const passengerInstrument = this.chosenInstruments.get(passengerConn);
    if (!driverInstrument || !passengerInstrument) return;

    const vocals = this.vocalsVotes.get('driver') === true && this.vocalsVotes.get('passenger') === true;
    const opts = {
      driverInstrument,
      passengerInstrument,
      driverMusicText: this.prompts.get('driver')?.music,
      passengerMusicText: this.prompts.get('passenger')?.music,
      driverDisplayText: this.prompts.get('driver')?.display,
      passengerDisplayText: this.prompts.get('passenger')?.display,
      vocals,
    };
    // provisional input (raw join) so the Meeting label has the recipe immediately;
    // the producer pass refines it below before the music call
    this.generationInput = buildPrompt(this.destination, opts);
    this.phase = 'generating';
    this.broadcastState();

    // Fire async — room continues handling messages while this runs (§15 happy path)
    (async () => {
      // §5a producer pass: whenever any free text exists, fuse everything into
      // ONE coherent brief — the alignment layer ("every song at minimum decent")
      if (opts.driverMusicText || opts.passengerMusicText) {
        try {
          const brief = await this.gate.fuse({
            driverText: opts.driverMusicText,
            passengerText: opts.passengerMusicText,
            instruments: [driverInstrument, passengerInstrument],
            destinationFlavor: this.destination.promptFlavor,
            vocals,
          });
          if (brief && this.phase === 'generating') {
            this.generationInput = buildPrompt(this.destination, { ...opts, fusedBrief: brief });
            console.log(`[room] producer_brief="${brief.slice(0, 100)}…"`);
            this.broadcastState(); // recipe.brief shows up on the Meeting label
          }
        } catch (err) {
          console.error('[room] fuse_failed (falling back to raw join):', err);
        }
      }

      // v5.2: MiniMax vocal mode 422s without lyrics — the producer writes them.
      // If lyric-writing fails, the ride falls back to instrumental (a song
      // always generates).
      if (vocals && this.phase === 'generating') {
        try {
          const lyr = await this.gate.lyrics({
            brief: this.generationInput!.recipe.brief ?? this.generationInput!.prompt,
            destinationName: this.destination.name,
          });
          if (!lyr) throw new Error('empty lyrics');
          this.lyricsText = lyr;
          this.generationInput!.recipe.lyrics = lyr;
          console.log(`[room] lyrics_written chars=${lyr.length}`);
          this.broadcastState(); // words show on the Meeting label
        } catch (err) {
          console.error('[room] lyrics_failed — falling back to instrumental:', err);
          this.generationInput = buildPrompt(this.destination, {
            ...opts,
            fusedBrief: this.generationInput!.recipe.brief,
            vocals: false,
          });
          this.broadcastState();
        }
      }

      await this.runGeneration({ ...this.generationInput!, lyrics: this.lyricsText ?? undefined });
    })().catch((err: unknown) => console.error('[room] runGeneration unexpected error:', err));
  }

  private async runGeneration(input: MusicGeneratorInput & { vocals?: boolean }): Promise<void> {
    console.log(`[room] generation_requested vocals=${input.vocals === true} prompt="${input.prompt.slice(0, 80)}…"`);
    try {
      const result = await this.generator.generate(input);
      console.log(`[room] generation_succeeded latency_ms=${result.latencyMs}`);
      this.audioUrl = result.audioUrl;
      if (this.phase === 'generating') this.startRide();
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      console.error(`[room] generation_failed reason="${reason}"`);
      // §13: emit generation_failed; clients show "studio was busy" (§16 borrowed-track is DEFERRED)
      for (const connId of this.participants.keys()) {
        this.room.getConnection(connId)?.send(
          JSON.stringify({ t: 'generationFailed', reason } satisfies RoomMsg),
        );
      }
    }
  }

  private startRide(): void {
    if (!this.audioUrl || !this.generationInput || this.phase === 'riding') return;
    this.rideStartAt = Date.now() + 2_000; // 2s buffer for clients to load (M4: proper clock sync)
    this.phase = 'riding';

    // Broadcast rideStart first (triggers audio), then state (triggers routing)
    const rideStartMsg: RoomMsg = {
      t: 'rideStart', audioUrl: this.audioUrl, source: 'own',
      rideStartAt: this.rideStartAt, bpm: this.generationInput.bpm,
    };
    for (const connId of this.participants.keys()) {
      this.room.getConnection(connId)?.send(JSON.stringify(rideStartMsg));
    }
    this.startSyncInterval();
    this.scheduleArrival();
    this.broadcastState();
  }

  // --- the Meeting (§8d): dance-off while the song presses ---

  private handleDance(msg: Extract<ClientMsg, { t: 'dance' }>, sender: Party.Connection): void {
    const p = this.participants.get(sender.id);
    if (!p || this.phase !== 'generating') return;
    const now = Date.now();
    if (now - (this.lastDanceSentMs.get(sender.id) ?? 0) < 500) return; // rate limit
    this.lastDanceSentMs.set(sender.id, now);

    this.broadcastToPeer(sender.id, { t: 'peerDance', glyph: p.glyph, move: msg.move });

    // synced-move arbitration — same move from both riders inside the window (§8c pattern)
    const peerId = [...this.participants.keys()].find((id) => id !== sender.id);
    const peerDance = peerId ? this.lastDance.get(peerId) : undefined;
    if (peerDance && peerDance.move === msg.move && now - peerDance.at <= DANCE_SYNC_WINDOW_MS) {
      this.lastDance.delete(sender.id);
      if (peerId) this.lastDance.delete(peerId);
      for (const connId of this.participants.keys()) {
        this.room.getConnection(connId)?.send(
          JSON.stringify({ t: 'danceSynced', move: msg.move } satisfies RoomMsg),
        );
      }
    } else {
      this.lastDance.set(sender.id, { move: msg.move, at: now });
    }
  }

  // --- gestures (M5, §8) ---

  private handleGesture(msg: Extract<ClientMsg, { t: 'gesture' }>, sender: Party.Connection): void {
    const p = this.participants.get(sender.id);
    if (!p || this.phase !== 'riding') return;
    // Rate-limit: max one gesture per second per rider (§8)
    const now = Date.now();
    if (now - (this.lastGestureMs.get(sender.id) ?? 0) < 1000) return;
    this.lastGestureMs.set(sender.id, now);
    this.broadcastToPeer(sender.id, { t: 'peerGesture', glyph: p.glyph, kind: msg.kind });
  }

  private handleFirework(sender: Party.Connection): void {
    if (this.phase !== 'riding') return;
    if (!this.fireworkWindow) {
      // First tap — open the 1500ms sync window (§8c)
      this.fireworkWindow = { connId: sender.id, at: Date.now() };
      this.fireworkTimer = setTimeout(() => {
        // Only one tapped — send single firework to them (inaction is never punished)
        this.room.getConnection(this.fireworkWindow!.connId)?.send(
          JSON.stringify({ t: 'fireworkSynced', synced: false } satisfies RoomMsg),
        );
        this.fireworkWindow = null;
        this.fireworkTimer = null;
      }, 1500);
    } else {
      // Second tap within window — synced bloom to BOTH (§8c)
      if (this.fireworkTimer) clearTimeout(this.fireworkTimer);
      const firstConnId = this.fireworkWindow.connId;
      this.fireworkWindow = null;
      this.fireworkTimer = null;
      for (const connId of [firstConnId, sender.id]) {
        this.room.getConnection(connId)?.send(
          JSON.stringify({ t: 'fireworkSynced', synced: true } satisfies RoomMsg),
        );
      }
    }
  }

  // --- clock sync (M4, §9) ---

  private handlePing(msg: Extract<ClientMsg, { t: 'ping' }>, sender: Party.Connection): void {
    sender.send(JSON.stringify({ t: 'pong', sentAt: msg.sentAt, serverTime: Date.now() } satisfies RoomMsg));
  }

  private scheduleArrival(): void {
    // provisional 120s; re-timed when a client reports the track's real length (v5.8)
    this.scheduleArrivalIn(120_000);
  }

  private scheduleArrivalIn(ms: number): void {
    if (this.arrivalTimer) clearTimeout(this.arrivalTimer);
    this.arrivalTimer = setTimeout(() => {
      if (this.phase !== 'riding') return;
      this.phase = 'arrival';
      if (this.syncTimer) { clearInterval(this.syncTimer); this.syncTimer = null; }
      this.broadcastState();
    }, Math.max(1_000, ms));
  }

  // v5.8 — the ride ends when the SONG ends: first sane client report wins,
  // arrival lands shortly after the final note (the finale plays out on top)
  private handleTrackDuration(msg: Extract<ClientMsg, { t: 'trackDuration' }>): void {
    if (this.phase !== 'riding' || !this.rideStartAt) return;
    if (this.trackDurationSec != null) return; // first report wins (same file both sides)
    const sec = Number(msg.sec);
    if (!Number.isFinite(sec) || sec < 30 || sec > 300) return;
    this.trackDurationSec = sec;
    console.log(`[room] track_duration_sec=${Math.round(sec)} — arrival re-timed`);
    this.broadcastAll({ t: 'trackDuration', sec });
    this.scheduleArrivalIn(this.rideStartAt + (sec + 1.5) * 1000 - Date.now());
  }

  private handleRoad(msg: Extract<ClientMsg, { t: 'road' }>, sender: Party.Connection): void {
    const p = this.participants.get(sender.id);
    if (!p || p.role !== 'driver') return; // only driver picks the road
    this.broadcastToPeer(sender.id, { t: 'peerRoad', roadId: msg.roadId });
  }

  private handleName(msg: Extract<ClientMsg, { t: 'name' }>, sender: Party.Connection): void {
    const p = this.participants.get(sender.id);
    if (!p || this.phase !== 'arrival') return;
    this.broadcastToPeer(sender.id, { t: 'nameWord', glyph: p.glyph, word: msg.word });
  }

  private startSyncInterval(): void {
    if (this.syncTimer) return;
    this.syncTimer = setInterval(() => {
      if (!this.rideStartAt) return;
      const positionSec = (Date.now() - this.rideStartAt) / 1000;
      for (const connId of this.participants.keys()) {
        this.room.getConnection(connId)?.send(JSON.stringify({ t: 'sync', positionSec } satisfies RoomMsg));
      }
    }, 10_000);
  }

  // --- helpers ---

  private getConnIdForRole(role: Role): string | null {
    for (const [connId, p] of this.participants) { if (p.role === role) return connId; }
    return null;
  }

  private roleTaken(role: Role): boolean {
    for (const p of this.participants.values()) { if (p.role === role) return true; }
    return false;
  }

  private publicRiders(): Rider[] {
    return [...this.participants.values()]
      .map((p) => ({ role: p.role, glyph: p.glyph, color: p.color, character: p.character, connected: true }))
      .sort((a) => (a.role === 'driver' ? -1 : 1));
  }

  private instrumentRoles(): Role[] {
    return [...this.chosenInstruments.keys()]
      .map((id) => this.participants.get(id)?.role)
      .filter((r): r is Role => r !== undefined);
  }

  private readyRolesArr(): Role[] {
    return [...this.readyConnIds]
      .map((id) => this.participants.get(id)?.role)
      .filter((r): r is Role => r !== undefined);
  }

  private vocalsVotesArr(): Role[] {
    return (['driver', 'passenger'] as const).filter((r) => this.vocalsVotes.get(r) === true);
  }

  private broadcastToPeer(senderConnId: string, msg: RoomMsg): void {
    for (const connId of this.participants.keys()) {
      if (connId !== senderConnId) this.room.getConnection(connId)?.send(JSON.stringify(msg));
    }
  }

  private broadcastAll(msg: RoomMsg): void {
    for (const connId of this.participants.keys()) {
      this.room.getConnection(connId)?.send(JSON.stringify(msg));
    }
  }

  private broadcastState(): void {
    const riders = this.publicRiders();
    const full = this.participants.size >= 2;
    const instruments = this.instrumentRoles();
    const readyRoles = this.readyRolesArr();
    const recipe: Recipe | undefined = this.generationInput?.recipe;
    for (const [connId, p] of this.participants) {
      const msg: RoomMsg = {
        t: 'state',
        phase: this.phase,
        you: p.role,
        riders,
        full,
        instruments,
        readyRoles,
        destination: this.destination,
        recipe,
        vocalsVotes: this.vocalsVotesArr(),
      };
      this.room.getConnection(connId)?.send(JSON.stringify(msg));
    }
  }
}
