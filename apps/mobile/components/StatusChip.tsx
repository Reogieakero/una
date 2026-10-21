import { View, Text, StyleSheet } from 'react-native';
import { colors, fontFamily, fontSize, radius, spacing } from '@/theme';
import type { AppointmentStatus } from '@/data/mock';

type Props = { status: AppointmentStatus };

const bg: Record<AppointmentStatus, string> = {
  Confirmed: colors.sky,
  Pending: colors.sunSoft,
  Completed: colors.disabledBg,
  Canceled: colors.disabledBg,
};

export function StatusChip({ status }: Props) {
  return (
    <View style={[styles.base, { backgroundColor: bg[status] }]}>
      <Text style={styles.text}>{status}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius,
    paddingHorizontal: spacing.sm,
    height: spacing.lg,
    justifyContent: 'center',
    alignSelf: 'flex-start',
  },
  text: { fontFamily: fontFamily.bold, fontSize: fontSize.xxs, color: colors.ink },
});
