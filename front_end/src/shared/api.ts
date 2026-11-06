import Constants from 'expo-constants';
// Generated with Claude on 11-3-26

// The address of our FastAPI backend.
// To point the app somewhere else, set EXPO_PUBLIC_API_URL in front_end/.env (restart Expo afterwards).
const API_URL = process.env.EXPO_PUBLIC_API_URL || getDevApiUrl();

// On a phone or emulator, "localhost" is the device itself, not your computer.
// During development Expo tells us which machine is serving the app (hostUri, e.g. "192.168.1.5:8081"),
// so we assume the backend runs on that same machine on port 8000.
function getDevApiUrl() {
  const devHost = Constants.expoConfig?.hostUri?.split(':')[0];
  return 'http://' + (process.env.EXPO_OS !== 'web' && devHost ? devHost : 'localhost') + ':8000';
}

// Sends a GET request to the backend and returns the JSON it sends back.
// Example: await getFromApi('/locations')
export async function getFromApi(path: string) {
  const response = await fetch(API_URL + path);

  if (!response.ok) {
    throw new Error('Request to ' + path + ' failed with status ' + response.status);
  }

  return response.json();
}
