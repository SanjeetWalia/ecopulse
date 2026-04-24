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
import ExploreScreen from '../screens/explore/ExploreScreen';
import SnapScreen from '../screens/activity/SnapScreen';
import ProfileScreen from '../screens/home/ProfileScreen';
import SettingsScreen from '../screens/home/SettingsScreen';
import HabitsScreen from '../screens/habits/HabitsScreen';
import ActivityDetailScreen from '../screens/activity/ActivityDetailScreen';
import LogActivityScreen from '../screens/activity/LogActivityScreen';
import GiftPlantScreen from '../screens/gift/GiftPlantScreen';
import MessagesScreen from '../screens/messages/MessagesScreen';
import WeeklyWrappedScreen from '../screens/home/WeeklyWrappedScreen';
import MomentsFeedScreen from '../screens/home/MomentsFeedScreen';
import CarbonChallengeScreen from '../screens/home/CarbonChallengeScreen';
import ConversationScreen from '../screens/messages/ConversationScreen';

const A = createNativeStackNavigator();
const M = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

const ICONS: Record<string, string> = { Home:'⌂', Explore:'◉', Snap:'◎', Profile:'○', Habits:'🌿' };

function TabBar({ state, navigation }: any) {
  return (
    <View style={s.barOuter}>
      <View style={s.bar}>
        {state.routes.map((route: any, i: number) => {
          // Hide Explore tab from the bar but keep it in navigator
          if (route.name === 'Explore') return null;

          const focused = state.index === i;
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
        })}
      </View>
    </View>
  );
}

function MainTabs() {
  return (
    <Tab.Navigator tabBar={(p) => <TabBar {...p} />} screenOptions={{ headerShown: false }}>
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Explore" component={ExploreScreen} />
      <Tab.Screen name="Snap" component={SnapScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
      <Tab.Screen name="Habits" component={HabitsScreen} />
    </Tab.Navigator>
  );
}

function MainNav() {
  return (
    <M.Navigator screenOptions={{ headerShown: false }}>
      <M.Screen name="Tabs" component={MainTabs} />
      <M.Screen name="ActivityDetail" component={ActivityDetailScreen} />
      <M.Screen name="LogActivity" component={LogActivityScreen} options={{ presentation: 'modal' }} />
      <M.Screen name="GiftPlant" component={GiftPlantScreen} />
      <M.Screen name="Messages" component={MessagesScreen} />
      <M.Screen name="Conversation" component={ConversationScreen} />
      <M.Screen name="WeeklyWrapped" component={WeeklyWrappedScreen} options={{ presentation: 'modal' }} />
      <M.Screen name="MomentsFeed" component={MomentsFeedScreen} />
      <M.Screen name="CarbonChallenge" component={CarbonChallengeScreen} options={{ presentation: 'modal' }} />
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
  bar: { width: 390, maxWidth: '100%', flexDirection: 'row', backgroundColor: 'rgba(7,16,13,0.97)', borderTopWidth: 0.5, borderTopColor: 'rgba(200,244,90,0.1)', paddingVertical: 6, height: 58 },
  tabItem: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 2 },
  iconWrap: { width: 30, height: 30, borderRadius: 9, justifyContent: 'center', alignItems: 'center' },
  iconWrapOn: { backgroundColor: 'rgba(200,244,90,0.12)' },
  icon: { fontSize: 16, color: Colors.tx3 },
  iconOn: { color: Colors.lime },
  lbl: { fontFamily: Typography.headingBold, fontSize: 8, color: Colors.tx3, textTransform: 'uppercase', letterSpacing: 0.3 },
  lblOn: { color: Colors.lime },
});
