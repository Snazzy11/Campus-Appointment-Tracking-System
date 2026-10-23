import { useEffect, useState } from 'react';
import { ScrollView, Text } from 'react-native';

import { LocationItem } from './LocationItem';
import { getLocations } from './locationService';
import { Location } from './types';

export function LocationsScreen() {
  // State: values that, when changed, make the screen re-draw.
  const [locations, setLocations] = useState<Location[]>([]);
  const [errorMessage, setErrorMessage] = useState('');

  // useEffect with [] runs once, right after the screen first appears.
  useEffect(() => {
    async function loadLocations() {
      try {
        const data = await getLocations();
        setLocations(data);
      } catch {
        setErrorMessage('Could not load locations. Is the backend running?');
      }
    }

    loadLocations();
  }, []);

  return (
    <ScrollView contentContainerStyle={{ padding: 48 }}>
      {errorMessage !== '' && <Text>{errorMessage}</Text>}

      {locations.map((location) => (
        <LocationItem key={location.id} location={location} />
      ))}
    </ScrollView>
  );
}
