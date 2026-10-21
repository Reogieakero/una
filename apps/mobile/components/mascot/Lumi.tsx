import { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, StyleProp, View, ViewStyle } from 'react-native';
import Svg, { Circle, Ellipse, G, Path } from 'react-native-svg';
import { colors, hitSlop } from '@/theme';
import { DIRS, LOOK_NAMES, REACTIONS } from './poses';
import type { Feel, Look } from './poses';
import type { MascotController } from './useMascot';

// Panda palette. The "black" of the panda is the app's deep blue ink, so it sits in the brand.
const INK = colors.ink;
const FUR = '#FFFFFF';
const FUR_SHADE = '#EEF3FB';
const EAR_INNER = '#3E5C8C';
const SCARF = colors.sun;
const BLUE = colors.blue;
const CHEEK = '#F59E5B';
const TEAR = '#8DBBF0';

/* ------------------------------------------------------------------ */
/* LumiFigure: the pure drawing. Give it a look (0-8) and a feel.      */
/* ------------------------------------------------------------------ */

export interface LumiFigureProps {
  look?: Look;
  feel?: Feel;
  size?: number;
}

export function LumiFigure({ look = 4, feel = 'happy', size = 140 }: LumiFigureProps) {
  const d = DIRS[look];
  const f = REACTIONS[feel];
  const faceT = `translate(${d.fx} ${d.fy + f.dy})`;
  const earT = `translate(${d.fx * 0.4} ${d.fy * 0.4})`;
  const bodyT = `rotate(${d.lean} 100 178)`;
  const pupilT = `translate(${d.px * 0.55} ${d.py * 0.55})`;
  const pupilR = f.rx * 0.62;

  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 200 200"
      accessibilityRole="image"
      accessibilityLabel={`Lumi the panda mascot, feeling ${feel}, looking ${LOOK_NAMES[look]}`}
    >
      <Ellipse cx={100} cy={191} rx={46} ry={7} fill={INK} fillOpacity={0.12} />

      <G transform={bodyT}>
        {/* arms and feet */}
        <G transform={`rotate(${f.armL} 34 122)`}>
          <Ellipse cx={34} cy={140} rx={10} ry={18} fill={INK} stroke={INK} strokeWidth={3} />
        </G>
        <G transform={`rotate(${f.armR} 166 122)`}>
          <Ellipse cx={166} cy={140} rx={10} ry={18} fill={INK} stroke={INK} strokeWidth={3} />
        </G>
        <Ellipse cx={78} cy={180} rx={16} ry={8} fill={INK} stroke={INK} strokeWidth={3} />
        <Ellipse cx={122} cy={180} rx={16} ry={8} fill={INK} stroke={INK} strokeWidth={3} />

        {/* ears */}
        <G transform={earT}>
          <Circle cx={58} cy={58} r={19} fill={INK} stroke={INK} strokeWidth={3} />
          <Circle cx={142} cy={58} r={19} fill={INK} stroke={INK} strokeWidth={3} />
          <Circle cx={58} cy={58} r={8} fill={EAR_INNER} />
          <Circle cx={142} cy={58} r={8} fill={EAR_INNER} />
        </G>

        {/* body and head */}
        <Path
          d="M100 46 C150 46 168 84 168 118 C168 156 140 178 100 178 C60 178 32 156 32 118 C32 84 50 46 100 46Z"
          fill={FUR}
          stroke={INK}
          strokeWidth={3}
          strokeLinejoin="round"
        />
        <Ellipse cx={100} cy={158} rx={42} ry={16} fill={FUR_SHADE} />

        {/* bandana with the blue heart */}
        <Path d="M52 148 Q100 162 148 148 L100 176Z" fill={SCARF} stroke={INK} strokeWidth={3} strokeLinejoin="round" />
        <Path d="M100 169 C94 165 92 160 95 158 C97 157 99 158 100 160 C101 158 103 157 105 158 C108 160 106 165 100 169Z" fill={BLUE} />

        {/* face */}
        <G transform={faceT}>
          <Ellipse cx={55} cy={134} rx={8} ry={5} fill={CHEEK} fillOpacity={0.5} />
          <Ellipse cx={145} cy={134} rx={8} ry={5} fill={CHEEK} fillOpacity={0.5} />

          <Ellipse cx={78} cy={110} rx={14} ry={18} fill={INK} transform="rotate(22 78 110)" />
          <Ellipse cx={122} cy={110} rx={14} ry={18} fill={INK} transform="rotate(-22 122 110)" />

          <Path d="M93 115 Q100 111 107 115 Q104 123 100 124 Q96 123 93 115Z" fill={INK} stroke={INK} strokeWidth={2} strokeLinejoin="round" />

          {f.eyes === 'open' && (
            <G>
              <Ellipse cx={78} cy={110} rx={f.rx} ry={f.ry} fill={FUR} />
              <Ellipse cx={122} cy={110} rx={f.rx} ry={f.ry} fill={FUR} />
              <G transform={pupilT}>
                <Circle cx={78} cy={110} r={pupilR} fill={INK} />
                <Circle cx={122} cy={110} r={pupilR} fill={INK} />
                <Circle cx={79.6} cy={107.6} r={1.9} fill={FUR} />
                <Circle cx={123.6} cy={107.6} r={1.9} fill={FUR} />
              </G>
            </G>
          )}

          {f.eyes === 'arc' && (
            <G fill="none" stroke={FUR} strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round">
              <Path d={f.arcL} />
              <Path d={f.arcR} />
            </G>
          )}

          {f.eyes === 'heart' && (
            <G fill={SCARF} stroke={SCARF} strokeWidth={1} strokeLinejoin="round">
              <Path d="M78 118 C69 112 66 106 70 102 C73 99 77 101 78 104 C79 101 83 99 86 102 C90 106 87 112 78 118Z" />
              <Path d="M122 118 C113 112 110 106 114 102 C117 99 121 101 122 104 C123 101 127 99 130 102 C134 106 131 112 122 118Z" />
            </G>
          )}

          {f.brows && (
            <G fill="none" stroke={INK} strokeWidth={3} strokeLinecap="round">
              <Path d="M64 88 L88 79" />
              <Path d="M112 79 L136 88" />
            </G>
          )}

          {f.tear && (
            <Path d="M62 130 C58 136 58 140 62 141 C66 140 66 136 62 130Z" fill={TEAR} stroke={INK} strokeWidth={1.5} strokeLinejoin="round" />
          )}

          <Path
            d={f.mouth}
            fill={f.mouthFilled ? INK : 'none'}
            stroke={INK}
            strokeWidth={3.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </G>
      </G>

      {f.zzz && (
        <G fill="none" stroke={INK} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
          <Path d="M148 66 h12 l-12 14 h12" />
          <Path d="M166 44 h9 l-9 10 h9" />
        </G>
      )}

      {f.floatHeart && (
        <Path
          d="M162 40 C153 34 151 28 155 25 C158 23 161 25 162 27 C163 25 166 23 169 25 C173 28 171 34 162 40Z"
          fill={BLUE}
          stroke={INK}
          strokeWidth={1.5}
          strokeLinejoin="round"
        />
      )}

      {f.sparkles && (
        <G fill={SCARF} stroke={INK} strokeWidth={2} strokeLinejoin="round">
          <Path d="M18 38 l3 8 8 3 -8 3 -3 8 -3 -8 -8 -3 8 -3z" />
          <Path d="M184 24 l2.5 6 6 2.5 -6 2.5 -2.5 6 -2.5 -6 -6 -2.5 6 -2.5z" />
        </G>
      )}
    </Svg>
  );
}

/* ------------------------------------------------------------------ */
/* Mascot: Lumi with float, poke squash, optional breathing.           */
/* ------------------------------------------------------------------ */

export interface MascotProps {
  controller: MascotController;
  size?: number;
  /** Slow 4s in / 4s out scale, for the breathing exercise. */
  breathing?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function Mascot({ controller, size = 140, breathing = false, style }: MascotProps) {
  const { look, feel, squash, reducedMotion, poke, setCenter } = controller;
  const box = useRef<View>(null);
  const float = useRef(new Animated.Value(0)).current;
  const breath = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reducedMotion) {
      float.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(float, { toValue: 1, duration: 1700, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(float, { toValue: 0, duration: 1700, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [float, reducedMotion]);

  useEffect(() => {
    if (!breathing || reducedMotion) {
      breath.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(breath, { toValue: 1, duration: 4000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(breath, { toValue: 0, duration: 4000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [breath, breathing, reducedMotion]);

  const onLayout = () => {
    box.current?.measureInWindow((x, y, w, h) => setCenter(x + w / 2, y + h * 0.45, w));
  };

  const floatY = float.interpolate({ inputRange: [0, 1], outputRange: [0, -6] });
  const scaleX = squash.interpolate({ inputRange: [0, 1], outputRange: [1, 1.07] });
  const scaleY = squash.interpolate({ inputRange: [0, 1], outputRange: [1, 0.9] });
  const sink = squash.interpolate({ inputRange: [0, 1], outputRange: [0, size * 0.05] });
  const breathScale = breath.interpolate({ inputRange: [0, 1], outputRange: [0.95, 1.05] });

  return (
    <View ref={box} onLayout={onLayout} style={[{ width: size, height: size }, style]}>
      <Animated.View style={{ transform: [{ translateY: floatY }] }}>
        <Pressable
          onPress={poke}
          hitSlop={hitSlop}
          accessibilityRole="button"
          accessibilityLabel="Poke Lumi"
        >
          <Animated.View
            style={{ transform: [{ translateY: sink }, { scaleX }, { scaleY }, { scale: breathScale }] }}
          >
            <LumiFigure look={look} feel={feel} size={size} />
          </Animated.View>
        </Pressable>
      </Animated.View>
    </View>
  );
}
