import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  type GestureResponderEvent,
} from 'react-native';
import { CENTER, FEELS, lookFromPointer, type Feel, type Look } from './poses';

export interface MascotController {
  look: Look;
  feel: Feel;
  squash: Animated.Value;
  reducedMotion: boolean;
  /** Poke: squash animation plus a random half-second reaction. */
  poke: () => void;
  /** Called by Mascot onLayout with its window position. */
  setCenter: (x: number, y: number, w: number) => void;
  /** Show a feel for ms, then fall back to the base (omit ms to stick). */
  react: (feel: Feel, ms?: number) => void;
  /** Change the resting feel. */
  setBase: (feel: Feel) => void;
  /** Spread on the screen root so Lumi follows the finger. */
  gaze: {
    onTouchStart: (e: GestureResponderEvent) => void;
    onTouchMove: (e: GestureResponderEvent) => void;
    onTouchEnd: () => void;
  };
}

const BLINK_MIN_MS = 2400;
const BLINK_MAX_MS = 5200;
const BLINK_MS = 150;
const IDLE_MS = 12000;
const POKE_MS = 600;

function randomFeel(): Feel {
  return FEELS[Math.floor(Math.random() * FEELS.length)];
}

export function useMascot(baseFeel: Feel = 'happy'): MascotController {
  const [base, setBaseState] = useState<Feel>(baseFeel);
  const [feel, setFeel] = useState<Feel>(baseFeel);
  const [look, setLook] = useState<Look>(CENTER);
  const [reducedMotion, setReducedMotion] = useState(false);
  const squash = useRef(new Animated.Value(0)).current;

  const center = useRef({ x: 0, y: 0, w: 0 });
  const baseRef = useRef<Feel>(baseFeel);
  const busyRef = useRef(false); // a timed reaction is showing
  const idleRef = useRef(false); // sleeping after 12s idle
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const later = useCallback((fn: () => void, ms: number) => {
    const t = setTimeout(fn, ms);
    timers.current.push(t);
    return t;
  }, []);

  useEffect(() => {
    return () => {
      timers.current.forEach(clearTimeout);
      timers.current = [];
    };
  }, []);

  // Reduced-motion setting (respected by the hook and by Mascot).
  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((v) => {
        if (alive) setReducedMotion(v);
      })
      .catch(() => undefined);
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReducedMotion);
    return () => {
      alive = false;
      sub.remove();
    };
  }, []);

  const setBase = useCallback(
    (f: Feel) => {
      baseRef.current = f;
      setBaseState(f);
      if (!busyRef.current && !idleRef.current) setFeel(f);
    },
    []
  );

  const react = useCallback(
    (f: Feel, ms?: number) => {
      idleRef.current = false;
      busyRef.current = ms !== undefined;
      setFeel(f);
      if (ms !== undefined) {
        later(() => {
          busyRef.current = false;
          setFeel(baseRef.current);
        }, ms);
      }
    },
    [later]
  );

  // Blink every 2.4-5.2s when nothing else is showing.
  useEffect(() => {
    let alive = true;
    let t: ReturnType<typeof setTimeout>;
    const tick = () => {
      const wait = BLINK_MIN_MS + Math.random() * (BLINK_MAX_MS - BLINK_MIN_MS);
      t = setTimeout(() => {
        if (!alive) return;
        if (!busyRef.current && !idleRef.current) {
          busyRef.current = true;
          setFeel('blink');
          t = setTimeout(() => {
            if (!alive) return;
            busyRef.current = false;
            setFeel(baseRef.current);
            tick();
          }, BLINK_MS);
        } else {
          tick();
        }
      }, wait);
    };
    tick();
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, []);

  // Sleep after 12s with no touch.
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const armIdle = useCallback(() => {
    if (idleTimer.current) clearTimeout(idleTimer.current);
    idleTimer.current = setTimeout(() => {
      idleRef.current = true;
      setFeel('sleepy');
      setLook(CENTER);
    }, IDLE_MS);
  }, []);

  useEffect(() => {
    armIdle();
    return () => {
      if (idleTimer.current) clearTimeout(idleTimer.current);
    };
  }, [armIdle]);

  const track = useCallback(
    (e: GestureResponderEvent) => {
      if (idleRef.current) {
        idleRef.current = false;
        busyRef.current = false;
        setFeel(baseRef.current);
      }
      armIdle();
      const { pageX, pageY } = e.nativeEvent;
      const c = center.current;
      if (c.w <= 0) return;
      const deadZone = Math.max(24, c.w * 0.35);
      setLook(lookFromPointer(pageX - c.x, pageY - c.y, deadZone));
    },
    [armIdle]
  );

  const settle = useCallback(() => {
    later(() => setLook(CENTER), 1500);
  }, [later]);

  const setCenter = useCallback((x: number, y: number, w: number) => {
    center.current = { x, y, w };
  }, []);

  const poke = useCallback(() => {
    react(randomFeel(), POKE_MS);
    if (reducedMotion) return;
    Animated.sequence([
      Animated.timing(squash, { toValue: 1, duration: 120, useNativeDriver: true }),
      Animated.timing(squash, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start();
  }, [react, reducedMotion, squash]);

  return {
    look,
    feel,
    squash,
    reducedMotion,
    poke,
    setCenter,
    react,
    setBase,
    gaze: { onTouchStart: track, onTouchMove: track, onTouchEnd: settle },
  };
}
