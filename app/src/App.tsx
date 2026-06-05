import { AudioIndicator } from './components/AudioIndicator';
import GetIn from './screens/GetIn';
import Lobby from './screens/Lobby';
import { useSession } from './state/session';

export default function App() {
  const identity = useSession((s) => s.identity);
  return (
    <div className="min-h-full">
      {identity ? <Lobby /> : <GetIn />}
      <AudioIndicator />
    </div>
  );
}
