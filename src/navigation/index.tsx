import React, { useEffect, useState } from 'react';
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
import SignUpScreen from '../screens/auth/SignUpScreen';
import ForgotPasswordScreen from '../screens/auth/ForgotPasswordScreen';
import HomeScreen from '../screens/home/HomeScreen';
import PulseScreen from '../screens/pulse/PulseScreen';
import YouScreen from '../screens/you/YouScreen';
import SnapScreen from '../screens/activity/SnapScreen';
import ActivityDetailScreen from '../screens/activity/ActivityDetailScreen';
import LogActivityScreen from '../screens/activity/LogActivityScreen';
import EcoChatScreen from '../screens/air/EcoChatScreen';
import MemoryScreen from '../screens/you/MemoryScreen';
import OnboardingQuizScreen from '../screens/onboarding/OnboardingQuizScreen';
import StartingPlanScreen from '../screens/onboarding/StartingPlanScreen';
import PaywallScreen from '../screens/paywall/PaywallScreen';
import StreakScreen from '../screens/streak/StreakScreen';
import ChainScreen from '../screens/chain/ChainScreen';
import HeadsUpScreen from '../screens/headsup/HeadsUpScreen';
import TableCardScreen from '../screens/snap/TableCardScreen';
import { useGrowthStore } from '../lib/growthStore';
import { configurePurchases } from '../lib/purchases';
import { SAMPLE_MODE } from '../lib/sample';

// Section M (September 2026): 3 tabs + raised center camera.
//
// v3 shipped four tabs, three of which showed the same number in different
// timeframes — Home was today, Air was this month, Pulse was week/month/year.
// A tab should answer a different question, not a different window of the same
// answer (OBS-013). The scope now lives on the ring inside Today, and Air's
// content moved below the fold there.
//
//   Today — how am I doing right now, and why?
//   Pulse — am I trending, and who is with me?
//   You   — what does the app know, what am I aiming at, what do I pay?
//
// Camera stays centered: it is input, not a destination. Eco-chat is a modal
// off Moko-Avi's line, for the same reason.
//
// Legacy screens (AirScreen, ProfileScreen, Habits, Explore, GiftPlant,
// Messages, Conversation, WeeklyWrapped, MomentsFeed, CarbonChallenge,
// Settings) are UNROUTED, not deleted. Code preserved in src/screens.

const A = createNativeStackNavigator();
const G = createNativeStackNavigator();
const M = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

const ICONS: Record<string, string> = { Today: '◉', Pulse: '∿', You: '○' };

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
        {/* Keeps the camera centred now that the right side holds one tab
            instead of two. */}
        <View style={s.tabItem} pointerEvents="none" />
      </View>
    </View>
  );
}

function MainTabs() {
  return (
    <Tab.Navigator tabBar={(p) => <TabBar {...p} />} screenOptions={{ headerShown: false }}>
      <Tab.Screen name="Today" component={HomeScreen} />
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
      <M.Screen name="EcoChat" component={EcoChatScreen} options={{ presentation: 'modal' }} />
      <M.Screen name="Memory" component={MemoryScreen} />
      <M.Screen name="Streak" component={StreakScreen} />
      <M.Screen name="Chain" component={ChainScreen} />
      <M.Screen name="HeadsUp" component={HeadsUpScreen} />
      <M.Screen name="TableCard" component={TableCardScreen} options={{ presentation: 'modal' }} />
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
      <A.Screen name="SignUp" component={SignUpScreen} />
      <A.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
    </A.Navigator>
  );
}

// v5 gate (September 2026): after sign-up, six questions and a starting plan,
// then the hard paywall (7 days free, then $10 a month). Nobody reaches the
// tabs without a trial or a subscription. The gate re-opens on the paywall,
// not the quiz, for someone who onboarded but whose trial lapsed.
function GateNav({ onboarded }: { onboarded: boolean }) {
  return (
    <G.Navigator
      screenOptions={{ headerShown: false }}
      initialRouteName={onboarded ? 'Paywall' : 'OnboardingQuiz'}
    >
      <G.Screen name="OnboardingQuiz" component={OnboardingQuizScreen} />
      <G.Screen name="StartingPlan" component={StartingPlanScreen} />
      <G.Screen name="Paywall" component={PaywallScreen} />
    </G.Navigator>
  );
}

function useGrowthHydrated() {
  const [ready, setReady] = useState(useGrowthStore.persist.hasHydrated());
  useEffect(() => {
    const unsub = useGrowthStore.persist.onFinishHydration(() => setReady(true));
    setReady(useGrowthStore.persist.hasHydrated());
    return unsub;
  }, []);
  return ready;
}

export default function RootNavigator() {
  const { session, initialized } = useAuthStore();
  const growthReady = useGrowthHydrated();
  const onboardedAt = useGrowthStore((s) => s.onboardedAt);
  const entitlement = useGrowthStore((s) => s.entitlement);
  const hydratedFromServer = useGrowthStore((s) => s.hydratedFromServer);
  const hydrate = useGrowthStore((s) => s.hydrate);
  const userId = session?.user?.id ?? null;
  const [pulled, setPulled] = useState(false);

  // On sign-in: pull onboarding, entitlement, streak and watch list from the
  // server, and tie the store account to this user.
  useEffect(() => {
    if (!userId || !growthReady) return;
    setPulled(false);
    configurePurchases(userId).catch(() => {});
    hydrate(userId).finally(() => setPulled(true));
  }, [userId, growthReady, hydrate]);

  if (!initialized || !growthReady) return null;
  // With a real backend, wait for the server's answer before choosing between
  // the paywall and the app, so a paying member never sees a paywall flash.
  if (session && !SAMPLE_MODE && !pulled && !hydratedFromServer) return null;

  const entitled = entitlement === 'trial' || entitlement === 'active';
  return (
    <NavigationContainer>
      {!session ? <AuthNav /> : entitled ? <MainNav /> : <GateNav onboarded={!!onboardedAt} />}
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
