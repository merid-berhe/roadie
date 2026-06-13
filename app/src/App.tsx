import { useEffect, useState } from 'react';
import { deriveIdentity } from '@roadie/shared';
import { supabase } from './lib/supabase';
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
  const setIdentity = useSession((s) => s.setIdentity);
  const [showGlovebox, setShowGlovebox] = useState(false);

  // On the bare site (Home/Glovebox), recover the persisted anonymous session
  // so the Glovebox can read the user's own saved songs. Identity is otherwise
  // only set inside the ?room flow (GetIn), so without this the Glovebox sees a
  // null userId and shows nothing. We do NOT mint a new anon user here (just
  // browsing the Radio shouldn't create accounts), and we leave the ?room path
  // alone — GetIn must run there for the tap that unlocks audio (§11).
  useEffect(() => {
    if (roomParam || !supabase || identity) return;
    supabase.auth.getSession().then(({ data }) => {
      const id = data.session?.user?.id;
      if (id) setIdentity(id, deriveIdentity(id));
    });
  }, [identity, setIdentity]);

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
