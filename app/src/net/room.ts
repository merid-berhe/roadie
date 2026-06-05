import PartySocket from 'partysocket';
import type { ClientMsg, RoomMsg } from '@roadie/shared';

// Dev default is the local `partykit dev` server. For two-phone testing over the
// LAN, set VITE_PARTYKIT_HOST to the dev machine's IP:1999; in prod, the deployed host.
const HOST = import.meta.env.VITE_PARTYKIT_HOST ?? 'localhost:1999';

export type RoomConnection = {
  send: (msg: ClientMsg) => void;
  close: () => void;
};

export function connectToRoom(
  roomCode: string,
  handlers: {
    onMessage: (msg: RoomMsg) => void;
    onOpen?: () => void;
    onClose?: () => void;
  },
): RoomConnection {
  const socket = new PartySocket({ host: HOST, room: roomCode });

  socket.addEventListener('message', (event) => {
    try {
      handlers.onMessage(JSON.parse(event.data as string) as RoomMsg);
    } catch {
      // ignore malformed frames
    }
  });
  if (handlers.onOpen) socket.addEventListener('open', handlers.onOpen);
  if (handlers.onClose) socket.addEventListener('close', handlers.onClose);

  return {
    send: (msg: ClientMsg) => socket.send(JSON.stringify(msg)),
    close: () => socket.close(),
  };
}
