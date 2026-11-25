import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/shared/components/Button';
import { InfoNote } from '@/shared/components/InfoNote';
import { Screen } from '@/shared/components/Screen';
import { ScreenHeader } from '@/shared/components/ScreenHeader';
import { TextField } from '@/shared/components/TextField';
import { ThemedText } from '@/shared/components/ThemedText';
import { Spacing } from '@/shared/constants/theme';
import { enterApp, goBackOr } from '@/shared/navigation';

import { SignInError, signIn } from './authService';
import { validateEmail, validatePassword } from './validation';

// The demo walkthrough starts with these filled in (spec: "Details are prefilled").
const DEMO_EMAIL = 'student@cmich.edu';
const DEMO_PASSWORD = 'catsdemo1';

// Figma: "CATS · Sign in" (node 67:7)
export function SignInScreen() {
  const [email, setEmail] = useState(DEMO_EMAIL);
  const [password, setPassword] = useState(DEMO_PASSWORD);
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  // Shown above the button when the request fails (wrong password, no network, ...).
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // The button stays disabled until both fields have something in them (spec: empty state).
  const canSubmit = email.trim() !== '' && password !== '';

  async function handleSignIn() {
    const newEmailError = validateEmail(email);
    const newPasswordError = validatePassword(password);
    setEmailError(newEmailError);
    setPasswordError(newPasswordError);
    setFormError('');
    if (newEmailError || newPasswordError) {
      return;
    }

    setIsSubmitting(true);
    try {
      await signIn(email, password);
      enterApp();
    } catch (error) {
      // Keep what the student typed so they can just fix it and try again.
      if (error instanceof SignInError) {
        setFormError(error.message);
      } else {
        setFormError("We couldn't sign you in. Check your connection and try again.");
      }
      setIsSubmitting(false);
    }
  }

  return (
    <Screen>
      <ScreenHeader
        title="Welcome back"
        subtitle="Sign in to your campus companion."
        onBack={() => goBackOr('/')}
      />

      <ThemedText type="eyebrow" themeColor="primary">
        YOUR CAMPUS, CONNECTED
      </ThemedText>

      <View style={styles.fields}>
        <TextField
          label="University email"
          value={email}
          onChangeText={setEmail}
          errorText={emailError}
          keyboardType="email-address"
          autoComplete="email"
          autoCapitalize="none"
          textContentType="username"
          disabled={isSubmitting}
        />
        <TextField
          label="Password"
          value={password}
          onChangeText={setPassword}
          errorText={passwordError}
          secure
          autoComplete="current-password"
          textContentType="password"
          disabled={isSubmitting}
        />
      </View>

      <InfoNote
        title="Try the student demo"
        message="Details are prefilled for this walkthrough."
      />

      {formError !== '' && <InfoNote variant="error" message={formError} />}

      <View style={styles.buttons}>
        <Button
          label="Sign in"
          onPress={handleSignIn}
          loading={isSubmitting}
          disabled={!canSubmit}
        />
        <Button
          label="Create an account"
          variant="secondary"
          onPress={() => router.push('/create-account')}
          disabled={isSubmitting}
        />
      </View>

      <ThemedText type="caption" themeColor="textSecondary" style={styles.footer}>
        For Central Michigan University students.
      </ThemedText>
    </Screen>
  );
}

const styles = StyleSheet.create({
  fields: {
    gap: Spacing.xl,
  },
  buttons: {
    gap: Spacing.md,
  },
  footer: {
    textAlign: 'center',
  },
});
