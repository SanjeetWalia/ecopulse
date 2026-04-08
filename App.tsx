// App.tsx
import 'react-native-gesture-handler';
import React, { useEffect, useCallback } from 'react';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';
import * as Font from 'expo-font';

import RootNavigator from './src/navigation';
import { useAuthStore } from './src/lib/authStore';

// Keep splash visible while loading
SplashScreen.preventAutoHideAsync();

export default function App() {
  const { initialize, initialized } = useAuthStore();

  useEffect(() => {
    async function prepare() {
      try {
        // Load fonts + initialize auth in parallel
        await Promise.all([
          loadFonts(),
          initialize(),
        ]);
      } catch (e) {
        console.warn('App initialization error:', e);
      }
    }
    prepare();
  }, []);

  const onLayoutRootView = useCallback(async () => {
    if (initialized) {
      await SplashScreen.hideAsync();
    }
  }, [initialized]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }} onLayout={onLayoutRootView}>
      <SafeAreaProvider>
        <StatusBar style="light" backgroundColor="#07100D" />
        <RootNavigator />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

async function loadFonts() {
  // Using system fonts for now — swap with Cabinet Grotesk + Instrument Sans
  // from Google Fonts or a font license once you have the files
  await Font.loadAsync({
    // 'CabinetGrotesk-Black': require('./assets/fonts/CabinetGrotesk-Black.otf'),
    // 'CabinetGrotesk-ExtraBold': require('./assets/fonts/CabinetGrotesk-ExtraBold.otf'),
    // 'CabinetGrotesk-Bold': require('./assets/fonts/CabinetGrotesk-Bold.otf'),
    // 'InstrumentSans-Regular': require('./assets/fonts/InstrumentSans-Regular.ttf'),
    // 'InstrumentSans-Medium': require('./assets/fonts/InstrumentSans-Medium.ttf'),
    // 'InstrumentSans-SemiBold': require('./assets/fonts/InstrumentSans-SemiBold.ttf'),
  });
}
