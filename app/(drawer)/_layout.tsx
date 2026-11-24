import { Drawer } from 'expo-router/drawer';
import { useEffect, useRef, useState } from 'react';
import { Platform, Pressable, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
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
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancelScheduledClose = () => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  };

  const scheduleCloseDrawer = (nav: { closeDrawer: () => void }, delayMs = 150) => {
    cancelScheduledClose();
    closeTimerRef.current = setTimeout(() => {
      closeTimerRef.current = null;
      nav.closeDrawer();
    }, delayMs);
  };

  useEffect(() => {
    return () => cancelScheduledClose();
  }, []);

  const isMousePointer = (event: any) => {
    const pointerType = event?.nativeEvent?.pointerType ?? event?.pointerType;
    return !pointerType || pointerType === 'mouse';
  };

  const renderDrawerContent = (props: any) => {
    const { state, descriptors, navigation } = props;
    const focusedRoute = state.routes[state.index];
    const focusedOptions = descriptors[focusedRoute?.key]?.options || {};
    const activeTint = focusedOptions.drawerActiveTintColor || (isDark ? '#60A5FA' : '#2563EB');
    const inactiveTint = focusedOptions.drawerInactiveTintColor || (isDark ? '#E5E7EB' : '#374151');
    const activeBg =
      focusedOptions.drawerActiveBackgroundColor ||
      (isDark ? 'rgba(59, 130, 246, 0.2)' : '#EFF6FF');

    const content = (
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingTop: insets.top + 16,
          paddingBottom: insets.bottom + 16,
          paddingHorizontal: 12,
          gap: 4,
        }}
      >
        {state.routes.map((route: any, index: number) => {
          const isFocused = index === state.index;
          const { options } = descriptors[route.key];
          const label =
            typeof options.drawerLabel === 'string'
              ? options.drawerLabel
              : options.title ?? route.name;
          const color = isFocused ? activeTint : inactiveTint;
          const hoverBg = isDark ? 'rgba(255, 255, 255, 0.08)' : '#F3F4F6';

          return (
            <Pressable
              key={route.key}
              style={(pressState: any) => [
                styles.drawerItem,
                isFocused
                  ? { backgroundColor: activeBg }
                  : pressState.hovered
                    ? { backgroundColor: hoverBg }
                    : null,
                pressState.pressed && { opacity: 0.85 },
              ]}
              onPress={() => {
                cancelScheduledClose();
                navigation.navigate(route.name);
                navigation.closeDrawer();
              }}
            >
              {(pressState: any) => {
                const itemColor =
                  isFocused || pressState.hovered
                    ? isFocused
                      ? activeTint
                      : isDark
                        ? '#FFFFFF'
                        : '#111827'
                    : color;
                return (
                  <>
                    {options.drawerIcon
                      ? options.drawerIcon({ color: itemColor, focused: isFocused, size: 24 })
                      : null}
                    <Text style={[styles.drawerItemLabel, { color: itemColor }]} numberOfLines={1}>
                      {label}
                    </Text>
                  </>
                );
              }}
            </Pressable>
          );
        })}
      </ScrollView>
    );

    if (Platform.OS !== 'web') {
      return content;
    }

    return (
      <View
        style={{ flex: 1 }}
        onPointerEnter={(e) => {
          if (isMousePointer(e)) cancelScheduledClose();
        }}
        onPointerLeave={(e) => {
          if (isMousePointer(e)) scheduleCloseDrawer(navigation, 150);
        }}
      >
        {content}
      </View>
    );
  };

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
        drawerContent={renderDrawerContent}
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
                onPress={() => {
                  cancelScheduledClose();
                  navigation.toggleDrawer();
                }}
                onPointerEnter={
                  Platform.OS === 'web'
                    ? (e) => {
                      if (isMousePointer(e)) {
                        cancelScheduledClose();
                        navigation.openDrawer();
                      }
                    }
                    : undefined
                }
                onPointerLeave={
                  Platform.OS === 'web'
                    ? (e) => {
                      if (isMousePointer(e)) {
                        scheduleCloseDrawer(navigation, 220);
                      }
                    }
                    : undefined
                }
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
  drawerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : null),
  },
  drawerItemLabel: {
    fontSize: 15,
    fontWeight: '600',
    flexShrink: 1,
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
