// Form checks for Sign in and Create account.
// Each function returns an error message to show under the field, or '' if the value is fine.

// Only university accounts are allowed (spec: "Use your @cmich.edu email address.").
const UNIVERSITY_EMAIL_DOMAIN = '@cmich.edu';

export function validateName(name: string): string {
  if (name.trim() === '') {
    return 'Enter your name.';
  }
  return '';
}

export function validateEmail(email: string): string {
  const trimmed = email.trim().toLowerCase();
  if (trimmed === '') {
    return 'Enter your university email.';
  }
  // Something before the @, and the address ends with our domain.
  if (
    !trimmed.endsWith(UNIVERSITY_EMAIL_DOMAIN) ||
    trimmed.length <= UNIVERSITY_EMAIL_DOMAIN.length
  ) {
    return 'Use your @cmich.edu email address.';
  }
  return '';
}

// Rule from the design: at least 8 characters, including a number.
export function validateNewPassword(password: string): string {
  if (password.length < 8) {
    return 'Use at least 8 characters.';
  }
  if (!/[0-9]/.test(password)) {
    return 'Include at least one number.';
  }
  return '';
}

// Sign in only checks that a password was typed; the backend decides if it is correct.
export function validatePassword(password: string): string {
  if (password === '') {
    return 'Enter your password.';
  }
  return '';
}
