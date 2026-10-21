import { ColorValue, View } from 'react-native';

export type AppIconName = 'schedule' | 'maps' | 'messaging' | 'rso';

// Small geometric icons keep navigation independent of downloaded icon fonts.
export function AppIcon({ name, color }: { name: AppIconName; color: ColorValue }) {
  const border = { borderColor: color, borderWidth: 1.8 };
  return <View accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ width: 26, height: 26, alignItems: 'center', justifyContent: 'center' }}>
    {name === 'schedule' ? <View style={[border, { width: 21, height: 20, borderRadius: 4 }]}>
      <View style={{ borderBottomWidth: 1.8, borderColor: color, height: 6 }} />
      <View style={{ backgroundColor: color, width: 4, height: 4, margin: 4, borderRadius: 1 }} />
    </View> : name === 'maps' ? <View style={[border, { width: 18, height: 22, borderRadius: 10, borderBottomRightRadius: 2, transform: [{ rotate: '45deg' }], alignItems: 'center', justifyContent: 'center' }]}>
      <View style={[border, { width: 7, height: 7, borderRadius: 4 }]} />
    </View> : name === 'messaging' ? <View style={[border, { width: 23, height: 18, borderRadius: 6, borderBottomLeftRadius: 1, padding: 4, gap: 3 }]}>
      <View style={{ height: 2, backgroundColor: color }} /><View style={{ height: 2, width: 8, backgroundColor: color }} />
    </View> : <View style={{ alignItems: 'center', gap: 2 }}>
      <View style={[border, { width: 9, height: 9, borderRadius: 5 }]} />
      <View style={[border, { width: 22, height: 11, borderTopLeftRadius: 12, borderTopRightRadius: 12, borderBottomWidth: 0 }]} />
    </View>}
  </View>;
}
