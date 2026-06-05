import { AudioIndicator } from './components/AudioIndicator';
import GetIn from './screens/GetIn';

export default function App() {
  return (
    <div className="min-h-full">
      <GetIn />
      <AudioIndicator />
    </div>
  );
}
