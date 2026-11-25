import { useIsFocused, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { getCurrentProfile } from '@/features/auth/authService';
import { Button } from '@/shared/components/Button';
import { Screen } from '@/shared/components/Screen';
import { ThemedText } from '@/shared/components/ThemedText';
import { Colors, Radius, Spacing } from '@/shared/constants/theme';
import { useColorScheme } from '@/shared/hooks/useColorScheme';
import { useTheme } from '@/shared/hooks/useTheme';
import { enterApp } from '@/shared/navigation';

// Figma: "CATS · Welcome" (node 67:2)
export function WelcomeScreen() {
  const theme = useTheme();
  const isDark = useColorScheme() === 'dark';
  const isFocused = useIsFocused();
  // True while we check whether the student is already signed in.
  const [isRestoringSession, setIsRestoringSession] = useState(true);

  useEffect(() => {
    async function restoreSession() {
      try {
        const profile = await getCurrentProfile();
        if (profile) {
          enterApp();
          return;
        }
      } catch {
        // If the check fails, just let the student press "Get started" (spec: don't block entry).
      }
      setIsRestoringSession(false);
    }

    restoreSession();
  }, []);

  return (
    <Screen width="form" backgroundColor="primary" contentStyle={styles.content}>
      {/* This screen has a dark maroon background in light mode (and light pink in dark mode),
          so the status bar text flips to stay readable. Only while this screen is visible. */}
      {isFocused && <StatusBar style={isDark ? 'dark' : 'light'} />}

      <View style={styles.top}>
        <ThemedText type="eyebrow" themeColor="brandAccent">
          MADE FOR YOUR CAMPUS
        </ThemedText>

        <View style={[styles.wordmark, { backgroundColor: theme.brandAccent }]}>
          {/* The gold panel is the same in light and dark mode, so the letters always use the
              light-mode maroon. (Dark mode's pink 'primary' would be unreadable on gold.) */}
          <ThemedText
            type="logo"
            style={{ color: Colors.light.primary }}
            accessibilityRole="header"
            accessibilityLabel="CATS"
          >
            CATS
          </ThemedText>
        </View>

        <ThemedText type="welcomeTitle" themeColor="onPrimary">
          Campus life.{'\n'}All together.
        </ThemedText>
        <ThemedText type="body" themeColor="onPrimary">
          Your people, your plans, your way around. A campus companion for every day.
        </ThemedText>

        <View style={[styles.universityBadge, { backgroundColor: theme.backgroundSelected }]}>
          <ThemedText type="eyebrow" themeColor="primary">
            CENTRAL MICHIGAN UNIVERSITY
          </ThemedText>
        </View>
      </View>

      <View style={styles.bottom}>
        <Button
          label="Get started"
          variant="inverse"
          showArrow
          loading={isRestoringSession}
          onPress={() => router.push('/sign-in')}
        />
        <ThemedText type="caption" themeColor="onPrimary" style={styles.footer}>
          A little less searching. A lot more living.
        </ThemedText>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    justifyContent: 'space-between',
    paddingTop: Spacing.xxl,
  },
  top: {
    gap: Spacing.xl,
  },
  wordmark: {
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    borderRadius: Radius.hero,
  },
  universityBadge: {
    alignSelf: 'flex-start',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    borderRadius: Radius.pill,
  },
  bottom: {
    gap: Spacing.lg,
  },
  footer: {
    textAlign: 'center',
  },
});
