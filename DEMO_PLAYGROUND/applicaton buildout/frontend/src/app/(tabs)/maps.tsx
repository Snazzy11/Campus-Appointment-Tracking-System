import { useLocalSearchParams } from 'expo-router';
import { CampusMap } from '../../features/maps/CampusMap';
export default function Screen() {
  const { search, request } = useLocalSearchParams<{ search?: string; request?: string }>();
  const query = typeof search === 'string' ? search.slice(0, 200) : '';
  return <CampusMap key={`${query}-${request ?? ''}`} initialSearch={query} />;
}
