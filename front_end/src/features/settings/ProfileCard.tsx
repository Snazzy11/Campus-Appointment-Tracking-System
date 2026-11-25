import { StyleSheet, View } from 'react-native';

import { StudentProfile } from '@/features/auth/types';
import { ThemedText } from '@/shared/components/ThemedText';
import { Radius, Spacing } from '@/shared/constants/theme';
import { useTheme } from '@/shared/hooks/useTheme';

type ProfileCardProps = {
  // null when nobody is signed in (e.g. after "Explore campus first").
  profile: StudentProfile | null;
};

// The maroon card at the top of Settings with the student's name and email.
export function ProfileCard({ profile }: ProfileCardProps) {
  const theme = useTheme();

  return (
    <View style={[styles.card, { backgroundColor: theme.primary }]}>
      <ThemedText type="eyebrow" themeColor="brandAccent">
        {profile ? profile.accountLabel : 'GUEST'}
      </ThemedText>
      {/* Spec: with no profile, show a generic card rather than a made-up identity. */}
      <ThemedText type="cardTitle" themeColor="onPrimary">
        {profile ? profile.displayName : 'Welcome, student'}
      </ThemedText>
      <ThemedText type="caption" themeColor="onPrimary">
        {profile ? profile.email : 'Sign in to see your profile here.'}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: Spacing.sm,
    padding: Spacing.lg,
    borderRadius: Radius.hero,
  },
});
