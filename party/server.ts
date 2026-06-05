import type * as Party from 'partykit/server';
import type { ClientMsg, Phase, Rider, Role, RoomMsg } from '@roadie/shared';

type Participant = {
  userId: string; // kept server-side only — never sent to the peer (§6)
  role: Role;
  glyph: string;
  color: string;
};

/**
 * One PartyKit room per ride. The room is the single source of truth (§3):
 * it owns presence, assigns roles, and will own the clock + generation later.
 */
export default class RideRoom implements Party.Server {
  // connection id -> participant
  private participants = new Map<string, Participant>();
  private phase: Phase = 'lobby';

  constructor(readonly room: Party.Room) {}

  onMessage(raw: string, sender: Party.Connection): void {
    let msg: ClientMsg;
    try {
      msg = JSON.parse(raw) as ClientMsg;
    } catch {
      return;
    }
    if (msg.t === 'join') {
      this.handleJoin(msg, sender);
    }
    // Other message types (seed/choice/ready/gesture/…) arrive in later milestones.
  }

  onClose(conn: Party.Connection): void {
    if (this.participants.delete(conn.id)) {
      this.broadcastState();
    }
  }

  private handleJoin(msg: Extract<ClientMsg, { t: 'join' }>, sender: Party.Connection): void {
    const existing = this.participants.get(sender.id);
    if (existing) {
      // Re-join on the same connection (reconnect): refresh identity, keep the role.
      existing.userId = msg.userId;
      existing.glyph = msg.glyph;
      existing.color = msg.color;
    } else {
      if (this.participants.size >= 2) {
        sender.send(JSON.stringify({ t: 'roomFull' } satisfies RoomMsg));
        return;
      }
      // First arrival drives, second rides (§3 server-authoritative role assignment).
      const role: Role = this.roleTaken('driver') ? 'passenger' : 'driver';
      this.participants.set(sender.id, { userId: msg.userId, role, glyph: msg.glyph, color: msg.color });
    }
    this.broadcastState();
  }

  private roleTaken(role: Role): boolean {
    for (const p of this.participants.values()) {
      if (p.role === role) return true;
    }
    return false;
  }

  /** Public view of riders — user_id intentionally omitted (§6). Driver first. */
  private publicRiders(): Rider[] {
    return [...this.participants.values()]
      .map((p) => ({ role: p.role, glyph: p.glyph, color: p.color, connected: true }))
      .sort((a, b) => (a.role === 'driver' ? -1 : b.role === 'driver' ? 1 : 0));
  }

  private broadcastState(): void {
    const riders = this.publicRiders();
    const full = this.participants.size >= 2;
    for (const [connId, p] of this.participants) {
      const conn = this.room.getConnection(connId);
      if (!conn) continue;
      const msg: RoomMsg = { t: 'state', phase: this.phase, you: p.role, riders, full };
      conn.send(JSON.stringify(msg));
    }
  }
}
