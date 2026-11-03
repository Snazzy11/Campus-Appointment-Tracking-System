import { useEffect, useState } from 'react';
import { FlatList } from 'react-native';

import { Screen } from '@/shared/components/Screen';
import { ThemedText } from '@/shared/components/ThemedText';

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
        setErrorMessage(
          'Could not load locations. Is the backend running? Does the database have the data?',
        );
      }
    }

    loadLocations();
  }, []);

  return (
    <Screen>
      {errorMessage !== '' && <ThemedText>{errorMessage}</ThemedText>}

      {/* FlatList only draws the rows that are on screen, so long lists stay fast on phones. */}
      <FlatList
        data={locations}
        keyExtractor={(location) => String(location.id)}
        renderItem={({ item }) => <LocationItem location={item} />}
      />
    </Screen>
  );
}
