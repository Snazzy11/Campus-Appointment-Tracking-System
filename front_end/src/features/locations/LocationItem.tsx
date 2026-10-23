import { Text } from 'react-native';

import { Location } from './types';

type LocationItemProps = {
  location: Location;
};

// Shows a single location. Used once per row by LocationsScreen.
export function LocationItem({ location }: LocationItemProps) {
  return (
    <Text>
      {location.name} ({location.latitude}, {location.longitude})
    </Text>
  );
}
