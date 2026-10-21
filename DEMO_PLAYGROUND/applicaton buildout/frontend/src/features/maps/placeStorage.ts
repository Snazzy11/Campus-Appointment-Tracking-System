import * as SecureStore from 'expo-secure-store';
const KEY = 'campus-map-places-v1';
export const loadPlaces = () => SecureStore.getItemAsync(KEY);
export const storePlaces = (value: string) => SecureStore.setItemAsync(KEY, value);
