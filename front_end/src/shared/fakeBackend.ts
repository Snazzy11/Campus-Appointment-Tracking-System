// Helpers for service files that return fake data because their backend endpoint doesn't exist yet.
// Delete this file once every service talks to the real backend.

// Set this to true to make every fake service fail, so you can check each screen's error state.
// Always set it back to false before committing.
export const SIMULATE_FAKE_BACKEND_ERRORS = false;

// How long a fake request "takes", so loading states show up just like with a real network.
const FAKE_DELAY_MS = 400;

// Waits a moment like a real request would, then fails if SIMULATE_FAKE_BACKEND_ERRORS is on.
// Call it at the start of every fake service function: `await simulateRequest();`
export async function simulateRequest(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, FAKE_DELAY_MS));

  if (SIMULATE_FAKE_BACKEND_ERRORS) {
    throw new Error('Simulated backend error (SIMULATE_FAKE_BACKEND_ERRORS is on)');
  }
}
