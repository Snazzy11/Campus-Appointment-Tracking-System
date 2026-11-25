import { useState } from 'react';
import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { BorderWidth, Opacity, Radius, Size, Spacing, TextStyles } from '@/shared/constants/theme';
import { useTheme } from '@/shared/hooks/useTheme';

import { ThemedText } from './ThemedText';

type TextFieldProps = {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  // Gray hint shown under the field, e.g. "Use your @cmich.edu email address."
  helperText?: string;
  // When set, the field gets a red border and this message replaces the helper text.
  errorText?: string;
  // Hides what is typed (passwords).
  secure?: boolean;
  disabled?: boolean;
  // These are passed straight to React Native's TextInput.
  keyboardType?: TextInputProps['keyboardType'];
  autoComplete?: TextInputProps['autoComplete'];
  autoCapitalize?: TextInputProps['autoCapitalize'];
  textContentType?: TextInputProps['textContentType'];
};

// A labeled text input with optional helper and error text.
export function TextField({
  label,
  value,
  onChangeText,
  placeholder,
  helperText,
  errorText,
  secure = false,
  disabled = false,
  keyboardType,
  autoComplete,
  autoCapitalize,
  textContentType,
}: TextFieldProps) {
  const theme = useTheme();
  const [isFocused, setIsFocused] = useState(false);
  const hasError = Boolean(errorText);

  // Error wins over focus, so the user can still see what is wrong while fixing it.
  // The spec added the thin default border so the field's edge is visible to low-vision users.
  let borderColor = theme.border;
  let borderWidth: number = BorderWidth.default;
  if (hasError) {
    borderColor = theme.danger;
    borderWidth = BorderWidth.error;
  } else if (isFocused) {
    borderColor = theme.primary;
    borderWidth = BorderWidth.focus;
  }

  return (
    <View style={[styles.container, disabled && { opacity: Opacity.disabled }]}>
      <ThemedText type="caption" themeColor="textSecondary">
        {label}
      </ThemedText>

      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={theme.textSecondary}
        secureTextEntry={secure}
        editable={!disabled}
        keyboardType={keyboardType}
        autoComplete={autoComplete}
        autoCapitalize={autoCapitalize}
        textContentType={textContentType}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        accessibilityLabel={label}
        accessibilityHint={errorText || helperText}
        style={[
          styles.input,
          {
            color: theme.text,
            backgroundColor: theme.backgroundElement,
            borderColor,
            borderWidth,
          },
        ]}
      />

      {hasError ? (
        <ThemedText type="caption" themeColor="danger" accessibilityLiveRegion="polite">
          {errorText}
        </ThemedText>
      ) : (
        helperText && (
          <ThemedText type="caption" themeColor="textSecondary">
            {helperText}
          </ThemedText>
        )
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.sm,
  },
  input: {
    ...TextStyles.body,
    minHeight: Size.inputMinHeight,
    paddingHorizontal: Spacing.lg,
    borderRadius: Radius.control,
  },
});
