import { router, type Href } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ActionRow } from '@/shared/components/ActionRow';
import { HeroCard } from '@/shared/components/HeroCard';
import { Icon } from '@/shared/components/Icon';
import { IconButton } from '@/shared/components/IconButton';
import { InfoNote } from '@/shared/components/InfoNote';
import { Screen } from '@/shared/components/Screen';
import { ScreenHeader } from '@/shared/components/ScreenHeader';
import { SectionHeading } from '@/shared/components/SectionHeading';
import { Skeleton } from '@/shared/components/Skeleton';
import { ThemedText } from '@/shared/components/ThemedText';
import { Opacity, Radius, Size, Spacing } from '@/shared/constants/theme';
import { formatLongDate } from '@/shared/dates';
import { useIsWideScreen } from '@/shared/hooks/useIsWideScreen';
import { useTheme } from '@/shared/hooks/useTheme';

import { getHomeSummary } from './homeService';
import { HomeSummary } from './types';

// The numbered shortcuts. These are fixed parts of the screen, not data from the backend.
const ACTIONS: { number: string; title: string; subtitle: string; href: Href }[] = [
  {
    number: '01',
    title: 'Meet a professor',
    subtitle: 'Make space for a conversation.',
    href: '/book-appointment',
  },
  {
    number: '02',
    title: 'Plan your classes',
    subtitle: 'Stay one step ahead of your week.',
    href: '/schedule',
  },
  {
    number: '03',
    title: 'Academic counseling',
    subtitle: 'Find support for your next step.',
    href: '/book-appointment',
  },
];

// Figma: "CATS · Home" (node 67:17)
export function HomeScreen() {
  const theme = useTheme();
  const isWide = useIsWideScreen();
  const [summary, setSummary] = useState<HomeSummary | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');

  // Adding 1 to this number makes the effect below run again, which reloads the data.
  // That is how "Try again" works.
  const [loadCount, setLoadCount] = useState(0);

  // Load once when the screen first appears.
  useEffect(() => {
    async function loadSummary() {
      try {
        const data = await getHomeSummary();
        setSummary(data);
        setStatus('ready');
      } catch {
        setStatus('error');
      }
    }

    loadSummary();
  }, [loadCount]);

  function retry() {
    setStatus('loading');
    setLoadCount(loadCount + 1);
  }

  // The "Find your people" card. Defined once here and placed below, in a different spot
  // depending on the screen width.
  const findYourPeople = (
    <Pressable
      onPress={() => router.navigate('/clubs')}
      accessibilityRole="button"
      accessibilityLabel="Find your people. Explore student organizations"
      style={({ pressed }) => [
        styles.callout,
        { backgroundColor: theme.backgroundSelected },
        pressed && { opacity: Opacity.pressed },
      ]}
    >
      <ThemedText type="bodyBold" themeColor="primary">
        Find your people
      </ThemedText>
      <View style={styles.calloutLink}>
        <ThemedText type="caption" themeColor="primary">
          Explore student organizations
        </ThemedText>
        <Icon name="arrowRight" color={theme.primary} size={Size.iconSmall} />
      </View>
    </Pressable>
  );

  return (
    <Screen width="wide" hasTabBar>
      <ScreenHeader
        eyebrow="CATS / CAMPUS COMPANION"
        title="Hey, Chippewa."
        subtitle="Let’s make room for what matters."
        action={
          <IconButton
            icon="heart"
            variant="filled"
            accessibilityLabel="Saved places"
            onPress={() => router.push('/saved-places')}
          />
        }
      />

      {/* On wide screens the two parts sit side by side; on phones they stack. */}
      <View style={isWide ? styles.columnsWide : styles.columns}>
        <View style={[styles.section, isWide && styles.column]}>
          {/* Only the card with today's date depends on data. The rest of Home always works,
              even while loading or after an error (spec). */}
          {status === 'loading' && (
            <Skeleton height={Size.skeletonHeroHeight} borderRadius={Radius.hero} />
          )}
          {status === 'error' && (
            <InfoNote
              variant="error"
              title="Today’s plan didn’t load"
              message="Your shortcuts below still work."
              actionLabel="Try again"
              onAction={retry}
            />
          )}
          {status === 'ready' && summary && (
            <HeroCard
              eyebrow={formatLongDate(summary.today).toUpperCase()}
              title={summary.heroTitle}
              linkLabel="View your schedule"
              onPress={() => router.navigate('/schedule')}
            />
          )}

          {/* Wide screens: under the date card. Phones: at the bottom, as in Figma. */}
          {isWide && findYourPeople}
        </View>

        <View style={[styles.section, isWide && styles.column]}>
          <SectionHeading title="What do you need today?" />
          {ACTIONS.map((action) => (
            <ActionRow
              key={action.number}
              leadingLabel={action.number}
              title={action.title}
              subtitle={action.subtitle}
              onPress={() => router.push(action.href)}
            />
          ))}
        </View>

        {!isWide && findYourPeople}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  columns: {
    gap: Spacing.xl,
  },
  columnsWide: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.xl,
  },
  column: {
    flex: 1,
  },
  section: {
    gap: Spacing.md,
  },
  callout: {
    gap: Spacing.xs,
    padding: Spacing.lg,
    borderRadius: Radius.card,
  },
  calloutLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
});
