import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useAuthStore } from '../lib/authStore';
import { Colors, Typography } from '../constants/theme';
import WelcomeScreen from '../screens/auth/WelcomeScreen';
import PhoneScreen from '../screens/auth/PhoneScreen';
import OTPVerifyScreen from '../screens/auth/OTPVerifyScreen';
import ProfileSetupScreen from '../screens/auth/ProfileSetupScreen';
import SignInScreen from '../screens/auth/SignInScreen';
import ForgotPasswordScreen from '../screens/auth/ForgotPasswordScreen';
import HomeScreen from '../screens/home/HomeScreen';
import AirScreen from '../screens/air/AirScreen';
import PulseScreen from '../screens/pulse/PulseScreen';
import YouScreen from '../screens/you/YouScreen';
import SnapScreen from '../screens/activity/SnapScreen';
import ActivityDetailScreen from '../screens/activity/ActivityDetailScreen';
import LogActivityScreen from '../screens/activity/LogActivityScreen';

// Redesign v3 (July 2026): 4 tabs + raised center camera.
// Snap presents as a sheet modal — swipe down to dismiss.
// Legacy screens (ProfileScreen, Habits, Explore, GiftPlant, Messages,
// Conversation, WeeklyWrapped, MomentsFeed, CarbonChallenge, Settings)
// are UNROUTED, not deleted. Code preserved in src/screens.

const A = createNativeStackNavigator();
const M = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

const ICONS: Record<string, string> = { Home: '⌂', Air: '≈', Pulse: '∿', You: '○' };

function TabBar({ state, navigation }: any) {
  const renderTab = (route: any, index: number) => {
    const focused = state.index === index;
    return (
      <TouchableOpacity
        key={route.key}
        style={s.tabItem}
        onPress={() => navigation.navigate(route.name)}
        activeOpacity={0.7}
      >
        <View style={[s.iconWrap, focused && s.iconWrapOn]}>
          <Text style={[s.icon, focused && s.iconOn]}>{ICONS[route.name]}</Text>
        </View>
        <Text style={[s.lbl, focused && s.lblOn]}>{route.name}</Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={s.barOuter}>
      <View style={s.bar}>
        {state.routes.slice(0, 2).map((r: any, i: number) => renderTab(r, i))}
        <View style={s.camSlot}>
          <TouchableOpacity
            style={s.camBtn}
            onPress={() => navigation.navigate('Snap')}
            activeOpacity={0.85}
          >
            <Text style={s.camIcon}>◎</Text>
          </TouchableOpacity>
        </View>
        {state.routes.slice(2).map((r: any, i: number) => renderTab(r, i + 2))}
      </View>
    </View>
  );
}

function MainTabs() {
  return (
    <Tab.Navigator tabBar={(p) => <TabBar {...p} />} screenOptions={{ headerShown: false }}>
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Air" component={AirScreen} />
      <Tab.Screen name="Pulse" component={PulseScreen} />
      <Tab.Screen name="You" component={YouScreen} />
    </Tab.Navigator>
  );
}

function MainNav() {
  return (
    <M.Navigator screenOptions={{ headerShown: false }}>
      <M.Screen name="Tabs" component={MainTabs} />
      <M.Screen name="Snap" component={SnapScreen} options={{ presentation: 'modal' }} />
      <M.Screen name="ActivityDetail" component={ActivityDetailScreen} />
      <M.Screen name="LogActivity" component={LogActivityScreen} options={{ presentation: 'modal' }} />
    </M.Navigator>
  );
}

function AuthNav() {
  return (
    <A.Navigator screenOptions={{ headerShown: false }}>
      <A.Screen name="Welcome" component={WelcomeScreen} />
      <A.Screen name="Phone" component={PhoneScreen} />
      <A.Screen name="OTPVerify" component={OTPVerifyScreen} />
      <A.Screen name="ProfileSetup" component={ProfileSetupScreen} />
      <A.Screen name="SignIn" component={SignInScreen} />
      <A.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
    </A.Navigator>
  );
}

export default function RootNavigator() {
  const { session, initialized } = useAuthStore();
  if (!initialized) return null;
  return (
    <NavigationContainer>
      {session ? <MainNav /> : <AuthNav />}
    </NavigationContainer>
  );
}

const s = StyleSheet.create({
  barOuter: { width: '100%', alignItems: 'center', backgroundColor: Colors.bg },
  bar: { width: 390, maxWidth: '100%', flexDirection: 'row', alignItems: 'flex-end', backgroundColor: 'rgba(7,16,13,0.97)', borderTopWidth: 0.5, borderTopColor: Colors.border, paddingVertical: 6, height: 58 },
  tabItem: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 2 },
  iconWrap: { width: 30, height: 30, borderRadius: 9, justifyContent: 'center', alignItems: 'center' },
  iconWrapOn: { backgroundColor: 'rgba(200,244,90,0.12)' },
  icon: { fontSize: 16, color: Colors.tx3 },
  iconOn: { color: Colors.lime },
  lbl: { fontFamily: Typography.headingBold, fontSize: 8, color: Colors.tx3, textTransform: 'uppercase', letterSpacing: 0.3 },
  lblOn: { color: Colors.lime },
  camSlot: { flex: 1.1, alignItems: 'center', justifyContent: 'flex-end' },
  camBtn: { width: 52, height: 52, borderRadius: 26, marginTop: -28, backgroundColor: Colors.lime, justifyContent: 'center', alignItems: 'center', borderWidth: 5, borderColor: Colors.bg },
  camIcon: { fontSize: 22, color: '#071810' },
});
