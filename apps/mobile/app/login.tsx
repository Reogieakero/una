import { useState } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import Check from 'lucide-react-native/icons/check';
import Eye from 'lucide-react-native/icons/eye';
import EyeOff from 'lucide-react-native/icons/eye-off';
import Lock from 'lucide-react-native/icons/lock';
import Mail from 'lucide-react-native/icons/mail';
import TriangleAlert from 'lucide-react-native/icons/triangle-alert';
import { loginSchema } from '@dorsu/shared-schemas';
import { getSupabase } from '@/lib/supabase/client';
import { ensureStudentRows, friendlyDbError } from '@/lib/supabase/ensureStudent';
import { continueWithGoogle } from '@/lib/supabase/googleAuth';
import { colors, fontFamily, fontSize, radius, cardRadius, spacing, sizes, hitSlop, cardShadow } from '@/theme';
import { Button } from '@/components/Button';
import { Field } from '@/components/Field';
import { GoogleButton, OrDivider } from '@/components/GoogleButton';
import { SunCorner } from '@/components/illustrations/SunCorner';
import { Mascot } from '@/components/mascot/Lumi';
import { useMascot } from '@/components/mascot/useMascot';

function friendlyLoginError(message: string): string {
  if (/invalid login credentials|invalid.*credentials/i.test(message)) {
    return 'Incorrect email or password.';
  }
  if (/email not confirmed|not confirmed/i.test(message)) {
    return 'Confirm your email first — open the link we sent you, then try again.';
  }
  if (/failed to fetch|network request failed|networkerror/i.test(message)) {
    return "Can't reach the server. Check your connection and try again.";
  }
  return message;
}

export default function Login() {
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [show, setShow] = useState(false);
  const [keep, setKeep] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);
  const lumi = useMascot('happy');

  const google = async () => {
    setError('');
    setGoogleBusy(true);
    try {
      const res = await continueWithGoogle();
      if (res.status === 'cancelled') return;
      if (res.status === 'error') {
        setError(res.message);
        lumi.react('worried', 1500);
        return;
      }
      if (res.next === 'complete-profile') {
        router.replace({ pathname: '/register', params: { google: '1' } });
        return;
      }
      lumi.react('cheer', 800);
      setTimeout(() => router.replace('/(tabs)/home'), 600);
    } finally {
      setGoogleBusy(false);
    }
  };

  const submit = async () => {
    setError('');
    const parsed = loginSchema.safeParse({ email: email.trim(), password: pw });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Please check the form.');
      lumi.react('worried', 1500);
      return;
    }
    setBusy(true);
    try {
      const supabase = getSupabase();
      const v = parsed.data;
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: v.email,
        password: v.password,
      });
      if (signInError) {
        setError(friendlyLoginError(signInError.message));
        lumi.react('worried', 1500);
        return;
      }
      const user = data.user;
      if (!user) {
        setError('Login failed. Please try again.');
        return;
      }
      // Finish any setup left over from signup: with email confirmation ON the
      // `profiles`/`students` inserts could not run until this first login.
      // `ensureStudentRows` is idempotent and reads before writing.
      const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
      const metaString = (key: string) =>
        typeof meta[key] === 'string' ? (meta[key] as string) : undefined;
      const ensured = await ensureStudentRows(supabase, user.id, {
        email: v.email,
        fullName: metaString('full_name') ?? '',
        studentNo: metaString('student_no'),
        program: metaString('program'),
        yearLevel: metaString('year_level'),
      });
      if (!ensured.ok) {
        setError(friendlyDbError(ensured.error));
        lumi.react('worried', 1500);
        return;
      }
      lumi.react('cheer', 800);
      setTimeout(() => router.replace('/(tabs)/home'), 750);
    } catch (e) {
      setError(e instanceof Error ? friendlyLoginError(e.message) : 'Login failed. Please try again.');
      lumi.react('worried', 1500);
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.root} {...lumi.gaze}>
      <View style={styles.sun} pointerEvents="none">
        <SunCorner size={220} />
      </View>
      <SafeAreaView edges={['top', 'bottom']} style={styles.safe}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>Welcome back</Text>
          <Text style={styles.helper}>Sign in with your student account to continue.</Text>

          <View style={styles.mascot}>
            <Mascot controller={lumi} size={96} />
            <Text style={styles.tapme}>Tap me!</Text>
          </View>
          <View style={styles.card}>
            <GoogleButton onPress={() => void google()} busy={googleBusy} disabled={busy} />
            <OrDivider label="OR CONTINUE WITH EMAIL" />
            <Field
              label="Email"
              placeholder="you@student.dorsu.edu.ph"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              icon={<Mail size={sizes.tabIcon} color={colors.muted} />}
            />
            <Field
              label="Password"
              placeholder="Enter password"
              value={pw}
              onChangeText={setPw}
              secureTextEntry={!show}
              icon={<Lock size={sizes.tabIcon} color={colors.muted} />}
              trailing={
                <Pressable
                  onPress={() => setShow((s) => !s)}
                  hitSlop={hitSlop}
                  accessibilityRole="button"
                  accessibilityLabel={show ? 'Hide password' : 'Show password'}
                >
                  {show ? (
                    <EyeOff size={sizes.tabIcon} color={colors.muted} />
                  ) : (
                    <Eye size={sizes.tabIcon} color={colors.muted} />
                  )}
                </Pressable>
              }
            />
            {error !== '' ? (
              <View style={styles.inlineErr}>
                <TriangleAlert size={sizes.tabIcon} color={colors.danger} />
                <Text style={styles.inlineErrText}>{error}</Text>
              </View>
            ) : null}

            <View style={styles.keepRow}>
              <Pressable
                onPress={() => setKeep((k) => !k)}
                hitSlop={hitSlop}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: keep }}
                style={[styles.box, keep && styles.boxOn]}
              >
                {keep ? <Check size={fontSize.sm} color={colors.ink} /> : null}
              </Pressable>
              <Text style={styles.keepText}>Keep me signed in</Text>
              <Pressable hitSlop={hitSlop} accessibilityRole="link" onPress={() => undefined}>
                <Text style={styles.forgot}>Forgot password?</Text>
              </Pressable>
            </View>

            <Button
              label={busy ? 'Logging in…' : 'Log in'}
              disabled={busy || googleBusy}
              onPress={() => void submit()}
              style={styles.loginBtn}
            />
            <View style={styles.divider}>
              <View style={styles.line} />
              <Text style={styles.dividerText}>NEW HERE?</Text>
              <View style={styles.line} />
            </View>
            <Button label="Create student account" variant="outline" onPress={() => router.push('/register')} />
          </View>

          <View style={styles.notice}>
            <Text style={styles.noticeText}>
              You chat under an alias. Your name stays hidden under RA 10173 unless safety requires
              it.
            </Text>
          </View>
          <Text style={styles.footer}>Need help? Contact the Guidance Office, Main Campus.</Text>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.cream },
  sun: { position: 'absolute', top: -60, right: -60 },
  safe: { flex: 1, backgroundColor: colors.cream },
  content: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
    gap: spacing.md,
    flexGrow: 1,
    justifyContent: 'center',
  },
  title: { fontFamily: fontFamily.bold, fontSize: fontSize.xl, color: colors.ink },
  helper: { fontFamily: fontFamily.regular, fontSize: fontSize.md, color: colors.muted },
  mascot: { alignItems: 'center' },
  tapme: { fontFamily: fontFamily.bold, fontSize: fontSize.sm, color: colors.muted, marginTop: spacing.xs },
  card: {
    backgroundColor: colors.surface,
    borderRadius: cardRadius,
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.creamLine,
    gap: spacing.sm,
    ...cardShadow,
  },
  inlineErr: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  inlineErrText: { fontFamily: fontFamily.regular, fontSize: fontSize.xs, color: colors.danger, flex: 1 },
  keepRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  box: {
    width: spacing.lg,
    height: spacing.lg,
    borderRadius: radius,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxOn: { backgroundColor: colors.sun, borderColor: colors.sun },
  check: { fontFamily: fontFamily.bold, fontSize: fontSize.sm, color: colors.ink },
  keepText: { fontFamily: fontFamily.regular, fontSize: fontSize.sm, color: colors.ink, flex: 1 },
  forgot: { fontFamily: fontFamily.bold, fontSize: fontSize.sm, color: colors.blue },
  loginBtn: { alignSelf: 'stretch' },
  divider: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  line: { flex: 1, height: 1, backgroundColor: colors.creamLine },
  dividerText: { fontFamily: fontFamily.bold, fontSize: fontSize.xs, color: colors.muted },
  notice: { backgroundColor: colors.sunSoft, borderRadius: cardRadius, padding: spacing.md },
  noticeText: { fontFamily: fontFamily.regular, fontSize: fontSize.sm, color: colors.ink },
  footer: { fontFamily: fontFamily.regular, fontSize: fontSize.xs, color: colors.muted, textAlign: 'center' },
});
