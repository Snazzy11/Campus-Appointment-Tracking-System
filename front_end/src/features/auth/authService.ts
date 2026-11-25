// FAKE DATA: this file pretends to be the backend until account endpoints exist
// (sign in, create account, current profile). Screens call these functions exactly as they
// will call the real ones, so only this file needs to change. See FRONTEND_TASKS.md.

import { simulateRequest } from '@/shared/fakeBackend';

import { StudentProfile } from './types';

// The "logged in" student. It only lives in memory, so reloading the app signs you out.
let currentProfile: StudentProfile | null = null;

// Thrown when the email and password are wrong, so the screen can show a friendly message.
export class SignInError extends Error {}

// Signs in. The fake backend accepts any @cmich.edu email with a password of 8+ characters.
export async function signIn(email: string, password: string): Promise<StudentProfile> {
  await simulateRequest();

  if (password.length < 8) {
    throw new SignInError("That email and password don't match a student account.");
  }

  currentProfile = {
    displayName: 'Alex Student',
    email: email.trim().toLowerCase(),
    accountLabel: 'STUDENT DEMO',
  };
  return currentProfile;
}

// Creates an account and signs in. No account is really created.
export async function createAccount(
  name: string,
  email: string,
  password: string,
): Promise<StudentProfile> {
  await simulateRequest();

  // The real backend will store the password; the fake one only needs to accept it.
  void password;

  currentProfile = {
    displayName: name.trim(),
    email: email.trim().toLowerCase(),
    accountLabel: 'STUDENT DEMO',
  };
  return currentProfile;
}

// Returns the signed-in student, or null if nobody is signed in (e.g. "Explore campus first").
export async function getCurrentProfile(): Promise<StudentProfile | null> {
  await simulateRequest();
  return currentProfile;
}

export async function signOut(): Promise<void> {
  await simulateRequest();
  currentProfile = null;
}
