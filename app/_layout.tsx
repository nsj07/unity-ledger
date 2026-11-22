import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Provider as ReduxProvider, useSelector } from 'react-redux';
import { Stack, useRouter, useSegments } from 'expo-router';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';
import { store } from '../src/store';
import { AuthProvider } from '../src/components/AuthProvider';
import GlobalSyncProvider from '../src/components/GlobalSyncProvider';

import { useColorScheme } from '@/hooks/use-color-scheme';

export const unstable_settings = {
  initialRouteName: '(drawer)',
};

function RootLayoutNav() {
  const colorScheme = useColorScheme();
  const { user, householdId, isLoading } = useSelector((state: any) => state.auth);
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    if (isLoading) return; // Wait until Firebase Auth is done checking

    const inAuthGroup = segments[0] === 'login' || segments[0] === 'signup';
    const inOnboarding = segments[0] === 'onboarding';

    console.log('[ROUTER DEBUG]:', {
      hasUser: !!user,
      householdId,
      inAuthGroup,
      inOnboarding,
      segments
    });

    // We use setTimeout to defer navigation slightly to let the render cycle finish.
    setTimeout(() => {
      if (!user && !inAuthGroup) {
        router.replace('/login');
      } else if (user && !householdId && !inOnboarding) {
        router.replace('/onboarding');
      } else if (user && householdId && inAuthGroup) {
        router.replace('/');
      }
    }, 0);
  }, [user, householdId, isLoading, segments]);

  if (isLoading) {
    return (
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colorScheme === 'dark' ? '#111827' : '#F7F9FC' }}>
          <ActivityIndicator size="large" color="#3B82F6" />
        </View>
        <StatusBar style="auto" />
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack>
        <Stack.Screen name="(drawer)" options={{ headerShown: false }} />
        <Stack.Screen name="login" options={{ headerShown: false }} />
        <Stack.Screen name="signup" options={{ headerShown: false }} />
        <Stack.Screen name="onboarding" options={{ headerShown: false }} />
        <Stack.Screen name="new-transaction" options={{ headerShown: false }} />
        <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
      </Stack>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <ReduxProvider store={store}>
        <AuthProvider>
          <GlobalSyncProvider>
            <RootLayoutNav />
          </GlobalSyncProvider>
        </AuthProvider>
      </ReduxProvider>
    </SafeAreaProvider>
  );
}
