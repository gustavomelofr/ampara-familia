import { SymbolView } from 'expo-symbols';
import { Tabs } from 'expo-router';

import { theme } from '@/src/theme';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.colors.forest,
        tabBarInactiveTintColor: theme.colors.muted,
        tabBarStyle: {
          backgroundColor: theme.colors.surface,
          borderTopColor: theme.colors.border,
          elevation: 0,
          shadowOpacity: 0,
          height: 62,
          paddingTop: 7,
        },
        tabBarLabelStyle: { fontSize: 12, fontWeight: '600' },
      }}>
      <Tabs.Screen name="index" options={{
        title: 'Hoje',
        tabBarIcon: ({ color, size }) => <SymbolView name={{ ios: 'sun.max', android: 'wb_sunny', web: 'wb_sunny' }} tintColor={color} size={size} />,
      }} />
      <Tabs.Screen name="agenda" options={{
        title: 'Agenda',
        tabBarIcon: ({ color, size }) => <SymbolView name={{ ios: 'calendar', android: 'calendar_month', web: 'calendar_month' }} tintColor={color} size={size} />,
      }} />
      <Tabs.Screen name="tasks" options={{
        title: 'Tarefas',
        tabBarIcon: ({ color, size }) => <SymbolView name={{ ios: 'checkmark.circle', android: 'check_circle', web: 'check_circle' }} tintColor={color} size={size} />,
      }} />
      <Tabs.Screen name="more" options={{
        title: 'Mais',
        tabBarIcon: ({ color, size }) => <SymbolView name={{ ios: 'square.grid.2x2', android: 'grid_view', web: 'grid_view' }} tintColor={color} size={size} />,
      }} />
    </Tabs>
  );
}
