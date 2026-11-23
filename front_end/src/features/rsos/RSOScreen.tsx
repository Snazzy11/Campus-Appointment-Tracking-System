import { useEffect, useState } from 'react';
import { FlatList } from 'react-native';

import { Screen } from '@/shared/components/Screen';
import { ThemedText } from '@/shared/components/ThemedText';

import { RSOItem } from './RSOItem';
import { getRSOs } from './rsoService';
import { RSO } from './types';

export function RSOScreen() {
  const [rsos, setRSOs] = useState<RSO[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    async function loadRSOs() {
      try {
        const data = await getRSOs();
        setRSOs(data);
      } catch {
        setError(
          'Could not load locations. Is the backend running? Does the database have the data?',
        );
      }
    }

    loadRSOs();
  }, []);

  return (
    <Screen>
      {error !== '' && <ThemedText>{error}</ThemedText>}
      {
        <FlatList
          data={rsos}
          keyExtractor={(rso) => String(rso.id)}
          renderItem={({ item }) => <RSOItem rso={item} />}
        ></FlatList>
      }
    </Screen>
  );
}
