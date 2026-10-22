import { Pressable, Text, StyleSheet, type ViewStyle } from 'react-native';
import { colors, fontFamily, fontSize, buttonRadius, sizes, hitSlop } from '@/theme';

type Variant = 'primary' | 'accent' | 'outline' | 'dark' | 'ghostOnDark' | 'danger' | 'dangerOutline';
type Props = {
  label: string;
  onPress?: () => void;
  variant?: Variant;
  disabled?: boolean;
  style?: ViewStyle;
};

export function Button({ label, onPress, variant = 'primary', disabled, style }: Props) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={hitSlop}
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled ?? false }}
      style={[styles.base, styles[variant], disabled === true && styles.disabled, style]}
    >
      <Text style={[styles.text, textColor[variant], disabled === true && { color: colors.disabledText }]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    height: sizes.buttonHeight,
    paddingHorizontal: 12,
    borderRadius: buttonRadius,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primary: { backgroundColor: colors.blue },
  accent: { backgroundColor: colors.sun },
  outline: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.blue },
  dark: { backgroundColor: colors.ink },
  ghostOnDark: { backgroundColor: 'transparent', borderWidth: 1, borderColor: '#6F8CB8' },
  danger: { backgroundColor: colors.danger },
  dangerOutline: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.danger },
  disabled: { backgroundColor: colors.disabledBg, borderColor: colors.border },
  text: { fontFamily: fontFamily.bold, fontSize: fontSize.sm },
});

const textColor = StyleSheet.create({
  primary: { color: colors.white },
  accent: { color: colors.ink },
  outline: { color: colors.blue },
  dark: { color: colors.white },
  ghostOnDark: { color: colors.white },
  danger: { color: colors.white },
  dangerOutline: { color: colors.danger },
});
