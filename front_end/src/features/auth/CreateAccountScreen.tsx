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

import { createAccount } from './authService';
import { validateEmail, validateName, validateNewPassword } from './validation';

// Figma: "CATS · Create account" (node 67:12)
export function CreateAccountScreen() {
  // Prefilled for the demo walkthrough, as in the design.
  const [name, setName] = useState('Alex Student');
  const [email, setEmail] = useState('student@cmich.edu');
  const [password, setPassword] = useState('catsdemo1');
  const [nameError, setNameError] = useState('');
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleCreateAccount() {
    const newNameError = validateName(name);
    const newEmailError = validateEmail(email);
    const newPasswordError = validateNewPassword(password);
    setNameError(newNameError);
    setEmailError(newEmailError);
    setPasswordError(newPasswordError);
    setFormError('');
    if (newNameError || newEmailError || newPasswordError) {
      return;
    }

    setIsSubmitting(true);
    try {
      await createAccount(name, email, password);
      // In the design, a new account goes straight to booking an advising appointment.
      // Home goes underneath it, so "Back" and "Skip for now" land on Home.
      enterApp();
      router.push('/book-appointment');
    } catch {
      setFormError("We couldn't create your account. Check your connection and try again.");
      setIsSubmitting(false);
    }
  }

  return (
    <Screen>
      <ScreenHeader
        title="Join your campus"
        subtitle="A little less juggling. A lot more CATS."
        onBack={() => goBackOr('/sign-in')}
      />

      <View style={styles.fields}>
        <TextField
          label="Your name"
          value={name}
          onChangeText={setName}
          errorText={nameError}
          autoComplete="name"
          autoCapitalize="words"
          textContentType="name"
          disabled={isSubmitting}
        />
        <TextField
          label="University email"
          value={email}
          onChangeText={setEmail}
          errorText={emailError}
          helperText="Use your @cmich.edu email address."
          keyboardType="email-address"
          autoComplete="email"
          autoCapitalize="none"
          textContentType="emailAddress"
          disabled={isSubmitting}
        />
        <TextField
          label="Create password"
          value={password}
          onChangeText={setPassword}
          errorText={passwordError}
          helperText="At least 8 characters, including a number."
          secure
          autoComplete="new-password"
          textContentType="newPassword"
          disabled={isSubmitting}
        />
      </View>

      <ThemedText type="caption" themeColor="textSecondary">
        Demo details are filled in so you can explore. No account is created in this prototype.
      </ThemedText>

      {formError !== '' && <InfoNote variant="error" message={formError} />}

      <View style={styles.buttons}>
        <Button label="Create account" onPress={handleCreateAccount} loading={isSubmitting} />
        <Button
          label="Explore campus first"
          variant="text"
          showArrow
          onPress={enterApp}
          disabled={isSubmitting}
        />
      </View>
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
});
