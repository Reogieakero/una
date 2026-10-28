import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { colors, fontFamily, fontSize, buttonRadius, spacing, sizes, hitSlop } from '@/theme';

/** Official four-colour Google mark, sized for a text button. */
function GoogleMark({ size = sizes.tabIcon }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" accessibilityElementsHidden>
      <Path
        fill="#4285F4"
        d="M23.5 12.27c0-.85-.08-1.66-.22-2.45H12v4.64h6.45a5.52 5.52 0 0 1-2.39 3.62v3h3.87c2.26-2.09 3.57-5.16 3.57-8.81Z"
      />
      <Path
        fill="#34A853"
        d="M12 24c3.24 0 5.96-1.07 7.94-2.91l-3.87-3c-1.08.72-2.45 1.15-4.07 1.15-3.13 0-5.78-2.11-6.73-4.96H1.29v3.1A12 12 0 0 0 12 24Z"
      />
      <Path
        fill="#FBBC05"
        d="M5.27 14.28A7.2 7.2 0 0 1 4.89 12c0-.79.14-1.56.38-2.28v-3.1H1.29a12 12 0 0 0 0 10.76l3.98-3.1Z"
      />
      <Path
        fill="#EA4335"
        d="M12 4.76c1.76 0 3.34.6 4.58 1.8l3.44-3.44A11.97 11.97 0 0 0 12 0 12 12 0 0 0 1.29 6.62l3.98 3.1C6.22 6.87 8.87 4.76 12 4.76Z"
      />
    </Svg>
  );
}

type Props = {
  label?: string;
  busyLabel?: string;
  onPress: () => void;
  busy?: boolean;
  disabled?: boolean;
};

export function GoogleButton({
  label = 'Continue with Google',
  busyLabel = 'Connecting to Google…',
  onPress,
  busy = false,
  disabled = false,
}: Props) {
  const off = busy || disabled;
  return (
    <Pressable
      onPress={onPress}
      disabled={off}
      hitSlop={hitSlop}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: off, busy }}
      style={[styles.base, off && styles.off]}
    >
      {busy ? (
        <ActivityIndicator size="small" color={colors.muted} />
      ) : (
        <GoogleMark />
      )}
      <Text style={styles.text}>{busy ? busyLabel : label}</Text>
    </Pressable>
  );
}

export function OrDivider({ label }: { label: string }) {
  return (
    <View style={styles.divider} accessibilityElementsHidden>
      <View style={styles.line} />
      <Text style={styles.dividerText}>{label}</Text>
      <View style={styles.line} />
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    height: sizes.inputHeight,
    borderRadius: buttonRadius,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  off: { opacity: 0.6 },
  text: { fontFamily: fontFamily.bold, fontSize: fontSize.sm, color: colors.ink },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginVertical: spacing.xs,
  },
  line: { flex: 1, height: 1, backgroundColor: colors.creamLine },
  dividerText: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.xxs,
    color: colors.muted,
    letterSpacing: 0.8,
  },
});
