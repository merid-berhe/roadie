import { AudioIndicator } from './components/AudioIndicator';
import GetIn from './screens/GetIn';
import RideScreen from './screens/RideScreen';
import ModelInspector from './screens/ModelInspector';
import { useSession } from './state/session';

const isInspector = new URLSearchParams(window.location.search).has('inspect');

export default function App() {
  const identity = useSession((s) => s.identity);

  if (isInspector) return <ModelInspector />;

  return (
    <div className="min-h-full">
      {identity ? <RideScreen /> : <GetIn />}
      <AudioIndicator />
    </div>
  );
}
