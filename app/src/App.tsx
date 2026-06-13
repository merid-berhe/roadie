import { useEffect, useState } from 'react';
import { deriveIdentity } from '@roadie/shared';
import { supabase } from './lib/supabase';
import { AudioIndicator } from './components/AudioIndicator';
import GetIn from './screens/GetIn';
import RideScreen from './screens/RideScreen';
import WorldMap from './screens/WorldMap';
import Radio from './screens/Radio';
import Glovebox from './screens/Glovebox';
import { useSession } from './state/session';

const params = new URLSearchParams(window.location.search);
const roomParam = params.get('room');

export default function App() {
  const identity = useSession((s) => s.identity);
  const setIdentity = useSession((s) => s.setIdentity);
  const [view, setView] = useState<'map' | 'radio' | 'glovebox'>('map');

  // On the bare site (map/radio/glovebox), recover the persisted anonymous
  // session so the Glovebox can read the user's own songs. Identity is otherwise
  // only set inside the ?room flow (GetIn), so without this the Glovebox sees a
  // null userId. We don't mint a new anon user just for browsing, and we leave
  // the ?room path alone — GetIn must run there for the audio-unlock tap (§11).
  useEffect(() => {
    if (roomParam || !supabase || identity) return;
    supabase.auth.getSession().then(({ data }) => {
      const id = data.session?.user?.id;
      if (id) setIdentity(id, deriveIdentity(id));
    });
  }, [identity, setIdentity]);

  // v7.0: the world map is the front door. Rides (bars) live at ?room=<barId>__x
  if (!roomParam) {
    if (view === 'glovebox') return <Glovebox onBack={() => setView('map')} />;
    if (view === 'radio') return <Radio onBack={() => setView('map')} onGlovebox={() => setView('glovebox')} />;
    return <WorldMap onOpenRadio={() => setView('radio')} onGlovebox={() => setView('glovebox')} />;
  }

  return (
    <div className="min-h-full">
      {identity ? <RideScreen /> : <GetIn />}
      <AudioIndicator />
    </div>
  );
}
