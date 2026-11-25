import { StyleSheet, View } from 'react-native';

import { Icon } from '@/shared/components/Icon';
import { ThemedText } from '@/shared/components/ThemedText';
import { Radius, Ratio, Size, Spacing } from '@/shared/constants/theme';
import { useTheme } from '@/shared/hooks/useTheme';

import { CampusMap as CampusMapData, MapPoint, MapRect, MapRoute } from './types';

type CampusMapProps = {
  map: CampusMapData;
  // Leave out to show the map without a route.
  route?: MapRoute | null;
};

// Turns a number like 45 into the string '45%', which React Native understands as a percentage.
function percent(value: number): `${number}%` {
  return `${value}%`;
}

// Absolute-position style for a rectangle given in percentages.
function rectStyle(rect: MapRect) {
  return {
    left: percent(rect.left),
    top: percent(rect.top),
    width: percent(rect.width),
    height: percent(rect.height),
  };
}

// Style that centers an element of `size` on a point. The negative margins move it back by half
// its size, because `left`/`top` place the element's top-left corner on the point.
function centeredOn(point: MapPoint, size: number) {
  return {
    left: percent(point.x),
    top: percent(point.y),
    width: size,
    height: size,
    marginLeft: -size / 2,
    marginTop: -size / 2,
  };
}

// The illustrative campus map from the design, drawn with plain Views.
// It is a picture with a sample route, NOT real GPS.
export function CampusMap({ map, route }: CampusMapProps) {
  const theme = useTheme();
  const stroke = Size.mapRouteStroke;

  const description = route
    ? `Illustrative campus map. A sample walking route goes from the green dot to the ${route.destinationName}.`
    : 'Illustrative campus map.';

  return (
    <View
      style={[styles.map, { backgroundColor: theme.mapGround }]}
      accessible
      accessibilityRole="image"
      accessibilityLabel={description}
    >
      {map.roads.map((road, index) => (
        <View
          key={`road-${index}`}
          style={[styles.absolute, rectStyle(road), { backgroundColor: theme.backgroundElement }]}
        />
      ))}

      {map.buildings.map((building) => (
        <View
          key={building.id}
          style={[
            styles.absolute,
            styles.building,
            rectStyle(building.rect),
            { backgroundColor: building.kind === 'park' ? theme.mapPark : theme.mapBuilding },
          ]}
        >
          <ThemedText type="tabLabel" themeColor="mapBuildingText" numberOfLines={1}>
            {building.label}
          </ThemedText>
        </View>
      ))}

      {/* The route is drawn as one thin straight line per step. */}
      {route &&
        route.path.slice(1).map((end, index) => {
          const start = route.path[index];
          const isHorizontal = start.y === end.y;
          const lineStyle = isHorizontal
            ? {
                left: percent(Math.min(start.x, end.x)),
                top: percent(start.y),
                width: percent(Math.abs(end.x - start.x)),
                height: stroke,
                marginTop: -stroke / 2,
              }
            : {
                left: percent(start.x),
                top: percent(Math.min(start.y, end.y)),
                width: stroke,
                height: percent(Math.abs(end.y - start.y)),
                marginLeft: -stroke / 2,
              };
          return (
            <View
              key={`line-${index}`}
              style={[styles.absolute, lineStyle, { backgroundColor: theme.primary }]}
            />
          );
        })}

      {/* A small square on every corner of the route fills the gap where two lines meet. */}
      {route &&
        route.path.map((point, index) => (
          <View
            key={`corner-${index}`}
            style={[styles.absolute, centeredOn(point, stroke), { backgroundColor: theme.primary }]}
          />
        ))}

      {route && (
        <>
          {/* Green starting dot (a sample starting point, not your location). */}
          <View
            style={[
              styles.absolute,
              styles.circle,
              centeredOn(route.path[0], Size.mapOriginDot),
              { backgroundColor: theme.success },
            ]}
          >
            <View style={[styles.originCenter, { backgroundColor: theme.backgroundElement }]} />
          </View>

          {/* Maroon destination marker with a letter. */}
          <View
            style={[
              styles.absolute,
              styles.circle,
              centeredOn(route.markerPosition, Size.mapMarker),
              { backgroundColor: theme.primary },
            ]}
          >
            <ThemedText type="bodyBold" themeColor="onPrimary">
              {route.marker}
            </ThemedText>
          </View>
        </>
      )}

      <View style={[styles.north, { backgroundColor: theme.backgroundElement }]}>
        <ThemedText type="eyebrow">N</ThemedText>
        <Icon name="north" color={theme.text} size={Size.mapNorthIcon} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  map: {
    width: '100%',
    aspectRatio: Ratio.mapWidthToHeight,
    borderRadius: Radius.map,
    overflow: 'hidden',
  },
  absolute: {
    position: 'absolute',
  },
  building: {
    borderRadius: Radius.mapBuilding,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xxs,
  },
  circle: {
    borderRadius: Radius.pill,
    justifyContent: 'center',
    alignItems: 'center',
  },
  originCenter: {
    width: Size.mapOriginDotCenter,
    height: Size.mapOriginDotCenter,
    borderRadius: Radius.pill,
  },
  north: {
    position: 'absolute',
    right: Spacing.md,
    bottom: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xxs,
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    borderRadius: Radius.control,
  },
});
