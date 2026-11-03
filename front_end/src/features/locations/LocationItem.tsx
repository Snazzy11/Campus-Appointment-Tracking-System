import { ThemedText } from '@/shared/components/ThemedText';

import { Location } from './types';

type LocationItemProps = {
  location: Location;
};

// Shows a single location. Used once per row by LocationsScreen.
export function LocationItem({ location }: LocationItemProps) {
  return (
    <ThemedText>
      {location.name} ({location.latitude}, {location.longitude})
    </ThemedText>
  );
}
