import { View, type ViewProps, StyleSheet } from 'react-native';
import { colors, cardRadius, cardShadow, spacing } from '@/theme';

export function Card({ style, ...rest }: ViewProps) {
  return <View {...rest} style={[styles.card, style]} />;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: cardRadius,
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.creamLine,
    ...cardShadow,
  },
});
