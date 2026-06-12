import { useState } from 'react';
import { AudioIndicator } from './components/AudioIndicator';
import GetIn from './screens/GetIn';
import RideScreen from './screens/RideScreen';
import ModelInspector from './screens/ModelInspector';
import ScenePreview from './screens/ScenePreview';
import CarPreview from './screens/CarPreview';
import Home from './screens/Home';
import Glovebox from './screens/Glovebox';
import { useSession } from './state/session';

const params = new URLSearchParams(window.location.search);
const isInspector = params.has('inspect');
const isPreview   = params.has('scene');
const isCarPreview = params.has('car');
const roomParam = params.get('room');

export default function App() {
  const identity = useSession((s) => s.identity);
  const [showGlovebox, setShowGlovebox] = useState(false);

  if (isInspector) return <ModelInspector />;
  if (isPreview)   return <ScenePreview />;
  if (isCarPreview) return <CarPreview />;

  // v5.3: a bare link is the front door — intro + the Radio. Rides live at ?room=
  if (!roomParam) {
    return showGlovebox
      ? <Glovebox onBack={() => setShowGlovebox(false)} />
      : <Home onGlovebox={() => setShowGlovebox(true)} />;
  }

  return (
    <div className="min-h-full">
      {identity ? <RideScreen /> : <GetIn />}
      <AudioIndicator />
    </div>
  );
}
