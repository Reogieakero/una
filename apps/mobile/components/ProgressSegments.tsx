import { View, StyleSheet } from 'react-native';
import { colors, radius, spacing } from '@/theme';

type Props = { total: number; current: number };

export function ProgressSegments({ total, current }: Props) {
  return (
    <View style={styles.row}>
      {Array.from({ length: total }, (_, i) => {
        const done = i < current;
        const isCurrent = i === current;
        return (
          <View
            key={`seg-${i}`}
            style={[
              styles.seg,
              done && styles.done,
              isCurrent && styles.now,
              !done && !isCurrent && styles.rest,
            ]}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.xs },
  seg: { flex: 1, height: spacing.xs, borderRadius: radius },
  done: { backgroundColor: colors.blue },
  now: { backgroundColor: colors.sun },
  rest: { backgroundColor: '#E7DDB6' },
});
