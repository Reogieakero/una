import Svg, { Circle } from 'react-native-svg';
import { colors } from '@/theme';

type Props = { size?: number };

// Soft sun circle decor for login + check-in.
export function SunCorner({ size = 220 }: Props) {
  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <Circle cx={size / 2} cy={size / 2} r={size / 2} fill={colors.sun} />
      <Circle cx={size / 2} cy={size / 2} r={size * 0.36} fill={colors.sunSoft} opacity={0.6} />
    </Svg>
  );
}
