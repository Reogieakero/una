// poses.ts: the "sprite sheet" for Lumi the panda, as data.
// 9 head directions (3x3, row-major) and 9 reactions. Same idea as a sprite-sheet mascot,
// but every pose is vector parameters, so it stays sharp at any size.

export type Look = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
export const CENTER: Look = 4;

export const LOOK_NAMES = [
  'up-left', 'up', 'up-right',
  'left', 'center', 'right',
  'down-left', 'down', 'down-right',
] as const;

export type Feel = 'happy' | 'blink' | 'surprised' | 'love' | 'cheer' | 'calm' | 'sleepy' | 'worried' | 'sad';
export const FEELS: readonly Feel[] = ['happy', 'blink', 'surprised', 'love', 'cheer', 'calm', 'sleepy', 'worried', 'sad'];

export interface DirPose {
  fx: number; // face offset x
  fy: number; // face offset y
  lean: number; // body lean, degrees
  px: number; // pupil offset x
  py: number; // pupil offset y
}

export const DIRS: readonly DirPose[] = [
  { fx: -9, fy: -6, lean: -3, px: -3.5, py: -3.5 }, { fx: 0, fy: -7, lean: 0, px: 0, py: -4.5 }, { fx: 9, fy: -6, lean: 3, px: 3.5, py: -3.5 },
  { fx: -11, fy: 0, lean: -4, px: -4.5, py: 0 }, { fx: 0, fy: 0, lean: 0, px: 0, py: 0 }, { fx: 11, fy: 0, lean: 4, px: 4.5, py: 0 },
  { fx: -9, fy: 6, lean: -3, px: -3.5, py: 3.5 }, { fx: 0, fy: 7, lean: 0, px: 0, py: 4.5 }, { fx: 9, fy: 6, lean: 3, px: 3.5, py: 3.5 },
];

export interface ReactionPose {
  eyes: 'open' | 'arc' | 'heart';
  rx: number; // eye white radius x (open eyes)
  ry: number; // eye white radius y
  arcL: string; // closed-eye strokes, drawn white on the dark eye patch
  arcR: string;
  mouth: string;
  mouthFilled: boolean;
  armL: number; // degrees, swing about the left shoulder
  armR: number;
  dy: number; // head nudge
  brows?: boolean;
  tear?: boolean;
  zzz?: boolean;
  floatHeart?: boolean;
  sparkles?: boolean;
}

const NO_ARC = { arcL: 'M70 110 H86', arcR: 'M114 110 H130' };

export const REACTIONS: Record<Feel, ReactionPose> = {
  happy: { eyes: 'open', rx: 7, ry: 9, ...NO_ARC, mouth: 'M86 130 Q100 142 114 130', mouthFilled: false, armL: 12, armR: -12, dy: 0 },
  blink: { eyes: 'arc', rx: 7, ry: 9, arcL: 'M70 110 H86', arcR: 'M114 110 H130', mouth: 'M86 130 Q100 142 114 130', mouthFilled: false, armL: 12, armR: -12, dy: 0 },
  surprised: { eyes: 'open', rx: 8.5, ry: 11, ...NO_ARC, mouth: 'M96 134 a4 5.5 0 1 0 8 0 a4 5.5 0 1 0 -8 0', mouthFilled: true, armL: 38, armR: -38, dy: -2 },
  love: { eyes: 'heart', rx: 7, ry: 9, ...NO_ARC, mouth: 'M84 130 Q100 148 116 130', mouthFilled: false, armL: -22, armR: 22, dy: 0, floatHeart: true },
  cheer: { eyes: 'arc', rx: 7, ry: 9, arcL: 'M69 114 Q78 102 87 114', arcR: 'M113 114 Q122 102 131 114', mouth: 'M82 128 Q100 156 118 128Z', mouthFilled: true, armL: 150, armR: -150, dy: -2, sparkles: true },
  calm: { eyes: 'arc', rx: 7, ry: 9, arcL: 'M69 108 Q78 116 87 108', arcR: 'M113 108 Q122 116 131 108', mouth: 'M90 131 Q100 138 110 131', mouthFilled: false, armL: 8, armR: -8, dy: 0 },
  sleepy: { eyes: 'arc', rx: 7, ry: 9, arcL: 'M69 110 Q78 114 87 110', arcR: 'M113 110 Q122 114 131 110', mouth: 'M96 134 a3 3.5 0 1 0 6 0 a3 3.5 0 1 0 -6 0', mouthFilled: false, armL: 6, armR: -6, dy: 3, zzz: true },
  worried: { eyes: 'open', rx: 7, ry: 9.5, ...NO_ARC, mouth: 'M88 139 Q94 133 100 139 Q106 145 112 139', mouthFilled: false, armL: -8, armR: 8, dy: 0, brows: true },
  sad: { eyes: 'open', rx: 6.5, ry: 8, ...NO_ARC, mouth: 'M88 142 Q100 131 112 142', mouthFilled: false, armL: 4, armR: -4, dy: 2, brows: true, tear: true },
};

// Pointer or finger angle to one of the 9 head directions.
// Inside the dead zone Lumi looks straight ahead and settles.
const SECTOR: readonly Look[] = [5, 8, 7, 6, 3, 0, 1, 2];

export function lookFromPointer(dx: number, dy: number, deadZone: number): Look {
  if (Math.hypot(dx, dy) <= deadZone) return CENTER;
  const deg = ((Math.atan2(dy, dx) * 180) / Math.PI + 360) % 360;
  return SECTOR[Math.round(deg / 45) % 8];
}

// Mood picker on Home (Awful ... Great) to the matching reaction.
export const MOOD_TO_FEEL: Record<'awful' | 'low' | 'okay' | 'good' | 'great', Feel> = {
  awful: 'worried',
  low: 'sad',
  okay: 'calm',
  good: 'happy',
  great: 'cheer',
};
