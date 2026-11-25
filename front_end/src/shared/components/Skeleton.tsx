import { View, type DimensionValue } from 'react-native';

import { Opacity, Radius } from '@/shared/constants/theme';
import { useTheme } from '@/shared/hooks/useTheme';

type SkeletonProps = {
  height?: number;
  // Defaults to the full width of the parent.
  width?: DimensionValue;
  borderRadius?: number;
  // Use instead of `height` to keep a width/height ratio, e.g. for the map.
  aspectRatio?: number;
};

// A faded gray box shown in place of content that is still loading,
// so the screen doesn't jump around when the real content arrives.
export function Skeleton({
  height,
  width = '100%',
  borderRadius = Radius.card,
  aspectRatio,
}: SkeletonProps) {
  const theme = useTheme();

  return (
    <View
      // Screen readers skip it; the screen announces loading in other ways.
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{
        width,
        height: aspectRatio ? undefined : height,
        aspectRatio,
        borderRadius,
        backgroundColor: theme.backgroundSelected,
        opacity: Opacity.skeleton,
      }}
    />
  );
}
