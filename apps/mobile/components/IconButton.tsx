import { Pressable, StyleSheet, type ViewStyle } from 'react-native';
import type { ReactNode } from 'react';
import { colors, radius, sizes, hitSlop } from '@/theme';

type Props = {
  children: ReactNode;
  onPress?: () => void;
  label: string;
  style?: ViewStyle;
  tone?: 'light' | 'yellow' | 'ink';
};

export function IconButton({ children, onPress, label, style, tone = 'light' }: Props) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={hitSlop}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={[styles.base, tone === 'yellow' && styles.yellow, tone === 'ink' && styles.ink, style]}
    >
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    width: sizes.iconButton,
    height: sizes.iconButton,
    borderRadius: radius,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
  },
  yellow: { backgroundColor: colors.sun, borderColor: colors.sun },
  ink: { backgroundColor: colors.ink, borderColor: colors.ink },
});
