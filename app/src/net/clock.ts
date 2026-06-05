// §9: round-trip clock offset estimation.
// Client sends 3 pings, averages the offsets. The room store handles pong via ingest.
// clockOffset = serverTime - localTime (positive means server is ahead).
// Usage: serverTimeNow = Date.now() + clockOffset

import type { ClientMsg } from '@roadie/shared';

/** Fire 3 pings 200ms apart. The pong handler in useRoom.ingest accumulates offsets. */
export function estimateClockOffset(send: (msg: ClientMsg) => void): void {
  for (let i = 0; i < 3; i++) {
    setTimeout(() => send({ t: 'ping', sentAt: Date.now() }), i * 200);
  }
}

/** Compute offset from a single pong. Call from useRoom.ingest pong handler. */
export function offsetFromPong(sentAt: number, serverTime: number): number {
  const rtt = Date.now() - sentAt;
  // serverTime ≈ server clock when it responded; advance by half RTT for "server time now"
  return serverTime + rtt / 2 - Date.now();
}
