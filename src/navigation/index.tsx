// src/navigation/index.tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuthStore } from '../lib/authStore';
import { Colors, Typography } from '../constants/theme';

// Auth screens
import WelcomeScreen from '../screens/auth/WelcomeScreen';
import SignUpScreen from '../screens/auth/SignUpScreen';
import SignInScreen from '../screens/auth/SignInScreen';
import ForgotPasswordScreen from '../screens/auth/ForgotPasswordScreen';

// Main screens (placeholders — we'll build these next)
import HomeScreen from '../screens/home/HomeScreen';
import ExploreScreen from '../screens/explore/ExploreScreen';
import SnapScreen from '../screens/activity/SnapScreen';
import ProfileScreen from '../screens/home/ProfileScreen';
import SettingsScreen from '../screens/home/SettingsScreen';

// Detail screens
import ActivityDetailScreen from '../screens/activity/ActivityDetailScreen';
import LogActivityScreen from '../screens/activity/LogActivityScreen';
import GiftPlantScreen from '../screens/gift/GiftPlantScreen';
import MessagesScreen from '../screens/messages/MessagesScreen';
import ConversationScreen from '../screens/messages/ConversationScreen';

const AuthStack = createNativeStackNavigator();
const MainStack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

// ─── Tab Icons ────────────────────────────────────────────────────────────────
function TabIcon({ name, focused }: { name: string; focused: boolean }) {
  const icons: Record<string, string> = {
    Home: '⌂',
    Explore: '◉',
    Snap: '◎',
    Profile: '○',
    Settings: '⊞',
  };
  return (
    <View style={[tabStyles.iconWrap, focused && tabStyles.iconWrapActive]}>
      <Text style={[tabStyles.icon, focused && tabStyles.iconActive]}>
        {icons[name] ?? '○'}
      </Text>
    </View>
  );
}

// ─── Main Tabs ────────────────────────────────────────────────────────────────
function MainTabs() {
  const insets = useSafeAreaInsets();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: {
          backgroundColor: 'rgba(7,16,13,0.96)',
          borderTopWidth: 0.5,
          borderTopColor: Colors.border,
          paddingBottom: insets.bottom + 4,
          paddingTop: 6,
          height: 56 + insets.bottom,
        },
        tabBarIcon: ({ focused }) => (
          <TabIcon name={route.name} focused={focused} />
        ),
        tabBarLabel: ({ focused }) => (
          <Text style={[tabStyles.label, focused && tabStyles.labelActive]}>
            {route.name}
          </Text>
        ),
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Explore" component={ExploreScreen} />
      <Tab.Screen name="Snap" component={SnapScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
      <Tab.Screen name="Settings" component={SettingsScreen} />
    </Tab.Navigator>
  );
}

// ─── Main Stack (tabs + modals) ───────────────────────────────────────────────
function MainNavigator() {
  return (
    <MainStack.Navigator screenOptions={{ headerShown: false }}>
      <MainStack.Screen name="Tabs" component={MainTabs} />
      <MainStack.Screen name="ActivityDetail" component={ActivityDetailScreen} />
      <MainStack.Screen name="LogActivity" component={LogActivityScreen}
        options={{ presentation: 'modal' }} />
      <MainStack.Screen name="GiftPlant" component={GiftPlantScreen}
        options={{ presentation: 'card' }} />
      <MainStack.Screen name="Messages" component={MessagesScreen}
        options={{ presentation: 'card' }} />
      <MainStack.Screen name="Conversation" component={ConversationScreen}
        options={{ presentation: 'card' }} />
    </MainStack.Navigator>
  );
}

// ─── Auth Stack ───────────────────────────────────────────────────────────────
function AuthNavigator() {
  return (
    <AuthStack.Navigator screenOptions={{ headerShown: false }}>
      <AuthStack.Screen name="Welcome" component={WelcomeScreen} />
      <AuthStack.Screen name="SignUp" component={SignUpScreen} />
      <AuthStack.Screen name="SignIn" component={SignInScreen} />
      <AuthStack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
    </AuthStack.Navigator>
  );
}

// ─── Root Navigator ───────────────────────────────────────────────────────────
export default function RootNavigator() {
  const { session, initialized } = useAuthStore();

  if (!initialized) return null; // Splash screen handles loading state

  return (
    <NavigationContainer>
      {session ? <MainNavigator /> : <AuthNavigator />}
    </NavigationContainer>
  );
}

const tabStyles = StyleSheet.create({
  iconWrap: {
    width: 30,
    height: 30,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconWrapActive: {
    backgroundColor: 'rgba(200,244,90,0.12)',
  },
  icon: {
    fontSize: 16,
    color: Colors.tx3,
  },
  iconActive: {
    color: Colors.lime,
  },
  label: {
    fontFamily: Typography.headingMedium,
    fontSize: 7,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    color: Colors.tx3,
    marginTop: 2,
  },
  labelActive: {
    color: Colors.lime,
  },
});
