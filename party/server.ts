import type * as Party from 'partykit/server';
import type { ClientMsg, Destination, Phase, Rider, Role, RoomMsg } from '@roadie/shared';
import {
  buildPrompt,
  buildRideSchedule,
  CATCH_WINDOW_SEC,
  DRIVER_OPTIONS,
  FLASH_WINDOW_SEC,
  PASSENGER_OPTIONS,
  pickDestinationForRoom,
  RIFF_ANSWER_SEC,
  RIFF_CALL_SEC,
  RIFF_TAPS,
  rideSeedFromRoom,
  WHISPER_MAX_CHARS,
  WHISPER_MAX_TRIES,
  type DriverChoices,
  type PassengerChoices,
  type RadioStyles,
  type Recipe,
  type RideSchedule,
} from '@roadie/shared';
import { FalMiniMaxGenerator, MockMusicGenerator, type MusicGenerator, type MusicGeneratorInput } from './music';
import { FalLlmTranslator, MockWhisperTranslator, type WhisperTranslator } from './whisper';

type Participant = {
  userId: string; // server-side only — never sent to peer (§6)
  role: Role;
  glyph: string;
  color: string;
};

export default class RideRoom implements Party.Server {
  private participants = new Map<string, Participant>();
  private phase: Phase = 'lobby';

  // Composition (M2)
  private seeds = new Map<string, string>();
  private driverChoices: Partial<DriverChoices> = {};
  private passengerChoices: Partial<PassengerChoices> = {};
  private readyConnIds = new Set<string>();
  private generationInput: ReturnType<typeof buildPrompt> | null = null;
  private readonly destination: Destination;

  // §5a "tune the radio" — minted style descriptors only, never raw text
  private radioStyles: RadioStyles = {};
  private whisperCounts = new Map<string, number>();
  private translateInFlight = 0;
  private readonly translator: WhisperTranslator;

  // Generation (M3) + pre-fire (§16: overlap generation with composing)
  private audioUrl: string | null = null;
  private rideStartAt: number | null = null;
  private prefired = false;          // generation kicked off during compose
  private radioLocked = false;       // prompt is frozen; whisper input closes
  private prefireTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly generator: MusicGenerator;

  // §5b ride performance layer — schedule shared with clients via rideSeed
  private readonly rideSeed: number;
  private readonly schedule: RideSchedule;
  private carLane = 1;
  private caughtIds = new Set<number>();
  private riffTaps = new Map<string, number>();   // `${idx}:${role}` → tap count
  private riffLanded = new Set<number>();
  private landmarkFlashes = new Map<number, Set<string>>();
  private landmarksLit = new Set<number>();

  // Clock sync (M4) — §9
  private syncTimer: ReturnType<typeof setInterval> | null = null;

  // Gestures (M5) — §8
  private lastGestureMs = new Map<string, number>(); // connId → last gesture timestamp
  private fireworkWindow: { connId: string; at: number } | null = null;
  private fireworkTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(readonly room: Party.Room) {
    const falKey   = room.env['FAL_KEY']     as string | undefined;
    const mockMode = room.env['MOCK_MUSIC']  as string | undefined;
    const useMock  = mockMode === 'true' || !falKey;
    this.destination = pickDestinationForRoom(room.id);
    this.rideSeed = rideSeedFromRoom(room.id);
    this.schedule = buildRideSchedule(this.rideSeed);
    this.generator = useMock ? new MockMusicGenerator() : new FalMiniMaxGenerator(falKey!);
    this.translator = useMock ? new MockWhisperTranslator() : new FalLlmTranslator(falKey!);
    console.log(`[room] generator=${useMock ? 'mock (no charges)' : 'fal.ai MiniMax'} destination=${this.destination.id}`);
  }

  onMessage(raw: string, sender: Party.Connection): void {
    let msg: ClientMsg;
    try { msg = JSON.parse(raw) as ClientMsg; } catch { return; }
    switch (msg.t) {
      case 'join':   return this.handleJoin(msg, sender);
      case 'seed':   return this.handleSeed(msg, sender);
      case 'choice': return this.handleChoice(msg, sender);
      case 'whisper': return this.handleWhisper(msg, sender);
      case 'ready':  return this.handleReady(sender);
      case 'ping':    return this.handlePing(msg, sender);
      case 'gesture': return this.handleGesture(msg, sender);
      case 'firework':return this.handleFirework(sender);
      case 'name':    return this.handleName(msg, sender);
      case 'road':    return this.handleRoad(msg, sender);
      case 'lane':    return this.handleLane(msg, sender);
      case 'catch':   return this.handleCatch(msg, sender);
      case 'riffTap': return this.handleRiffTap(msg, sender);
      case 'flash':   return this.handleFlash(msg, sender);
    }
  }

  onClose(conn: Party.Connection): void {
    if (this.participants.delete(conn.id)) {
      this.seeds.delete(conn.id);
      this.readyConnIds.delete(conn.id);
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
      this.participants.set(sender.id, { userId: msg.userId, role, glyph: msg.glyph, color: msg.color });
    }
    // Re-send rideStart to a reconnecting client if ride is already underway (§9)
    if (this.phase === 'riding' && this.audioUrl && this.rideStartAt) {
      sender.send(JSON.stringify({
        t: 'rideStart', audioUrl: this.audioUrl, source: 'own',
        rideStartAt: this.rideStartAt, bpm: this.generationInput!.bpm, rideSeed: this.rideSeed,
      } satisfies RoomMsg));
    }
    this.broadcastState();
  }

  // --- composition (M2) ---

  private handleSeed(msg: Extract<ClientMsg, { t: 'seed' }>, sender: Party.Connection): void {
    const p = this.participants.get(sender.id);
    if (!p || this.phase !== 'lobby') return;
    this.seeds.set(sender.id, msg.word);
    this.broadcastToPeer(sender.id, { t: 'peerChoice', glyph: p.glyph, field: 'seed', value: msg.word });
    this.broadcastState();
    this.maybeSchedulePrefire();
  }

  private handleChoice(msg: Extract<ClientMsg, { t: 'choice' }>, sender: Party.Connection): void {
    const p = this.participants.get(sender.id);
    if (!p || this.phase !== 'lobby') return;
    const driverFields = Object.keys(DRIVER_OPTIONS) as Array<keyof DriverChoices>;
    const passengerFields = Object.keys(PASSENGER_OPTIONS) as Array<keyof PassengerChoices>;
    if (p.role === 'driver' && driverFields.includes(msg.field as keyof DriverChoices)) {
      (this.driverChoices as Record<string, string>)[msg.field] = msg.value;
    } else if (p.role === 'passenger' && passengerFields.includes(msg.field as keyof PassengerChoices)) {
      (this.passengerChoices as Record<string, string>)[msg.field] = msg.value;
    } else { return; }
    this.broadcastToPeer(sender.id, { t: 'peerChoice', glyph: p.glyph, field: msg.field, value: msg.value });
    this.broadcastState();
    this.maybeSchedulePrefire();
  }

  // §5a — gate + translate free text; only the minted style card is ever shared
  private handleWhisper(msg: Extract<ClientMsg, { t: 'whisper' }>, sender: Party.Connection): void {
    const p = this.participants.get(sender.id);
    if (!p || this.phase !== 'lobby' || this.radioLocked) return;
    const text = msg.text.trim().slice(0, WHISPER_MAX_CHARS);
    if (!text) return;
    const count = this.whisperCounts.get(sender.id) ?? 0;
    if (count >= WHISPER_MAX_TRIES) return; // bounds LLM spend per rider
    this.whisperCounts.set(sender.id, count + 1);

    this.translateInFlight++;
    this.translator
      .translate(text)
      .then((res) => {
        this.translateInFlight--;
        if (this.phase !== 'lobby' || this.radioLocked) return; // prompt frozen — too late
        if (!res.ok || !res.style) {
          this.room.getConnection(sender.id)?.send(
            JSON.stringify({ t: 'whisperRejected' } satisfies RoomMsg),
          );
          return;
        }
        this.radioStyles[p.role] = res.style;
        const card: RoomMsg = { t: 'whisperCard', role: p.role, glyph: p.glyph, style: res.style };
        for (const connId of this.participants.keys()) {
          this.room.getConnection(connId)?.send(JSON.stringify(card));
        }
      })
      .catch((err: unknown) => {
        this.translateInFlight--;
        console.error('[room] whisper_translate_failed:', err);
        this.room.getConnection(sender.id)?.send(
          JSON.stringify({ t: 'whisperRejected' } satisfies RoomMsg),
        );
      });
  }

  private handleReady(sender: Party.Connection): void {
    if (!this.hasAllChoices(sender.id) || this.phase !== 'lobby') return;
    this.readyConnIds.add(sender.id);
    this.broadcastState();
    if (this.readyConnIds.size === 2 && this.participants.size === 2) {
      const allComplete = [...this.participants.keys()].every((id) => this.hasAllChoices(id));
      if (!allComplete) return;
      if (this.audioUrl) {
        // pre-fired generation already finished — straight into the ride
        this.startRide();
      } else if (this.prefired) {
        // generation is in flight from the pre-fire; show the tuning mask
        this.phase = 'generating';
        this.broadcastState();
      } else {
        this.fireGeneration();
        this.phase = 'generating';
        this.broadcastState();
      }
    }
  }

  // --- generation (M3) + pre-fire (§16) ---

  // §16: overlap generation with composing. Once both riders have completed all
  // choices (not yet "ready"), wait a short grace period for whispers, freeze
  // the prompt, and fire — by "Let's drive" the track is usually done or close.
  private maybeSchedulePrefire(): void {
    if (this.prefired || this.prefireTimer || this.phase !== 'lobby') return;
    if (this.participants.size !== 2) return;
    if (![...this.participants.keys()].every((id) => this.hasAllChoices(id))) return;
    this.prefireTimer = setTimeout(() => {
      this.prefireTimer = null;
      this.tryPrefire();
    }, 6_000);
  }

  private tryPrefire(): void {
    if (this.prefired || this.phase !== 'lobby') return;
    if (![...this.participants.keys()].every((id) => this.hasAllChoices(id))) return;
    if (this.translateInFlight > 0) {
      // a whisper is still at the gate — give it a moment, then try again
      this.prefireTimer = setTimeout(() => { this.prefireTimer = null; this.tryPrefire(); }, 1_500);
      return;
    }
    this.prefired = true;
    this.radioLocked = true;
    this.broadcastState(); // clients close the whisper input
    this.fireGeneration();
  }

  private fireGeneration(): void {
    const driverConn = this.getConnIdForRole('driver');
    const passengerConn = this.getConnIdForRole('passenger');
    if (!driverConn || !passengerConn) return;
    const seedDriver = this.seeds.get(driverConn);
    const seedPassenger = this.seeds.get(passengerConn);
    if (!seedDriver || !seedPassenger) return;

    this.prefired = true;
    this.radioLocked = true;
    this.generationInput = buildPrompt(
      seedDriver, seedPassenger,
      this.driverChoices as DriverChoices,
      this.passengerChoices as PassengerChoices,
      this.destination,
      this.radioStyles,
    );

    // Fire async — room continues handling messages while this runs (§15 happy path)
    this.runGeneration(this.generationInput).catch((err: unknown) =>
      console.error('[room] runGeneration unexpected error:', err),
    );
  }

  private async runGeneration(input: MusicGeneratorInput): Promise<void> {
    console.log(`[room] generation_requested prefired=${this.phase === 'lobby'} prompt="${input.prompt.slice(0, 60)}…"`);
    try {
      const result = await this.generator.generate(input);
      console.log(`[room] generation_succeeded latency_ms=${result.latencyMs}`);
      this.audioUrl = result.audioUrl;
      // pre-fired and still composing: hold the track until both riders are ready
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
    // §5b: the performance record lives inside the recipe from the first beat
    this.generationInput.recipe.performance = { catches: [], riffs: [], landmarks: [] };

    // Broadcast rideStart first (triggers audio), then state (triggers routing)
    const rideStartMsg: RoomMsg = {
      t: 'rideStart', audioUrl: this.audioUrl, source: 'own',
      rideStartAt: this.rideStartAt, bpm: this.generationInput.bpm, rideSeed: this.rideSeed,
    };
    for (const connId of this.participants.keys()) {
      this.room.getConnection(connId)?.send(JSON.stringify(rideStartMsg));
    }
    this.startSyncInterval();
    this.scheduleArrival();
    this.broadcastState();
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

  // --- §5b ride performance layer ---

  /** Server-authoritative ride position in seconds. */
  private positionNow(): number {
    return this.rideStartAt ? (Date.now() - this.rideStartAt) / 1000 : -1;
  }

  private broadcastAll(msg: RoomMsg): void {
    for (const connId of this.participants.keys()) {
      this.room.getConnection(connId)?.send(JSON.stringify(msg));
    }
  }

  private handleLane(msg: Extract<ClientMsg, { t: 'lane' }>, sender: Party.Connection): void {
    const p = this.participants.get(sender.id);
    if (!p || p.role !== 'driver' || this.phase !== 'riding') return;
    const lane = msg.lane === 0 ? 0 : 1;
    if (lane === this.carLane) return;
    this.carLane = lane;
    this.broadcastToPeer(sender.id, { t: 'peerLane', lane });
  }

  private handleCatch(msg: Extract<ClientMsg, { t: 'catch' }>, sender: Party.Connection): void {
    const p = this.participants.get(sender.id);
    if (!p || p.role !== 'passenger' || this.phase !== 'riding') return;
    const note = this.schedule.notes.find((n) => n.id === msg.id);
    if (!note || this.caughtIds.has(note.id)) return;
    // generous server window (client already judged tighter): catch + network slack
    if (Math.abs(this.positionNow() - note.atSec) > CATCH_WINDOW_SEC + 0.8) return;
    if (note.lane !== this.carLane) return;
    this.caughtIds.add(note.id);
    this.generationInput?.recipe.performance?.catches.push({ id: note.id, atSec: note.atSec });
    this.broadcastAll({ t: 'catchLanded', id: note.id, byGlyph: p.glyph });
  }

  private handleRiffTap(msg: Extract<ClientMsg, { t: 'riffTap' }>, sender: Party.Connection): void {
    const p = this.participants.get(sender.id);
    if (!p || this.phase !== 'riding') return;
    const riff = this.schedule.riffs.find((r) => r.idx === msg.idx);
    if (!riff || this.riffLanded.has(riff.idx)) return;
    const pos = this.positionNow();
    const isCaller = p.role === riff.caller;
    const windowEnd = riff.atSec + (isCaller ? RIFF_CALL_SEC : RIFF_ANSWER_SEC);
    if (pos < riff.atSec - 0.5 || pos > windowEnd + 0.8) return;
    const key = `${riff.idx}:${p.role}`;
    const taps = (this.riffTaps.get(key) ?? 0) + 1;
    if (taps > RIFF_TAPS) return;
    this.riffTaps.set(key, taps);
    this.broadcastToPeer(sender.id, { t: 'peerRiffTap', idx: riff.idx, role: p.role });
    const callerTaps = this.riffTaps.get(`${riff.idx}:${riff.caller}`) ?? 0;
    const answerTaps = this.riffTaps.get(`${riff.idx}:${riff.caller === 'driver' ? 'passenger' : 'driver'}`) ?? 0;
    if (callerTaps >= RIFF_TAPS && answerTaps >= RIFF_TAPS) {
      this.riffLanded.add(riff.idx);
      this.generationInput?.recipe.performance?.riffs.push(riff.idx);
      this.broadcastAll({ t: 'riffLanded', idx: riff.idx });
    }
  }

  private handleFlash(msg: Extract<ClientMsg, { t: 'flash' }>, sender: Party.Connection): void {
    const p = this.participants.get(sender.id);
    if (!p || this.phase !== 'riding') return;
    const landmark = this.schedule.landmarks.find((l) => l.idx === msg.idx);
    if (!landmark || this.landmarksLit.has(landmark.idx)) return;
    if (Math.abs(this.positionNow() - landmark.atSec) > FLASH_WINDOW_SEC + 0.8) return;
    const flashes = this.landmarkFlashes.get(landmark.idx) ?? new Set<string>();
    flashes.add(sender.id);
    this.landmarkFlashes.set(landmark.idx, flashes);
    if (flashes.size >= 2) {
      this.landmarksLit.add(landmark.idx);
      this.generationInput?.recipe.performance?.landmarks.push(landmark.idx);
      this.broadcastAll({ t: 'landmarkLit', idx: landmark.idx });
    }
  }

  // --- clock sync (M4, §9) ---

  private handlePing(msg: Extract<ClientMsg, { t: 'ping' }>, sender: Party.Connection): void {
    sender.send(JSON.stringify({ t: 'pong', sentAt: msg.sentAt, serverTime: Date.now() } satisfies RoomMsg));
  }

  private scheduleArrival(): void {
    // Advance to arrival after the ride duration (120s = §5 durationSec)
    setTimeout(() => {
      if (this.phase !== 'riding') return;
      this.phase = 'arrival';
      if (this.syncTimer) { clearInterval(this.syncTimer); this.syncTimer = null; }
      this.broadcastState();
    }, 120_000);
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

  private hasAllChoices(connId: string): boolean {
    const p = this.participants.get(connId);
    if (!p || !this.seeds.has(connId)) return false;
    if (p.role === 'driver') {
      const { groove, tempo, energy } = this.driverChoices;
      return !!(groove && tempo && energy);
    }
    const { lead_instrument, brightness, texture } = this.passengerChoices;
    return !!(lead_instrument && brightness && texture);
  }

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
      .map((p) => ({ role: p.role, glyph: p.glyph, color: p.color, connected: true }))
      .sort((a) => (a.role === 'driver' ? -1 : 1));
  }

  private seededRoles(): Role[] {
    return [...this.seeds.keys()]
      .map((id) => this.participants.get(id)?.role)
      .filter((r): r is Role => r !== undefined);
  }

  private readyRolesArr(): Role[] {
    return [...this.readyConnIds]
      .map((id) => this.participants.get(id)?.role)
      .filter((r): r is Role => r !== undefined);
  }

  private broadcastToPeer(senderConnId: string, msg: RoomMsg): void {
    for (const connId of this.participants.keys()) {
      if (connId !== senderConnId) this.room.getConnection(connId)?.send(JSON.stringify(msg));
    }
  }

  private broadcastState(): void {
    const riders = this.publicRiders();
    const full = this.participants.size >= 2;
    const seeded = this.seededRoles();
    const readyRoles = this.readyRolesArr();
    const recipe: Recipe | undefined = this.generationInput?.recipe;
    for (const [connId, p] of this.participants) {
      const msg: RoomMsg = {
        t: 'state',
        phase: this.phase,
        you: p.role,
        riders,
        full,
        seeded,
        readyRoles,
        destination: this.destination,
        recipe,
        radioLocked: this.radioLocked,
      };
      this.room.getConnection(connId)?.send(JSON.stringify(msg));
    }
  }
}
