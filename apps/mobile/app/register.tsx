import { useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import User from 'lucide-react-native/icons/user';
import Mail from 'lucide-react-native/icons/mail';
import IdCard from 'lucide-react-native/icons/id-card';
import BookOpen from 'lucide-react-native/icons/book-open';
import Lock from 'lucide-react-native/icons/lock';
import Eye from 'lucide-react-native/icons/eye';
import EyeOff from 'lucide-react-native/icons/eye-off';
import Check from 'lucide-react-native/icons/check';
import ChevronDown from 'lucide-react-native/icons/chevron-down';
import X from 'lucide-react-native/icons/x';
import TriangleAlert from 'lucide-react-native/icons/triangle-alert';
import { registerStudentSchema } from '@dorsu/shared-schemas';
import { getSupabase } from '@/lib/supabase/client';
import { ensureStudentRows, friendlyDbError } from '@/lib/supabase/ensureStudent';
import { continueWithGoogle } from '@/lib/supabase/googleAuth';
import { saveStudentDetails } from '@/lib/supabase/studentSetup';
import { colors, fontFamily, fontSize, radius, buttonRadius, cardRadius, spacing, sizes, hitSlop, cardShadow } from '@/theme';
import { Button } from '@/components/Button';
import { Field } from '@/components/Field';
import { Chip } from '@/components/Chip';
import { GoogleButton, OrDivider } from '@/components/GoogleButton';
import { DORSU_FACULTIES, YEAR_LEVELS } from '@/data/academics';

function friendlySignupError(message: string): string {
  if (/failed to fetch|network request failed|networkerror/i.test(message)) {
    return "Can't reach the server. Check your connection and try again.";
  }
  if (/already|exists|registered|duplicate/i.test(message)) {
    return 'An account with this email already exists. Try logging in instead.';
  }
  return message;
}

function passwordChecks(pw: string) {
  return {
    length: pw.length >= 8,
    lower: /[a-z]/.test(pw),
    upper: /[A-Z]/.test(pw),
    digit: /\d/.test(pw),
  };
}

function isStrongPassword(pw: string): boolean {
  const c = passwordChecks(pw);
  return c.length && c.lower && c.upper && c.digit;
}

function ReqRow({ met, text }: { met: boolean; text: string }) {
  return (
    <View style={reqStyles.row}>
      {met ? (
        <Check size={sizes.tabIcon} color={colors.blue} />
      ) : (
        <X size={sizes.tabIcon} color={colors.muted} />
      )}
      <Text style={[reqStyles.text, met && reqStyles.textMet]}>{text}</Text>
    </View>
  );
}

const reqStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  text: { fontFamily: fontFamily.regular, fontSize: fontSize.sm, color: colors.muted },
  textMet: { color: colors.ink },
});

export default function Register() {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [studentNo, setStudentNo] = useState('');
  const [program, setProgram] = useState('');
  const [yearLevel, setYearLevel] = useState('');
  const [pw, setPw] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [programOpen, setProgramOpen] = useState(false);
  const [fieldError, setFieldError] = useState('');
  const [serverError, setServerError] = useState('');
  const [busy, setBusy] = useState(false);
  // Hosted Supabase has email confirmation ON, so signUp() returns no session
  // and the `profiles` insert cannot run yet (RLS needs `authenticated`).
  // Hold the email here and finish setup at first login instead.
  const [awaitingEmail, setAwaitingEmail] = useState<string | null>(null);

  // Google sign-up skips the email/password form, so the school details are
  // collected once here (`/register?google=1`) before the student reaches Home.
  const params = useLocalSearchParams<{ google?: string }>();
  const finishingGoogle = params.google === '1';
  const [googleBusy, setGoogleBusy] = useState(false);
  const [finishBusy, setFinishBusy] = useState(false);
  const [googleProfile, setGoogleProfile] = useState<{ name: string; email: string } | null>(null);

  useEffect(() => {
    if (!finishingGoogle) return;
    let cancelled = false;
    void (async () => {
      const supabase = getSupabase();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (cancelled) return;
      if (!user) {
        router.replace('/login');
        return;
      }
      const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
      const name =
        (typeof meta.full_name === 'string' && meta.full_name) ||
        (typeof meta.name === 'string' && meta.name) ||
        '';
      setGoogleProfile({ name, email: user.email ?? '' });

      // Prefill anything already saved (second visit or a partially filled row).
      const { data } = await supabase
        .from('students')
        .select('student_no, program, year_level')
        .eq('profile_id', user.id)
        .maybeSingle();
      if (cancelled || !data) return;
      const row = data as {
        student_no: string | null;
        program: string | null;
        year_level: string | null;
      };
      if (row.student_no) setStudentNo(row.student_no);
      if (row.program) setProgram(row.program);
      if (row.year_level) setYearLevel(row.year_level);
    })();
    return () => {
      cancelled = true;
    };
  }, [finishingGoogle]);

  const google = async () => {
    setFieldError('');
    setServerError('');
    setGoogleBusy(true);
    try {
      const res = await continueWithGoogle();
      if (res.status === 'cancelled') return;
      if (res.status === 'error') {
        setServerError(res.message);
        return;
      }
      if (res.next === 'complete-profile') {
        router.replace({ pathname: '/register', params: { google: '1' } });
        return;
      }
      router.replace('/(tabs)/home');
    } finally {
      setGoogleBusy(false);
    }
  };

  const finishGoogleSignup = async () => {
    setFieldError('');
    setServerError('');
    const no = registerStudentSchema.shape.studentNo.safeParse(studentNo.trim());
    if (!no.success) {
      setFieldError(no.error.issues[0]?.message ?? 'Check your student number.');
      return;
    }
    const prog = registerStudentSchema.shape.program.safeParse(program.trim());
    if (!prog.success) {
      setFieldError(prog.error.issues[0]?.message ?? 'Choose your faculty.');
      return;
    }
    const year = registerStudentSchema.shape.yearLevel.safeParse(yearLevel.trim());
    if (!year.success) {
      setFieldError(year.error.issues[0]?.message ?? 'Choose your year level.');
      return;
    }
    setFinishBusy(true);
    try {
      const saved = await saveStudentDetails(getSupabase(), {
        studentNo: no.data,
        program: prog.data,
        yearLevel: year.data,
      });
      if (!saved.ok) {
        setServerError(friendlyDbError(saved.error));
        return;
      }
      router.replace('/(tabs)/home');
    } finally {
      setFinishBusy(false);
    }
  };

  const submit = async () => {
    setFieldError('');
    setServerError('');
    if (!isStrongPassword(pw)) {
      setFieldError(
        'Use a strong password — at least 8 characters with upper and lower case letters and a number.',
      );
      return;
    }
    const parsed = registerStudentSchema.safeParse({
      fullName: fullName.trim(),
      email: email.trim(),
      password: pw,
      studentNo: studentNo.trim(),
      program: program.trim(),
      yearLevel: yearLevel.trim(),
    });
    if (!parsed.success) {
      setFieldError(parsed.error.issues[0]?.message ?? 'Please check the form.');
      return;
    }
    if (confirm !== pw) {
      setFieldError("Those passwords don't match. Please try again.");
      return;
    }
    setBusy(true);
    try {
      const supabase = getSupabase();
      const v = parsed.data;
      const { data, error } = await supabase.auth.signUp({
        email: v.email,
        password: v.password,
        options: {
          // Persist every registration field so `ensureStudentRows` can finish
          // the profiles/students rows after the email is confirmed.
          data: {
            full_name: v.fullName,
            student_no: v.studentNo,
            program: v.program,
            year_level: v.yearLevel,
          },
        },
      });
      if (error) {
        setServerError(friendlySignupError(error.message));
        return;
      }
      const user = data.user;
      if (!user) {
        setServerError('Registration failed. Please try again.');
        return;
      }
      // With confirmations ON, Supabase returns an empty identities array for
      // an already-registered email (anti-enumeration) instead of an error.
      if (Array.isArray(user.identities) && user.identities.length === 0) {
        setServerError('An account with this email already exists. Try logging in instead.');
        return;
      }
      if (!data.session) {
        setAwaitingEmail(v.email);
        return;
      }
      const ensured = await ensureStudentRows(supabase, user.id, {
        email: v.email,
        fullName: v.fullName,
        studentNo: v.studentNo,
        program: v.program,
        yearLevel: v.yearLevel,
      });
      if (!ensured.ok) {
        setServerError(
          /row-level security/i.test(ensured.error)
            ? 'Your account was created, but setup could not finish. Log in to complete it.'
            : friendlyDbError(ensured.error),
        );
        return;
      }
      router.replace('/(tabs)/home');
    } catch (e) {
      setServerError(e instanceof Error ? friendlySignupError(e.message) : 'Registration failed. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const err = fieldError !== '' ? fieldError : serverError;

  if (awaitingEmail !== null) {
    return (
      <View style={styles.root}>
        <SafeAreaView edges={['top', 'bottom']} style={styles.safe}>
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
          >
            <Text style={styles.title}>Check your email</Text>
            <Text style={styles.helper}>
              We sent a confirmation link to {awaitingEmail}. Open it, then log in to finish
              setting up your account.
            </Text>
            <View style={styles.card}>
              <Text style={styles.confirmHint}>
                The link can take a minute to arrive. Check your spam folder if you don&apos;t see
                it.
              </Text>
              <Button label="Go to log in" onPress={() => router.replace('/login')} />
            </View>
          </ScrollView>
        </SafeAreaView>
      </View>
    );
  }

  const checks = passwordChecks(pw);
  const score =
    (checks.length ? 1 : 0) +
    (checks.lower && checks.upper ? 1 : 0) +
    (checks.digit ? 1 : 0) +
    (pw.length >= 12 ? 1 : 0);
  const strengthLabel = score <= 1 ? 'Weak' : score <= 3 ? 'Fair' : 'Strong';
  const segFill = score <= 1 ? colors.danger : score <= 3 ? colors.sun : colors.blue;
  const segText = score <= 1 ? colors.danger : score <= 3 ? colors.ink : colors.blue;

  return (
    <View style={styles.root}>
      <SafeAreaView edges={['top', 'bottom']} style={styles.safe}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>
            {finishingGoogle ? 'Finish your account' : 'Create student account'}
          </Text>
          <Text style={styles.helper}>
            {finishingGoogle
              ? 'You are signed in with Google. Add your school details once and you are set.'
              : 'Students only — staff accounts are issued by Guidance.'}
          </Text>

          <View style={styles.card}>
            {finishingGoogle ? (
              <View style={styles.googleNotice}>
                <Text style={styles.googleNoticeTitle} numberOfLines={1}>
                  {googleProfile?.name || 'Google account'}
                </Text>
                {googleProfile?.email ? (
                  <Text style={styles.googleNoticeEmail} numberOfLines={1}>
                    {googleProfile.email}
                  </Text>
                ) : null}
              </View>
            ) : (
              <>
                <GoogleButton
                  label="Sign up with Google"
                  onPress={() => void google()}
                  busy={googleBusy}
                  disabled={busy}
                />
                <OrDivider label="OR SIGN UP WITH EMAIL" />
                <Field
                  label="Full name"
                  placeholder="e.g. Maria Santos"
                  value={fullName}
                  onChangeText={setFullName}
                  icon={<User size={sizes.tabIcon} color={colors.muted} />}
                />
                <Field
                  label="University email"
                  placeholder="you@student.dorsu.edu.ph"
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  icon={<Mail size={sizes.tabIcon} color={colors.muted} />}
                />
              </>
            )}
            <Field
              label="Student number"
              placeholder="e.g. 2021-00001"
              value={studentNo}
              onChangeText={setStudentNo}
              autoCapitalize="characters"
              icon={<IdCard size={sizes.tabIcon} color={colors.muted} />}
            />
            <View>
              <Text style={styles.label}>Program</Text>
              <Pressable
                onPress={() => setProgramOpen(true)}
                hitSlop={hitSlop}
                accessibilityRole="button"
                accessibilityLabel="Select your faculty"
                style={styles.select}
              >
                <BookOpen size={sizes.tabIcon} color={colors.muted} />
                <Text
                  style={[styles.selectText, program === '' && styles.selectPlaceholder]}
                  numberOfLines={1}
                >
                  {program === '' ? 'Select your faculty' : program}
                </Text>
                <ChevronDown size={sizes.tabIcon} color={colors.muted} />
              </Pressable>
            </View>
            <View>
              <Text style={styles.label}>Year level</Text>
              <View style={styles.yearGrid}>
                {YEAR_LEVELS.map((y) => (
                  <Chip
                    key={y}
                    label={y}
                    selected={yearLevel === y}
                    selectedTone="yellow"
                    onPress={() => setYearLevel(y)}
                    style={styles.yearChip}
                  />
                ))}
              </View>
            </View>
            {!finishingGoogle ? (
              <>
                <Field
                  label="Password"
                  placeholder="••••••"
                  value={pw}
                  onChangeText={setPw}
                  secureTextEntry={!showPw}
                  autoCapitalize="none"
                  icon={<Lock size={sizes.tabIcon} color={colors.muted} />}
                  trailing={
                    <Pressable
                      onPress={() => setShowPw((s) => !s)}
                      hitSlop={hitSlop}
                      accessibilityRole="button"
                      accessibilityLabel={showPw ? 'Hide password' : 'Show password'}
                    >
                      {showPw ? (
                        <EyeOff size={sizes.tabIcon} color={colors.muted} />
                      ) : (
                        <Eye size={sizes.tabIcon} color={colors.muted} />
                      )}
                    </Pressable>
                  }
                />
                {pw !== '' ? (
                  <View>
                    <View style={styles.meter}>
                      {[0, 1, 2, 3].map((i) => (
                        <View
                          key={`seg-${i}`}
                          style={[styles.meterSeg, i < score && { backgroundColor: segFill }]}
                        />
                      ))}
                    </View>
                    <Text style={[styles.meterLabel, { color: segText }]}>
                      Password strength: {strengthLabel}
                    </Text>
                    <View style={styles.reqs}>
                      <ReqRow met={checks.length} text="At least 8 characters" />
                      <ReqRow met={checks.lower && checks.upper} text="Upper and lower case letters" />
                      <ReqRow met={checks.digit} text="At least one number" />
                    </View>
                  </View>
                ) : null}
                <Field
                  label="Confirm password"
                  placeholder="••••••"
                  value={confirm}
                  onChangeText={setConfirm}
                  secureTextEntry={!showConfirm}
                  autoCapitalize="none"
                  icon={<Lock size={sizes.tabIcon} color={colors.muted} />}
                  trailing={
                    <Pressable
                      onPress={() => setShowConfirm((s) => !s)}
                      hitSlop={hitSlop}
                      accessibilityRole="button"
                      accessibilityLabel={showConfirm ? 'Hide confirm password' : 'Show confirm password'}
                    >
                      {showConfirm ? (
                        <EyeOff size={sizes.tabIcon} color={colors.muted} />
                      ) : (
                        <Eye size={sizes.tabIcon} color={colors.muted} />
                      )}
                    </Pressable>
                  }
                />
              </>
            ) : null}
            {err !== '' ? (
              <View style={styles.inlineErr}>
                <TriangleAlert size={sizes.tabIcon} color={colors.danger} />
                <Text style={styles.inlineErrText}>{err}</Text>
              </View>
            ) : null}
            <Button
              label={
                finishingGoogle
                  ? finishBusy
                    ? 'Saving…'
                    : 'Finish setup'
                  : busy
                    ? 'Creating account…'
                    : 'Create account'
              }
              disabled={busy || googleBusy || finishBusy}
              onPress={() => void (finishingGoogle ? finishGoogleSignup() : submit())}
            />
          </View>

          <Modal
            visible={programOpen}
            transparent
            animationType="fade"
            onRequestClose={() => setProgramOpen(false)}
          >
            <View style={styles.modalBg}>
              <View style={styles.modal}>
                <Text style={styles.modalTitle}>Select your faculty</Text>
                <ScrollView showsVerticalScrollIndicator={false} style={styles.options}>
                  {DORSU_FACULTIES.map((f) => {
                    const on = program === f;
                    return (
                      <Pressable
                        key={f}
                        onPress={() => {
                          setProgram(f);
                          setProgramOpen(false);
                        }}
                        hitSlop={hitSlop}
                        accessibilityRole="radio"
                        accessibilityState={{ checked: on }}
                        style={[styles.option, on && styles.optionOn]}
                      >
                        <Text style={styles.optionText}>{f}</Text>
                        {on ? <Check size={sizes.tabIcon} color={colors.ink} /> : null}
                      </Pressable>
                    );
                  })}
                </ScrollView>
                <Button label="Close" variant="outline" onPress={() => setProgramOpen(false)} />
              </View>
            </View>
          </Modal>

          {!finishingGoogle ? (
            <View style={styles.footer}>
              <Text style={styles.footerText}>Already have an account?</Text>
              <Pressable hitSlop={hitSlop} accessibilityRole="link" onPress={() => router.back()}>
                <Text style={styles.footerLink}>Log in</Text>
              </Pressable>
            </View>
          ) : null}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.cream },
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
  googleNotice: {
    backgroundColor: colors.chip,
    borderRadius: radius,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: 2,
  },
  googleNoticeTitle: { fontFamily: fontFamily.bold, fontSize: fontSize.md, color: colors.ink },
  googleNoticeEmail: { fontFamily: fontFamily.regular, fontSize: fontSize.xs, color: colors.muted },
  confirmHint: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.sm,
    color: colors.muted,
    marginBottom: spacing.sm,
  },
  label: { fontFamily: fontFamily.bold, fontSize: fontSize.xs, color: colors.ink, marginBottom: spacing.xs },
  select: {
    height: sizes.inputHeight,
    borderRadius: buttonRadius,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.sm,
  },
  selectText: { flex: 1, fontFamily: fontFamily.regular, fontSize: fontSize.md, color: colors.ink },
  selectPlaceholder: { color: colors.muted },
  yearGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  yearChip: { flexGrow: 1, flexBasis: '45%' },
  meter: { flexDirection: 'row', gap: spacing.xs, marginTop: spacing.sm },
  meterSeg: { flex: 1, height: 4, borderRadius: 2, backgroundColor: colors.border },
  meterLabel: { fontFamily: fontFamily.bold, fontSize: fontSize.xs, marginTop: spacing.xs },
  reqs: { marginTop: spacing.xs, gap: spacing.xs },
  modalBg: { flex: 1, backgroundColor: 'rgba(20,49,92,0.5)', justifyContent: 'center', padding: spacing.lg },
  modal: { backgroundColor: colors.white, borderRadius: cardRadius, padding: spacing.lg, gap: spacing.sm, maxHeight: '80%' },
  modalTitle: { fontFamily: fontFamily.bold, fontSize: fontSize.lg, color: colors.ink },
  options: { maxHeight: 320 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius,
    backgroundColor: colors.chip,
    marginBottom: spacing.sm,
  },
  optionOn: { backgroundColor: colors.sun },
  optionText: { flex: 1, fontFamily: fontFamily.medium, fontSize: fontSize.sm, color: colors.ink },
  footer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: spacing.xs },
  footerText: { fontFamily: fontFamily.regular, fontSize: fontSize.sm, color: colors.muted },
  footerLink: { fontFamily: fontFamily.bold, fontSize: fontSize.sm, color: colors.blue },
});
