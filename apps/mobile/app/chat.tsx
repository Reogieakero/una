import { useRef, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  FlatList,
  TextInput,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import ArrowLeft from 'lucide-react-native/icons/arrow-left';
import Video from 'lucide-react-native/icons/video';
import Send from 'lucide-react-native/icons/send';
import { colors, fontFamily, fontSize, radius, buttonRadius, spacing, sizes, hitSlop, cardShadow } from '@/theme';
import { IconButton } from '@/components/IconButton';
import { ChatBubble } from '@/components/ChatBubble';
import { Button } from '@/components/Button';
import { Chip } from '@/components/Chip';
import { Card } from '@/components/Card';
import { student, counselorReplies, quickReplies } from '@/data/mock';

type Msg = { id: string; mine: boolean; text: string; time: string; kind?: 'text' | 'session' };

const initial: Msg[] = [
  { id: 'm1', mine: false, text: 'Hello! I am the counselor on duty. How can I help today?', time: '9:00 AM' },
  { id: 'm2', mine: true, text: 'Hi, I have been feeling stressed about exams.', time: '9:01 AM' },
  { id: 'm3', mine: false, text: 'Thank you for reaching out. That is a common concern this term.', time: '9:02 AM' },
];

let counter = 100;

export default function Chat() {
  const [msgs, setMsgs] = useState<Msg[]>(initial);
  const [draft, setDraft] = useState('');
  const [typing, setTyping] = useState(false);
  const [replyIdx, setReplyIdx] = useState(0);
  const list = useRef<FlatList<Msg> | null>(null);

  const scrollEnd = () => {
    setTimeout(() => list.current?.scrollToEnd({ animated: true }), 100);
  };

  const send = (text: string) => {
    const clean = text.trim();
    if (clean === '') return;
    counter += 1;
    const mine: Msg = { id: `s-${counter}`, mine: true, text: clean, time: 'Now' };
    const session: Msg | null =
      clean.toLowerCase().includes('book') || msgs.some((m) => m.kind === 'session')
        ? null
        : null;
    void session;
    setMsgs((m) => [...m, mine]);
    setDraft('');
    scrollEnd();
    setTyping(true);
    setTimeout(() => {
      counter += 1;
      const reply: Msg = {
        id: `c-${counter}`,
        mine: false,
        text: counselorReplies[replyIdx % counselorReplies.length] ?? 'I am here to listen.',
        time: 'Now',
      };
      setReplyIdx((i) => i + 1);
      setTyping(false);
      setMsgs((m) => [...m, reply]);
      scrollEnd();
    }, 1200);
  };

  return (
    <View style={styles.root}>
      <SafeAreaView edges={['top', 'bottom']} style={styles.safe}>
        <View style={styles.header}>
          <IconButton label="Go back" onPress={() => router.back()}>
            <ArrowLeft size={sizes.tabIcon} color={colors.white} />
          </IconButton>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>C</Text>
          </View>
          <View style={styles.who}>
            <Text style={styles.whoName}>Counselor on duty</Text>
            <View style={styles.online}>
              <View style={styles.onlineDot} />
              <Text style={styles.onlineText}>Online now</Text>
            </View>
          </View>
          <IconButton label="Start video call" tone="yellow" onPress={() => undefined}>
            <Video size={sizes.tabIcon} color={colors.ink} />
          </IconButton>
        </View>

        <View style={styles.banner}>
          <Text style={styles.bannerText}>
            You are chatting as {student.alias}. Your name stays hidden unless safety requires it.
          </Text>
        </View>

        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={0}
        >
          <FlatList
            ref={list}
            data={msgs}
            keyExtractor={(m) => m.id}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.list}
            onContentSizeChange={scrollEnd}
            ListHeaderComponent={
              <View>
                <View style={styles.day}>
                  <Text style={styles.dayText}>Today</Text>
                </View>
                <Card style={styles.session}>
                  <View style={styles.sessionRow}>
                    <View style={styles.date}>
                      <Text style={styles.dateM}>OCT</Text>
                      <Text style={styles.dateD}>13</Text>
                    </View>
                    <View style={styles.flex}>
                      <Text style={styles.sessionTitle}>Session booked</Text>
                      <Text style={styles.sessionMeta}>2:00 PM · In person</Text>
                    </View>
                    <Button label="View" onPress={() => router.push('/(tabs)/sessions')} />
                  </View>
                </Card>
              </View>
            }
            renderItem={({ item }) => <ChatBubble mine={item.mine} text={item.text} time={item.time} />}
            ListFooterComponent={
              typing ? (
                <View style={styles.typing}>
                  <View style={styles.tdot} />
                  <View style={styles.tdot} />
                  <View style={styles.tdot} />
                </View>
              ) : null
            }
          />

          <View style={styles.quick}>
            {quickReplies.map((q) => (
              <Chip key={q} label={q} onPress={() => send(q)} />
            ))}
          </View>

          <View style={styles.composer}>
            <TextInput
              value={draft}
              onChangeText={setDraft}
              placeholder="Type a message…"
              placeholderTextColor={colors.muted}
              style={styles.input}
              onSubmitEditing={() => send(draft)}
              returnKeyType="send"
            />
            <Pressable
              onPress={() => send(draft)}
              hitSlop={hitSlop}
              accessibilityRole="button"
              accessibilityLabel="Send message"
              style={styles.send}
            >
              <Send size={sizes.tabIcon} color={colors.ink} />
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.cream },
  safe: { flex: 1, backgroundColor: colors.cream },
  header: {
    backgroundColor: colors.blue,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: radius,
    backgroundColor: colors.sun,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontFamily: fontFamily.bold, fontSize: fontSize.lg, color: colors.ink },
  who: { flex: 1 },
  whoName: { fontFamily: fontFamily.bold, fontSize: fontSize.lg, color: colors.white },
  online: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  onlineDot: { width: spacing.sm, height: spacing.sm, borderRadius: 4, backgroundColor: colors.sun },
  onlineText: { fontFamily: fontFamily.regular, fontSize: fontSize.xs, color: colors.white },
  banner: { backgroundColor: colors.sunSoft, padding: spacing.sm, paddingHorizontal: spacing.lg },
  bannerText: { fontFamily: fontFamily.regular, fontSize: fontSize.sm, color: colors.ink },
  flex: { flex: 1 },
  list: { padding: spacing.lg, gap: spacing.sm },
  day: { alignSelf: 'center', backgroundColor: colors.chip, borderRadius: radius, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, marginBottom: spacing.sm },
  dayText: { fontFamily: fontFamily.bold, fontSize: fontSize.xs, color: colors.muted },
  session: { marginBottom: spacing.sm },
  sessionRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  date: { backgroundColor: colors.sun, borderRadius: radius, padding: spacing.sm, alignItems: 'center', minWidth: 48 },
  dateM: { fontFamily: fontFamily.bold, fontSize: fontSize.xxs, color: colors.ink },
  dateD: { fontFamily: fontFamily.bold, fontSize: fontSize.xl, color: colors.ink },
  sessionTitle: { fontFamily: fontFamily.bold, fontSize: fontSize.md, color: colors.ink },
  sessionMeta: { fontFamily: fontFamily.regular, fontSize: fontSize.sm, color: colors.muted },
  typing: {
    flexDirection: 'row',
    gap: spacing.xs,
    backgroundColor: colors.white,
    borderRadius: radius,
    padding: spacing.sm,
    alignSelf: 'flex-start',
    ...cardShadow,
  },
  tdot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.muted },
  quick: { flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  composer: { flexDirection: 'row', gap: spacing.sm, padding: spacing.lg, backgroundColor: colors.white, borderTopWidth: 1, borderTopColor: colors.creamLine, alignItems: 'center' },
  input: {
    flex: 1,
    height: sizes.buttonHeight,
    borderRadius: buttonRadius,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.sm,
    paddingVertical: 0,
    fontFamily: fontFamily.regular,
    fontSize: fontSize.md,
    color: colors.ink,
    textAlignVertical: 'center',
    includeFontPadding: false,
  },
  send: {
    width: sizes.buttonHeight,
    height: sizes.buttonHeight,
    borderRadius: radius,
    backgroundColor: colors.sun,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
