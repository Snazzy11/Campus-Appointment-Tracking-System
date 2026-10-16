import type { PropsWithChildren } from 'react';
import { View } from 'react-native';
export function SuggestionList({ id, children }: PropsWithChildren<{ id: string }>) { return <View nativeID={id} accessibilityLabel="Building suggestions">{children}</View>; }
