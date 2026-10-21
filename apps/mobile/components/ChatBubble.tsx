import { View, Text, StyleSheet } from 'react-native';
import { colors, fontFamily, fontSize, radius, spacing, cardShadow } from '@/theme';

type Props = { mine: boolean; text: string; time: string };

export function ChatBubble({ mine, text, time }: Props) {
  return (
    <View style={[styles.wrap, mine ? styles.right : styles.left]}>
      <View style={[styles.bubble, mine ? styles.mine : styles.theirs]}>
        <Text style={[styles.text, mine ? styles.textMine : styles.textTheirs]}>{text}</Text>
        <Text style={[styles.time, mine ? styles.timeMine : styles.timeTheirs]}>{time}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', marginBottom: spacing.sm },
  left: { justifyContent: 'flex-start' },
  right: { justifyContent: 'flex-end' },
  bubble: { maxWidth: '80%', borderRadius: radius, padding: spacing.sm },
  mine: { backgroundColor: colors.blue, alignSelf: 'flex-end' },
  theirs: { backgroundColor: colors.white, alignSelf: 'flex-start', ...cardShadow },
  text: { fontFamily: fontFamily.regular, fontSize: fontSize.md },
  textMine: { color: colors.white },
  textTheirs: { color: colors.ink },
  time: { fontFamily: fontFamily.regular, fontSize: fontSize.xxs, marginTop: spacing.xs },
  timeMine: { color: colors.white, opacity: 0.8, alignSelf: 'flex-end' },
  timeTheirs: { color: colors.muted, alignSelf: 'flex-end' },
});
