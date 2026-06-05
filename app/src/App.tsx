import { AudioIndicator } from './components/AudioIndicator';
import GetIn from './screens/GetIn';
import RideScreen from './screens/RideScreen';
import { useSession } from './state/session';

export default function App() {
  const identity = useSession((s) => s.identity);
  return (
    <div className="min-h-full">
      {identity ? <RideScreen /> : <GetIn />}
      <AudioIndicator />
    </div>
  );
}
