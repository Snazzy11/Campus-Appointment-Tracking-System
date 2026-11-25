// The signed-in student, as shown on the Settings screen.
// There is no backend endpoint for accounts yet; see authService.ts.
export type StudentProfile = {
  displayName: string;
  email: string;
  // Small label above the name, e.g. "STUDENT DEMO".
  accountLabel: string;
};
