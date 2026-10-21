import { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet, Animated, Easing } from 'react-native';
import { colors, fontFamily, fontSize, radius, spacing, hitSlop } from '@/theme';
import { LumiFigure } from './mascot/Lumi';
import { MOOD_TO_FEEL } from './mascot/poses';
import type { Feel, Look } from './mascot/poses';

const moods = [
  { id: 'awful', label: 'Awful' },
  { id: 'low', label: 'Low' },
  { id: 'okay', label: 'Okay' },
  { id: 'good', label: 'Good' },
  { id: 'great', label: 'Great' },
] as const;

export type MoodId = (typeof moods)[number]['id'];

type Props = { value: MoodId | null; onChange: (m: MoodId) => void };

/** Mini Lumi that looks around on its own + breathes (scale only — never floats). */
function MoodMascot({ feel, selected, index }: { feel: Feel; selected: boolean; index: number }) {
  const pulse = useRef(new Animated.Value(0)).current;
  const pop = useRef(new Animated.Value(1)).current;
  const [look, setLook] = useState<Look>(4);

  useEffect(() => {
    const cycle: Look[] = [4, 3, 4, 5, 4, 1, 4, 7, 4, 6, 4, 2];
    let step = index % cycle.length;
    const id = setInterval(() => {
      step = (step + 1) % cycle.length;
      const next = cycle[step];
      if (next !== undefined) setLook(next);
    }, 1600);
    return () => clearInterval(id);
  }, [index]);

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(index * 350),
        Animated.timing(pulse, {
          toValue: 1,
          duration: 1400,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 1400,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse, index]);

  useEffect(() => {
    Animated.spring(pop, {
      toValue: selected ? 1.18 : 1,
      friction: 5,
      tension: 120,
      useNativeDriver: true,
    }).start();
  }, [pop, selected]);

  const breathe = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.06] });

  return (
    <Animated.View style={{ transform: [{ scale: breathe }, { scale: pop }] }}>
      <LumiFigure look={look} feel={feel} size={44} />
    </Animated.View>
  );
}

export function MoodPicker({ value, onChange }: Props) {
  return (
    <View style={styles.row}>
      {moods.map(({ id, label }, index) => {
        const selected = value === id;
        return (
          <Pressable
            key={id}
            onPress={() => onChange(id)}
            hitSlop={hitSlop}
            accessibilityRole="radio"
            accessibilityState={{ checked: selected }}
            accessibilityLabel={label}
            style={[styles.tile, selected && styles.selected]}
          >
            <MoodMascot feel={MOOD_TO_FEEL[id]} selected={selected} index={index} />
            <Text style={[styles.label, selected && styles.labelSelected]}>{label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.sm },
  tile: {
    flex: 1,
    borderRadius: radius,
    backgroundColor: colors.chip,
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
  },
  selected: { backgroundColor: colors.sun },
  label: { fontFamily: fontFamily.medium, fontSize: fontSize.xxs, color: colors.muted },
  labelSelected: { fontFamily: fontFamily.bold, color: colors.ink },
});
