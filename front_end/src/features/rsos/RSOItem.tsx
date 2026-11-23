import { FlatList } from 'react-native';
import { ThemedView } from '@/shared/components/ThemedView';
import { ThemedText } from '@/shared/components/ThemedText';
import { RSO } from './types';

type RSOItemProp = {
  rso: RSO;
};

export function RSOItem({ rso }: RSOItemProp) {
  return (
    <ThemedView style={{ paddingVertical: 8 }}>
      <ThemedText>{rso.name}</ThemedText>
    </ThemedView>
  );
}
