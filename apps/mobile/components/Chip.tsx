import { Pressable, Text, StyleSheet, type ViewStyle } from 'react-native';
import { colors, fontFamily, fontSize, radius, sizes, hitSlop, spacing } from '@/theme';

type Props = {
  label: string;
  selected?: boolean;
  selectedTone?: 'blue' | 'yellow';
  disabled?: boolean;
  onPress?: () => void;
  style?: ViewStyle;
};

export function Chip({ label, selected, selectedTone = 'blue', disabled, onPress, style }: Props) {
  const tone = selectedTone === 'yellow' ? styles.selectedYellow : styles.selectedBlue;
  const toneText = selectedTone === 'yellow' ? styles.textYellow : styles.textBlue;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={hitSlop}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected ?? false, disabled: disabled ?? false }}
      style={[
        styles.base,
        selected === true ? tone : styles.unselected,
        disabled === true && styles.disabled,
        style,
      ]}
    >
      <Text
        style={[
          styles.text,
          selected === true ? toneText : styles.textIdle,
          disabled === true && styles.textDisabled,
          disabled === true && { textDecorationLine: 'line-through' },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    height: sizes.buttonHeight,
    paddingHorizontal: spacing.md,
    borderRadius: radius,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unselected: { backgroundColor: colors.chip },
  selectedBlue: { backgroundColor: colors.blue },
  selectedYellow: { backgroundColor: colors.sun },
  disabled: { backgroundColor: colors.disabledBg },
  text: { fontFamily: fontFamily.medium, fontSize: fontSize.sm },
  textIdle: { color: colors.ink },
  textBlue: { color: colors.white, fontFamily: fontFamily.bold },
  textYellow: { color: colors.ink, fontFamily: fontFamily.bold },
  textDisabled: { color: colors.disabledText },
});
