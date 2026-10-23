// The address of our FastAPI backend.
// To point the app somewhere else (e.g. a phone on your Wi-Fi), set EXPO_PUBLIC_API_URL in front_end/.env
const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8000';

// Sends a GET request to the backend and returns the JSON it sends back.
// Example: await getFromApi('/locations')
export async function getFromApi(path: string) {
  const response = await fetch(API_URL + path);

  if (!response.ok) {
    throw new Error('Request to ' + path + ' failed with status ' + response.status);
  }

  return response.json();
}
