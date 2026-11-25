import { router, type Href } from 'expo-router';

// Goes back to the previous screen. If there is no previous screen (for example, someone
// opened this page directly from a link in the browser), goes to `fallback` instead.
export function goBackOr(fallback: Href) {
  if (router.canGoBack()) {
    router.back();
  } else {
    router.replace(fallback);
  }
}

// Opens the main app (the tabs, starting on Home) and removes the Welcome, Sign in and
// Create account screens from the history, so the back button can't return to them.
export function enterApp() {
  if (router.canDismiss()) {
    router.dismissAll();
  }
  router.replace('/home');
}
