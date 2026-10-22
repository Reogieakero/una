import { View, Text, StyleSheet } from 'react-native';
import { colors, fontFamily, fontSize, radius, spacing } from '@/theme';

/**
 * DB statuses (`appointments.status`) with student-facing labels. Kept as a
 * plain string map so realtime/refresh rows from Supabase render without casts.
 */
const TONES: Record<string, { label: string; bg: string }> = {
  pending: { label: 'Pending', bg: colors.sunSoft },
  assigned: { label: 'Assigned', bg: colors.sky },
  confirmed: { label: 'Confirmed', bg: colors.sky },
  completed: { label: 'Completed', bg: colors.disabledBg },
  cancelled: { label: 'Cancelled', bg: colors.disabledBg },
  rejected: { label: 'Rejected', bg: colors.disabledBg },
  no_show: { label: 'No-show', bg: colors.disabledBg },
};

export function StatusChip({ status }: { status: string }) {
  const tone = TONES[status] ?? { label: status.replace(/_/g, ' '), bg: colors.disabledBg };
  return (
    <View style={[styles.base, { backgroundColor: tone.bg }]}>
      <Text style={styles.text}>{tone.label}</Text>
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
