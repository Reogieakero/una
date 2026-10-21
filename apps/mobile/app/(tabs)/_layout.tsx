import { Tabs } from 'expo-router';
import { TabBar } from '@/components/TabBar';

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false }} tabBar={() => <TabBar />}>
      <Tabs.Screen name="home" />
      <Tabs.Screen name="sessions" />
      <Tabs.Screen name="profile" />
    </Tabs>
  );
}
