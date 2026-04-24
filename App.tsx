// App.tsx
import 'react-native-gesture-handler';
import React, { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';
import * as Font from 'expo-font';

import RootNavigator from './src/navigation';
import { useAuthStore } from './src/lib/authStore';

// Keep splash visible while loading
SplashScreen.preventAutoHideAsync().catch(() => {
  /* already hidden */
});

export default function App() {
  const { initialize, initialized } = useAuthStore();
  const [appReady, setAppReady] = useState(false);

  // Run async setup once
  useEffect(() => {
    let cancelled = false;

    async function prepare() {
      try {
        await Promise.all([
          loadFonts(),
          initialize(),
        ]);
      } catch (e) {
        console.warn('App initialization error:', e);
      } finally {
        if (!cancelled) setAppReady(true);
      }
    }

    // Safety timeout: force the app to render after 8 seconds
    // even if auth/fonts haven't finished. Prevents permanent splash freeze.
    const safetyTimeout = setTimeout(() => {
      if (!cancelled) {
        console.warn('App init timed out after 8s — proceeding anyway');
        setAppReady(true);
      }
    }, 8000);

    prepare();

    return () => {
      cancelled = true;
      clearTimeout(safetyTimeout);
    };
  }, []);

  // Hide the splash once we're ready — NOT tied to onLayout
  useEffect(() => {
    if (appReady) {
      SplashScreen.hideAsync().catch(() => {
        /* already hidden */
      });
    }
  }, [appReady]);

  // Don't render the tree until ready — splash stays up until then
  if (!appReady) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar style="light" backgroundColor="#07100D" />
        <RootNavigator />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

async function loadFonts() {
  await Font.loadAsync({
    // Placeholder — will swap in Cabinet Grotesk + Instrument Sans later
  });
}