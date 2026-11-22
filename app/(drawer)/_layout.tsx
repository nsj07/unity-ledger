import { Drawer } from 'expo-router/drawer';
import { useState } from 'react';
import { Platform, Pressable, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSelector } from 'react-redux';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { useColorScheme } from '@/hooks/use-color-scheme';
import HouseholdProfileModal from '@/src/components/HouseholdProfileModal';

export default function DrawerLayout() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const insets = useSafeAreaInsets();
  const { user, householdName } = useSelector((state: any) => state.auth);
  const [showProfileMenu, setShowProfileMenu] = useState(false);

  const statusBarHeight =
    Platform.OS === 'android'
      ? Math.max(insets.top, StatusBar.currentHeight || 0)
      : insets.top;

  const userInitial = user?.displayName ? user.displayName.trim()[0].toUpperCase() : 'U';

  const renderProfileAvatar = () => (
    <TouchableOpacity
      style={styles.avatarButton}
      onPress={() => setShowProfileMenu(true)}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
    >
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{userInitial}</Text>
      </View>
    </TouchableOpacity>
  );

  const renderHouseholdPill = () => (
    <TouchableOpacity
      style={[styles.householdPill, isDark && styles.householdPillDark]}
      onPress={() => setShowProfileMenu(true)}
      activeOpacity={0.75}
    >
      <IconSymbol name="house.fill" size={16} color={isDark ? '#60A5FA' : '#2563EB'} />
      <Text style={[styles.householdPillText, isDark && styles.householdPillTextDark]} numberOfLines={1}>
        {householdName || 'My Household'}
      </Text>
      <IconSymbol name="chevron.down" size={18} color={isDark ? '#9CA3AF' : '#6B7280'} />
    </TouchableOpacity>
  );

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Drawer
        screenOptions={({ navigation }) => ({
          drawerActiveTintColor: isDark ? '#60A5FA' : '#2563EB',
          drawerInactiveTintColor: isDark ? '#E5E7EB' : '#374151',
          drawerActiveBackgroundColor: isDark ? 'rgba(59, 130, 246, 0.2)' : '#EFF6FF',
          drawerLabelStyle: { fontSize: 15, fontWeight: '600' },
          headerShown: true,
          headerStatusBarHeight: statusBarHeight,
          headerTitleAlign: 'center',
          drawerStyle: { backgroundColor: isDark ? '#1F2937' : '#FFFFFF' },
          headerStyle: { backgroundColor: isDark ? '#111827' : '#FFFFFF' },
          headerTintColor: isDark ? '#FFFFFF' : '#111827',
          headerLeft: ({ tintColor }) => {
            const resolvedTint =
              typeof tintColor === 'string' ? tintColor : isDark ? '#FFFFFF' : '#111827';
            return (
              <Pressable
                onPress={() => navigation.toggleDrawer()}
                onHoverIn={Platform.OS === 'web' ? () => navigation.openDrawer() : undefined}
                style={styles.navToggleButton}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                accessibilityRole="button"
                accessibilityLabel="Open navigation menu"
              >
                <IconSymbol name="line.3.horizontal" size={24} color={resolvedTint} />
              </Pressable>
            );
          },
          headerRight: renderProfileAvatar,
        })}>
        <Drawer.Screen
          name="index"
          options={{
            title: 'Dashboard',
            drawerIcon: ({ color }) => <IconSymbol size={28} name="house.fill" color={color} />,
            headerTitle: renderHouseholdPill,
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
          name="members"
          options={{
            title: 'Memberships',
            drawerIcon: ({ color }) => <IconSymbol size={28} name="person.2.fill" color={color} />,
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

      <HouseholdProfileModal
        visible={showProfileMenu}
        onClose={() => setShowProfileMenu(false)}
      />
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  navToggleButton: {
    marginLeft: 12,
    padding: 8,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  householdPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
    maxWidth: 210,
  },
  householdPillDark: {
    backgroundColor: '#1F2937',
    borderWidth: 1,
    borderColor: '#374151',
  },
  householdPillText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1E3A8A',
    flexShrink: 1,
  },
  householdPillTextDark: {
    color: '#F9FAFB',
  },
  avatarButton: {
    marginRight: 16,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#3B82F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
