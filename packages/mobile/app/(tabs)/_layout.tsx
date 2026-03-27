import { Tabs } from 'expo-router';
import { Text } from 'react-native';

const icon = (emoji: string) => () => <Text style={{ fontSize: 20 }}>{emoji}</Text>;

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ headerShown: true, tabBarActiveTintColor: '#4285F4' }}>
      <Tabs.Screen name="discover"  options={{ title: 'Discover',  tabBarIcon: icon('🔍') }} />
      <Tabs.Screen name="library"   options={{ title: 'My Library', tabBarIcon: icon('📚') }} />
      <Tabs.Screen name="borrows"   options={{ title: 'Borrows',   tabBarIcon: icon('🔄') }} />
      <Tabs.Screen name="messages"  options={{ title: 'Messages',  tabBarIcon: icon('💬') }} />
      <Tabs.Screen name="communities" options={{ title: 'Groups',  tabBarIcon: icon('👥') }} />
    </Tabs>
  );
}
