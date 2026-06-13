import { getAudioState, resumeAudio } from '../audio/engine';
import { useSession } from '../state/session';

// The §11 safety net: a slashed-speaker affordance shown whenever the context
// isn't running (iOS suspended it). Tapping it resumes audio.
export function AudioIndicator() {
  const audioState = useSession((s) => s.audioState);
  const setAudioState = useSession((s) => s.setAudioState);

  if (audioState === 'running') return null;

  async function turnSoundBackOn() {
    await resumeAudio();
    setAudioState(getAudioState());
  }

  return (
    <button
      onClick={turnSoundBackOn}
      className="fixed bottom-4 right-4 z-50 flex items-center gap-2 rounded-full bg-sunset px-4 py-2 text-sm font-semibold text-paper shadow-warm"
    >
      <SpeakerSlashIcon />
      tap to turn the sound on
    </button>
  );
}

function SpeakerSlashIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M11 5 6 9H2v6h4l5 4z" />
      <line x1="22" y1="2" x2="2" y2="22" />
    </svg>
  );
}
