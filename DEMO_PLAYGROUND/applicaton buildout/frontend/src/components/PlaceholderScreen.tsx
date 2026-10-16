import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { AppIcon, AppIconName } from './AppIcon';

export function PlaceholderScreen({ title, description, icon }: { title: string; description: string; icon: AppIconName }) {
  return <ScrollView contentContainerStyle={styles.container}>
    <View style={styles.card}>
      <View style={styles.icon}><AppIcon name={icon} color="#4f46e5" /></View>
      <Text style={styles.badge}>COMING SOON</Text>
      <Text accessibilityRole="header" style={styles.title}>{title}</Text>
      <Text style={styles.description}>{description}</Text>
      <Text style={styles.note}>This section is still being built. Messaging is ready to use.</Text>
    </View>
  </ScrollView>;
}
const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f8fafc' },
  card: { maxWidth: 480, width: '100%', padding: 28, gap: 16, backgroundColor: 'white', borderRadius: 24, borderWidth: 1, borderColor: '#e2e8f0' },
  icon: { width: 56, height: 56, borderRadius: 16, backgroundColor: '#eef2ff', alignItems: 'center', justifyContent: 'center' },
  badge: { color: '#4f46e5', fontWeight: '700', fontSize: 12, letterSpacing: 1 },
  title: { fontSize: 28, fontWeight: '700', color: '#172033' },
  description: { fontSize: 17, lineHeight: 26, color: '#475569' },
  note: { fontSize: 14, lineHeight: 22, color: '#64748b' },
});
