import { StyleSheet, Text, View } from 'react-native';
import { colors, fontFamily, fontSize, radius, spacing } from '@/theme';

type Props = {
  /** Display name from `counselor_directory()`; undefined when unresolved. */
  name?: string;
  /** `appointments.counselor_id !== null`. */
  assigned: boolean;
};

/** Assignment badge shared by the Home and Sessions session cards. */
export function CounselorPill({ name, assigned }: Props) {
  return (
    <View style={[styles.base, !assigned && styles.muted]}>
      <Text numberOfLines={1} style={[styles.text, !assigned && styles.textMuted]}>
        {assigned ? `Counselor · ${name ?? 'Assigned'}` : 'Awaiting counselor'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    maxWidth: '70%',
    borderRadius: radius,
    backgroundColor: colors.sky,
    paddingHorizontal: spacing.sm,
    height: spacing.lg,
    justifyContent: 'center',
  },
  muted: { backgroundColor: colors.disabledBg },
  text: { fontFamily: fontFamily.bold, fontSize: fontSize.xxs, color: colors.ink },
  textMuted: { color: colors.muted },
});
