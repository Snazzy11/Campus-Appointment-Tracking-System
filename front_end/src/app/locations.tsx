import { useEffect, useState } from 'react';
import { ScrollView, Text } from 'react-native';

import { getLocations, type Location } from '@/api/locations';

export default function LocationsScreen() {
  const [locations, setLocations] = useState<Location[]>([]);
  const [error, setError] = useState<string>();

  // Runs once when the screen first renders.
  useEffect(() => {
    getLocations()
      .then(setLocations)
      .catch((err: Error) => setError(err.message));
  }, []);

  return (
    <ScrollView contentContainerStyle={{ padding: 48 }}>
      {error && <Text>Error: {error}</Text>}
      {locations.map((location) => (
        <Text key={location.id}>
          {location.name} ({location.latitude}, {location.longitude})
        </Text>
      ))}
    </ScrollView>
  );
}
