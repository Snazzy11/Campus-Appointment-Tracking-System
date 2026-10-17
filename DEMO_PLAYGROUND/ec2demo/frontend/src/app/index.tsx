import { MessagingScreen } from '../screens/MessagingScreen';
import { useAuth } from '../context/AuthContext';
export default function Index() {
  const { user } = useAuth();
  // Reset private caches and selection when the signed-in account changes.
  return <MessagingScreen key={user?.sub || 'anonymous'} />;
}
