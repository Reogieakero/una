import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import Eye from 'lucide-react-native/icons/eye';
import Camera from 'lucide-react-native/icons/camera';
import ChevronRight from 'lucide-react-native/icons/chevron-right';
import {
  removeAvatar,
  setAvatarSharing,
  signAvatarUrl,
  uploadAvatar,
} from '@dorsu/shared-services';
import { getSupabase } from '@/lib/supabase/client';
import { colors, fontFamily, fontSize, radius, spacing, sizes, hitSlop } from '@/theme';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';

type Me = {
  id: string;
  role: string;
  fullName: string;
  alias: string;
  avatarPath: string | null;
  share: boolean;
};

function decodeBase64(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export default function Profile() {
  const [me, setMe] = useState<Me | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<'photo' | 'share' | null>(null);

  const load = useCallback(async () => {
    const supabase = getSupabase();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }
    const [{ data: profile }, { data: student }] = await Promise.all([
      supabase
        .from('profiles')
        .select('role, full_name, avatar_url, share_avatar_with_counselor')
        .eq('id', user.id)
        .maybeSingle(),
      supabase
        .from('students')
        .select('anonymous_alias')
        .eq('profile_id', user.id)
        .maybeSingle(),
    ]);
    const p = profile as {
      role: string | null;
      full_name: string | null;
      avatar_url: string | null;
      share_avatar_with_counselor: boolean | null;
    } | null;
    const s = student as { anonymous_alias: string | null } | null;
    setMe({
      id: user.id,
      role: p?.role ?? 'student',
      fullName: p?.full_name ?? '',
      alias: s?.anonymous_alias ?? '',
      avatarPath: p?.avatar_url ?? null,
      share: p?.share_avatar_with_counselor ?? false,
    });
    setAvatarUrl(await signAvatarUrl(supabase, p?.avatar_url ?? null));
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const changePhoto = async () => {
    if (!me || busy) return;
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Photo access needed', 'Allow photo access to choose a profile picture.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
      base64: true,
    });
    const asset = result.canceled ? null : result.assets?.[0];
    if (!asset) return;
    if (!asset.base64) {
      Alert.alert("Couldn't read that photo", 'Please choose a different image.');
      return;
    }
    const contentType =
      asset.mimeType && ['image/jpeg', 'image/png', 'image/webp'].includes(asset.mimeType)
        ? asset.mimeType
        : 'image/jpeg';
    let bytes: Uint8Array;
    try {
      bytes = decodeBase64(asset.base64);
    } catch {
      Alert.alert("Couldn't read that photo", 'Please choose a different image.');
      return;
    }
    if (bytes.length > 5 * 1024 * 1024) {
      Alert.alert('Photo too large', 'Choose an image under 5 MB.');
      return;
    }
    setBusy('photo');
    try {
      const supabase = getSupabase();
      const path = await uploadAvatar(supabase, {
        profileId: me.id,
        previousPath: me.avatarPath,
        bytes,
        contentType,
      });
      setMe((prev) => (prev ? { ...prev, avatarPath: path } : prev));
      setAvatarUrl(await signAvatarUrl(supabase, path));
    } catch (e) {
      Alert.alert("Couldn't upload photo", e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setBusy(null);
    }
  };

  const confirmRemovePhoto = () => {
    if (!me?.avatarPath || busy) return;
    Alert.alert('Remove profile photo?', undefined, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            setBusy('photo');
            try {
              await removeAvatar(getSupabase(), me.id, me.avatarPath);
              setMe((prev) => (prev ? { ...prev, avatarPath: null } : prev));
              setAvatarUrl(null);
            } catch {
              Alert.alert("Couldn't remove photo", 'Please try again.');
            } finally {
              setBusy(null);
            }
          })();
        },
      },
    ]);
  };

  const toggleShare = async (value: boolean) => {
    if (!me || busy) return;
    setMe((prev) => (prev ? { ...prev, share: value } : prev));
    setBusy('share');
    try {
      await setAvatarSharing(getSupabase(), me.id, value);
    } catch {
      setMe((prev) => (prev ? { ...prev, share: !value } : prev));
      Alert.alert("Couldn't save that setting", 'Please try again.');
    } finally {
      setBusy(null);
    }
  };

  const logout = async () => {
    await getSupabase().auth.signOut().catch(() => undefined);
    router.replace('/login');
  };

  const initial = (me?.fullName || me?.alias || '?').trim().charAt(0).toUpperCase();

  return (
    <View style={styles.root}>
      <SafeAreaView edges={['top', 'bottom']} style={styles.safe}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
          <Card style={styles.card}>
            {loading ? (
              <ActivityIndicator color={colors.blue} style={styles.loader} />
            ) : (
              <>
                <View style={styles.avatarWrap}>
                  {avatarUrl ? (
                    <Image source={{ uri: avatarUrl }} style={styles.avatarImage} />
                  ) : (
                    <View style={styles.avatar}>
                      <Text style={styles.avatarText}>{initial}</Text>
                    </View>
                  )}
                  <Pressable
                    onPress={() => void changePhoto()}
                    disabled={busy === 'photo'}
                    hitSlop={hitSlop}
                    accessibilityRole="button"
                    accessibilityLabel="Change profile photo"
                    style={styles.camera}
                  >
                    {busy === 'photo' ? (
                      <ActivityIndicator size="small" color={colors.ink} />
                    ) : (
                      <Camera size={sizes.tabIcon} color={colors.ink} />
                    )}
                  </Pressable>
                </View>
                <Text style={styles.name}>{me?.fullName || 'Student'}</Text>
                {me?.alias ? <Text style={styles.alias}>{me.alias}</Text> : null}
                <View style={styles.photoActions}>
                  <Pressable
                    onPress={() => void changePhoto()}
                    disabled={busy === 'photo'}
                    hitSlop={hitSlop}
                    accessibilityRole="button"
                  >
                    <Text style={styles.link}>{busy === 'photo' ? 'Uploading…' : 'Change photo'}</Text>
                  </Pressable>
                  {me?.avatarPath ? (
                    <Pressable
                      onPress={confirmRemovePhoto}
                      disabled={busy === 'photo'}
                      hitSlop={hitSlop}
                      accessibilityRole="button"
                    >
                      <Text style={[styles.link, styles.remove]}>Remove photo</Text>
                    </Pressable>
                  ) : null}
                </View>
              </>
            )}
          </Card>

          {me?.role === 'student' ? (
            <>
              <Text style={styles.section}>Privacy</Text>
              <Card style={styles.shareCard}>
                <View style={styles.shareRow}>
                  <View style={styles.shareText}>
                    <Text style={styles.rowTitle}>Share photo with my counselor</Text>
                    <Text style={styles.rowSub}>
                      Off by default. When on, only a counselor who has a session, referral, or chat with you can see it.
                    </Text>
                  </View>
                  <Switch
                    value={me?.share ?? false}
                    onValueChange={(value) => void toggleShare(value)}
                    disabled={!me || busy !== null}
                    accessibilityLabel="Share photo with my counselor"
                    trackColor={{ false: colors.border, true: colors.blue }}
                    thumbColor={colors.white}
                  />
                </View>
              </Card>
            </>
          ) : null}

          <Text style={styles.section}>Settings</Text>
          <Card style={styles.menu}>
            <Pressable
              onPress={() => router.push('/')}
              hitSlop={hitSlop}
              accessibilityRole="button"
              accessibilityLabel="See onboarding screens"
              style={styles.row}
            >
              <View style={styles.rowIcon}>
                <Eye size={sizes.tabIcon} color={colors.blue} />
              </View>
              <View style={styles.rowText}>
                <Text style={styles.rowTitle}>See onboarding screens</Text>
                <Text style={styles.rowSub}>View the welcome screens again</Text>
              </View>
              <ChevronRight size={sizes.tabIcon} color={colors.muted} />
            </Pressable>
          </Card>

          <View style={styles.mt}>
            <Button label="Log out" variant="outline" onPress={() => void logout()} />
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.cream },
  safe: { flex: 1, backgroundColor: colors.cream },
  content: { paddingHorizontal: spacing.lg, paddingBottom: 96, gap: spacing.md },
  card: { alignItems: 'center', gap: spacing.xs },
  loader: { paddingVertical: spacing.xl },
  avatarWrap: { position: 'relative' },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: colors.sun,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImage: { width: 96, height: 96, borderRadius: 48, backgroundColor: colors.chip },
  avatarText: { fontFamily: fontFamily.bold, fontSize: 32, color: colors.ink },
  camera: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: { fontFamily: fontFamily.bold, fontSize: fontSize.xl, color: colors.ink, marginTop: spacing.xs },
  alias: { fontFamily: fontFamily.regular, fontSize: fontSize.sm, color: colors.muted },
  photoActions: { flexDirection: 'row', gap: spacing.lg, marginTop: spacing.xs },
  link: { fontFamily: fontFamily.bold, fontSize: fontSize.sm, color: colors.blue },
  remove: { color: colors.danger },
  section: { fontFamily: fontFamily.bold, fontSize: fontSize.lg, color: colors.ink },
  shareCard: { padding: spacing.md },
  shareRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  shareText: { flex: 1, gap: 2 },
  menu: { padding: 0 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md },
  rowIcon: {
    width: sizes.iconButton,
    height: sizes.iconButton,
    borderRadius: radius,
    backgroundColor: colors.chip,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: { flex: 1 },
  rowTitle: { fontFamily: fontFamily.bold, fontSize: fontSize.sm, color: colors.ink },
  rowSub: { fontFamily: fontFamily.regular, fontSize: fontSize.xs, color: colors.muted },
  mt: { marginTop: spacing.sm },
});
