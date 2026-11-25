import { StyleSheet, View } from 'react-native';

import { ActionRow } from '@/shared/components/ActionRow';
import { ThemedText } from '@/shared/components/ThemedText';
import { Radius, Size, type ThemeColor } from '@/shared/constants/theme';
import { useTheme } from '@/shared/hooks/useTheme';

import { Organization, OrganizationCategory } from './types';

// The badge color for each category.
const CATEGORY_BACKGROUNDS: Record<OrganizationCategory, ThemeColor> = {
  technology: 'technologyBackground',
  outdoors: 'outdoorsBackground',
  arts: 'artsBackground',
};

type OrganizationRowProps = {
  organization: Organization;
  onPress: () => void;
};

// One organization in the Clubs list: initials badge, name, and a short description.
export function OrganizationRow({ organization, onPress }: OrganizationRowProps) {
  const theme = useTheme();

  return (
    <ActionRow
      title={organization.name}
      subtitle={`${organization.categoryLabel} · ${organization.shortDescription}`}
      onPress={onPress}
      minHeight={Size.organizationRowMinHeight}
      leading={
        <View
          style={[
            styles.badge,
            { backgroundColor: theme[CATEGORY_BACKGROUNDS[organization.category]] },
          ]}
        >
          <ThemedText type="bodyBold" themeColor="primary">
            {organization.initials}
          </ThemedText>
        </View>
      }
    />
  );
}

const styles = StyleSheet.create({
  badge: {
    width: Size.badge,
    height: Size.badge,
    borderRadius: Radius.control,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
