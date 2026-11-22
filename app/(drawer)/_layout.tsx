import { Drawer } from 'expo-router/drawer';
import React from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export default function DrawerLayout() {
  const colorScheme = useColorScheme();

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Drawer
        screenOptions={{
          drawerActiveTintColor: Colors[colorScheme ?? 'light'].tint,
          headerShown: true, // We want the hamburger menu available
          drawerStyle: { backgroundColor: colorScheme === 'dark' ? '#1F2937' : '#FFFFFF' },
          headerStyle: { backgroundColor: colorScheme === 'dark' ? '#111827' : '#FFFFFF' },
          headerTintColor: colorScheme === 'dark' ? '#FFFFFF' : '#111827',
        }}>
        <Drawer.Screen
          name="index"
          options={{
            title: 'Dashboard',
            drawerIcon: ({ color }) => <IconSymbol size={28} name="house.fill" color={color} />,
            headerTitle: '', // Hiding so our custom Greeting component takes center stage
            headerShadowVisible: false,
          }}
        />
        <Drawer.Screen
          name="transactions"
          options={{
            title: 'Transactions',
            drawerIcon: ({ color }) => <IconSymbol size={28} name="arrow.left.arrow.right.circle.fill" color={color} />,
          }}
        />
        <Drawer.Screen
          name="accounts"
          options={{
            title: 'Accounts',
            drawerIcon: ({ color }) => <IconSymbol size={28} name="creditcard.fill" color={color} />,
          }}
        />
        <Drawer.Screen
          name="investments"
          options={{
            title: 'Wealth',
            drawerIcon: ({ color }) => <IconSymbol size={28} name="chart.pie.fill" color={color} />,
          }}
        />
        <Drawer.Screen
          name="analytics"
          options={{
            title: 'Analytics',
            drawerIcon: ({ color }) => <IconSymbol size={28} name="chart.bar.xaxis" color={color} />,
          }}
        />
        <Drawer.Screen
          name="categories"
          options={{
            title: 'Settings',
            drawerIcon: ({ color }) => <IconSymbol size={28} name="gearshape.fill" color={color} />,
          }}
        />
      </Drawer>
    </GestureHandlerRootView>
  );
}
