import { useCallback, useRef, useState } from "react";
import {
  FlatList,
  Image,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
  type ViewToken,
} from "react-native";
import { useRouter } from "expo-router";
import { Button } from "../components/ui/primitives";
import { markOnboardingSeen } from "../lib/onboarding";

type Slide = {
  key: string;
  title: string;
  body: string;
};

const SLIDES: Slide[] = [
  {
    key: "welcome",
    title: "Welcome to Chekie",
    body: "DOrSU's companion for your mental wellness — check in, reflect, and reach support right from your phone.",
  },
  {
    key: "checkin",
    title: "Daily check-ins",
    body: "Tell Chekie how you feel in seconds and build a healthy habit of noticing your mood.",
  },
  {
    key: "support",
    title: "Support when you need it",
    body: "Book counseling appointments and explore self-care resources — private and student-first.",
  },
];

function SlideVisual({ slideKey }: { slideKey: string }) {
  if (slideKey === "welcome") {
    return (
      <Image
        source={require("../assets/splash.png")}
        className="h-36 w-36"
        resizeMode="contain"
        accessibilityLabel="Chekie panda logo"
      />
    );
  }
  if (slideKey === "checkin") {
    return (
      <View className="flex-row gap-2">
        {["Great", "Okay", "Low"].map((mood, i) => (
          <View
            key={mood}
            className={`rounded-full px-5 py-2.5 ${i === 0 ? "bg-primary-600" : "border border-ink/15 bg-white"}`}
          >
            <Text className={`font-bold ${i === 0 ? "text-white" : "text-ink"}`}>{mood}</Text>
          </View>
        ))}
      </View>
    );
  }
  return (
    <View className="w-64 rounded-3xl border border-ink/10 bg-white p-4 shadow">
      <Text className="text-base font-bold text-ink">Counseling appointment</Text>
      <Text className="mt-1 text-sm text-ink-muted">Guidance Office · confidential</Text>
      <View className="mt-3 rounded-full bg-primary-600 px-6 py-2.5 items-center">
        <Text className="font-bold text-white">Book a session</Text>
      </View>
    </View>
  );
}

/** First-launch getting-started screens. Shown once, then login. */
export default function OnboardingScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const [index, setIndex] = useState(0);
  const listRef = useRef<FlatList<Slide>>(null);
  const isLast = index === SLIDES.length - 1;

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[]; changed: ViewToken[] }) => {
      const first = viewableItems[0];
      if (typeof first?.index === "number") setIndex(first.index);
    },
  );
  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 60 });

  const goTo = useCallback(
    (next: number) => {
      setIndex(next);
      listRef.current?.scrollToOffset({ offset: next * width, animated: true });
    },
    [width],
  );

  const finish = useCallback(async () => {
    await markOnboardingSeen();
    router.replace("/(auth)/login");
  }, [router]);

  return (
    <View className="flex-1 bg-cream">
      <View className="flex-row justify-end px-6 pt-14">
        {!isLast && (
          <TouchableOpacity onPress={finish} hitSlop={12}>
            <Text className="text-base font-bold text-ink-muted">Skip</Text>
          </TouchableOpacity>
        )}
      </View>

      <FlatList
        ref={listRef}
        data={SLIDES}
        keyExtractor={(item) => item.key}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onViewableItemsChanged={onViewableItemsChanged.current}
        viewabilityConfig={viewabilityConfig.current}
        getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
        renderItem={({ item }) => (
          <View style={{ width }} className="items-center justify-center px-8">
            <SlideVisual slideKey={item.key} />
            <Text className="mt-8 text-center text-3xl font-bold text-ink">{item.title}</Text>
            <Text className="mt-3 text-center text-base leading-6 text-ink-muted">{item.body}</Text>
          </View>
        )}
      />

      <View className="px-6 pb-10">
        <View className="mb-6 flex-row items-center justify-center gap-2">
          {SLIDES.map((slide, i) => (
            <View
              key={slide.key}
              className={`h-2 rounded-full ${i === index ? "w-6 bg-primary-600" : "w-2 bg-ink/15"}`}
            />
          ))}
        </View>
        <Button
          title={isLast ? "Get Started" : "Next"}
          onPress={() => (isLast ? void finish() : goTo(index + 1))}
        />
      </View>
    </View>
  );
}
