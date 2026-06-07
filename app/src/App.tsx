import { AudioIndicator } from './components/AudioIndicator';
import GetIn from './screens/GetIn';
import RideScreen from './screens/RideScreen';
import ModelInspector from './screens/ModelInspector';
import ScenePreview from './screens/ScenePreview';
import { useSession } from './state/session';

const isInspector = new URLSearchParams(window.location.search).has('inspect');
const isPreview   = new URLSearchParams(window.location.search).has('scene');

export default function App() {
  const identity = useSession((s) => s.identity);

  if (isInspector) return <ModelInspector />;
  if (isPreview)   return <ScenePreview />;

  return (
    <div className="min-h-full">
      {identity ? <RideScreen /> : <GetIn />}
      <AudioIndicator />
    </div>
  );
}
