import { TextInput, StyleSheet } from 'react-native';
export type SearchInputProps = { label?: string; placeholder?: string; value: string; onChange: (value: string) => void; onKey: (key: string) => boolean; expanded: boolean; activeId?: string; listId: string };
export function SearchInput({ label = 'Search campus buildings', placeholder = 'Search buildings or abbreviations', value, onChange, onKey }: SearchInputProps) {
  return <TextInput accessibilityLabel={label} placeholder={placeholder} value={value} onChangeText={onChange} maxLength={120} autoCorrect={false} autoCapitalize="none" autoComplete="off" returnKeyType="search" onSubmitEditing={() => onKey('Enter')} style={styles.input} />;
}
const styles = StyleSheet.create({ input: { minHeight: 46, borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 12, paddingHorizontal: 12, fontSize: 16, color: '#172033', backgroundColor: '#f8fafc', flex: 1 } });
