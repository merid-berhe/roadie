// Short, URL-friendly room codes for invite-link pairing (§10). No ambiguous chars.
const ALPHABET = 'abcdefghijkmnpqrstuvwxyz23456789';

function randomCode(length = 6): string {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  let code = '';
  for (let i = 0; i < length; i++) code += ALPHABET[bytes[i] % ALPHABET.length];
  return code;
}

/** Read ?room= from the URL, creating + persisting one if absent (the link IS the invite). */
export function getOrCreateRoomCode(): string {
  const url = new URL(window.location.href);
  let code = url.searchParams.get('room');
  if (!code) {
    code = randomCode();
    url.searchParams.set('room', code);
    window.history.replaceState({}, '', url.toString());
  }
  return code;
}

export function inviteLink(roomCode: string): string {
  const url = new URL(window.location.href);
  url.searchParams.set('room', roomCode);
  return url.toString();
}
