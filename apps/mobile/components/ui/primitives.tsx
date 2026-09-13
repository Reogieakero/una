import { Text, TouchableOpacity, View, TextInput } from "react-native";

/** NativeWind-styled primitives — same ui-tokens palette as web. */
export function Button({
  title,
  onPress,
  disabled,
  variant = "primary",
}: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  variant?: "primary" | "accent" | "outline";
}) {
  const base = "rounded-full px-6 py-3 items-center";
  const styles =
    variant === "primary"
      ? "bg-primary-600"
      : variant === "accent"
        ? "bg-accent-400"
        : "border-2 border-ink/15 bg-white";
  const text = variant === "outline" ? "text-ink" : variant === "accent" ? "text-ink" : "text-white";
  return (
    <TouchableOpacity onPress={onPress} disabled={disabled} className={`${base} ${styles} ${disabled ? "opacity-50" : ""}`}>
      <Text className={`font-bold ${text}`}>{title}</Text>
    </TouchableOpacity>
  );
}

export function Card({ children }: { children: React.ReactNode }) {
  return <View className="rounded-3xl border border-ink/10 bg-white p-4 shadow">{children}</View>;
}

export function Field({ label, children, error }: { label: string; children: React.ReactNode; error?: string }) {
  return (
    <View className="mb-3">
      <Text className="mb-1 text-sm font-bold text-ink">{label}</Text>
      {children}
      {error ? <Text className="mt-1 text-xs text-red-600">{error}</Text> : null}
    </View>
  );
}

export function Input(props: React.ComponentProps<typeof TextInput>) {
  return (
    <TextInput
      {...props}
      className="rounded-2xl border border-ink/15 bg-white px-4 py-2.5 text-ink"
      placeholderTextColor="#8BA4C4"
    />
  );
}
