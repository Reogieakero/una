import { View, Pressable, StyleSheet } from 'react-native';
import Star from 'lucide-react-native/icons/star';
import { colors, hitSlop, spacing, sizes } from '@/theme';

type Props = { value: number; onChange: (v: number) => void };

export function StarRating({ value, onChange }: Props) {
  return (
    <View style={styles.row}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Pressable
          key={`star-${n}`}
          onPress={() => onChange(n)}
          hitSlop={hitSlop}
          accessibilityRole="radio"
          accessibilityState={{ checked: value === n }}
          accessibilityLabel={`Rate ${n} star${n > 1 ? 's' : ''}`}
        >
          <Star
            size={sizes.tabIcon}
            strokeWidth={2}
            color={n <= value ? colors.sun : colors.muted}
            fill={n <= value ? colors.sun : 'transparent'}
          />
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
});
