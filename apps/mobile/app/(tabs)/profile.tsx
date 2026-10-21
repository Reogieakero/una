import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import Eye from 'lucide-react-native/icons/eye';
import ChevronRight from 'lucide-react-native/icons/chevron-right';
import { colors, fontFamily, fontSize, radius, spacing, sizes, hitSlop } from '@/theme';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { student } from '@/data/mock';

export default function Profile() {
  return (
    <View style={styles.root}>
      <SafeAreaView edges={['top', 'bottom']} style={styles.safe}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
          <Card style={styles.card}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{student.initial}</Text>
            </View>
            <Text style={styles.name}>{student.firstName}</Text>
            <Text style={styles.alias}>{student.alias}</Text>
            <View style={styles.mt}>
              <Button label="Log out" variant="outline" onPress={() => router.replace('/login')} />
            </View>
          </Card>

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
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.cream },
  safe: { flex: 1, backgroundColor: colors.cream },
  content: { paddingHorizontal: spacing.lg, paddingBottom: 96, gap: spacing.md },
  card: { alignItems: 'center', gap: spacing.sm },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: radius,
    backgroundColor: colors.sun,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontFamily: fontFamily.bold, fontSize: fontSize.lg, color: colors.ink },
  name: { fontFamily: fontFamily.bold, fontSize: fontSize.xl, color: colors.ink },
  alias: { fontFamily: fontFamily.regular, fontSize: fontSize.sm, color: colors.muted },
  mt: { marginTop: spacing.sm, alignSelf: 'stretch' },
  section: { fontFamily: fontFamily.bold, fontSize: fontSize.lg, color: colors.ink },
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
});
