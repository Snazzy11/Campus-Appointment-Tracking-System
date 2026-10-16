export async function getRouteLocation() {
  const Location = await import('expo-location');
  const permission = await Location.requestForegroundPermissionsAsync();
  if (!permission.granted) throw new Error('Location permission was not granted. Choose a starting building in From.');
  const result = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
  return result.coords;
}
