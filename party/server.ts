import type * as Party from 'partykit/server';
import type { ClientMsg, Phase, Rider, Role, RoomMsg } from '@roadie/shared';
import {
  buildPrompt,
  DRIVER_OPTIONS,
  PASSENGER_OPTIONS,
  type DriverChoices,
  type PassengerChoices,
  type Recipe,
} from '@roadie/shared';

type Participant = {
  userId: string; // server-side only — never sent to peer (§6)
  role: Role;
  glyph: string;
  color: string;
};

/**
 * One PartyKit room per ride. Single source of truth (§3): owns presence, roles,
 * composition state, clock, and generation trigger (M3+).
 */
export default class RideRoom implements Party.Server {
  private participants = new Map<string, Participant>(); // connId → participant
  private phase: Phase = 'lobby';

  // Composition state (M2)
  private seeds = new Map<string, string>(); // connId → mood word
  private driverChoices: Partial<DriverChoices> = {};
  private passengerChoices: Partial<PassengerChoices> = {};
  private readyConnIds = new Set<string>();
  private generationInput: ReturnType<typeof buildPrompt> | null = null;

  constructor(readonly room: Party.Room) {}

  onMessage(raw: string, sender: Party.Connection): void {
    let msg: ClientMsg;
    try {
      msg = JSON.parse(raw) as ClientMsg;
    } catch {
      return;
    }
    switch (msg.t) {
      case 'join':    return this.handleJoin(msg, sender);
      case 'seed':    return this.handleSeed(msg, sender);
      case 'choice':  return this.handleChoice(msg, sender);
      case 'ready':   return this.handleReady(sender);
    }
  }

  onClose(conn: Party.Connection): void {
    if (this.participants.delete(conn.id)) {
      this.seeds.delete(conn.id);
      this.readyConnIds.delete(conn.id);
      this.broadcastState();
    }
  }

  // --- join ---

  private handleJoin(msg: Extract<ClientMsg, { t: 'join' }>, sender: Party.Connection): void {
    const existing = this.participants.get(sender.id);
    if (existing) {
      existing.userId = msg.userId;
      existing.glyph = msg.glyph;
      existing.color = msg.color;
    } else {
      if (this.participants.size >= 2) {
        sender.send(JSON.stringify({ t: 'roomFull' } satisfies RoomMsg));
        return;
      }
      const role: Role = this.roleTaken('driver') ? 'passenger' : 'driver';
      this.participants.set(sender.id, { userId: msg.userId, role, glyph: msg.glyph, color: msg.color });
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
    } else {
      return; // wrong field for this role — ignore
    }

    this.broadcastToPeer(sender.id, { t: 'peerChoice', glyph: p.glyph, field: msg.field, value: msg.value });
    this.broadcastState();
  }

  private handleReady(sender: Party.Connection): void {
    if (!this.hasAllChoices(sender.id) || this.phase !== 'lobby') return;
    this.readyConnIds.add(sender.id);
    this.broadcastState();

    if (this.readyConnIds.size === 2 && this.participants.size === 2) {
      const allComplete = [...this.participants.keys()].every((id) => this.hasAllChoices(id));
      if (allComplete) this.advanceToGenerating();
    }
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

  private advanceToGenerating(): void {
    const driverConn = this.getConnIdForRole('driver');
    const passengerConn = this.getConnIdForRole('passenger');
    if (!driverConn || !passengerConn) return;

    const seedDriver = this.seeds.get(driverConn);
    const seedPassenger = this.seeds.get(passengerConn);
    if (!seedDriver || !seedPassenger) return;

    this.generationInput = buildPrompt(
      seedDriver,
      seedPassenger,
      this.driverChoices as DriverChoices,
      this.passengerChoices as PassengerChoices,
    );
    this.phase = 'generating';
    // M3: trigger MusicGenerator.generate(this.generationInput) here
    this.broadcastState();
  }

  private getConnIdForRole(role: Role): string | null {
    for (const [connId, p] of this.participants) {
      if (p.role === role) return connId;
    }
    return null;
  }

  private roleTaken(role: Role): boolean {
    for (const p of this.participants.values()) {
      if (p.role === role) return true;
    }
    return false;
  }

  private publicRiders(): Rider[] {
    return [...this.participants.values()]
      .map((p) => ({ role: p.role, glyph: p.glyph, color: p.color, connected: true }))
      .sort((a) => (a.role === 'driver' ? -1 : 1));
  }

  private seededRoles(): Role[] {
    return [...this.seeds.keys()]
      .map((connId) => this.participants.get(connId)?.role)
      .filter((r): r is Role => r !== undefined);
  }

  private readyRolesArr(): Role[] {
    return [...this.readyConnIds]
      .map((connId) => this.participants.get(connId)?.role)
      .filter((r): r is Role => r !== undefined);
  }

  private broadcastToPeer(senderConnId: string, msg: RoomMsg): void {
    for (const connId of this.participants.keys()) {
      if (connId === senderConnId) continue;
      this.room.getConnection(connId)?.send(JSON.stringify(msg));
    }
  }

  private broadcastState(): void {
    const riders = this.publicRiders();
    const full = this.participants.size >= 2;
    const seeded = this.seededRoles();
    const readyRoles = this.readyRolesArr();
    const recipe: Recipe | undefined = this.generationInput?.recipe;

    for (const [connId, p] of this.participants) {
      const msg: RoomMsg = { t: 'state', phase: this.phase, you: p.role, riders, full, seeded, readyRoles, recipe };
      this.room.getConnection(connId)?.send(JSON.stringify(msg));
    }
  }
}
