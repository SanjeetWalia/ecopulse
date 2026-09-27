// src/screens/you/YouScreen.tsx — Redesign v3 (B6)
//
// Profile + membership + account. Replaces ProfileScreen as the You tab
// (ProfileScreen is preserved, unrouted).
//   • Membership: one plan, $10 a month after a 7-day trial (v5)
//   • Sign out
//   • Delete account (Apple requirement) — calls the delete_account RPC;
//     run supabase/delete_account.sql once to create it.

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Typography } from '../../constants/theme';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../lib/authStore';
import { useGrowthStore, streakInfo, trialDaysLeft } from '../../lib/growthStore';
import { priceLabel } from '../../lib/pricing';
import { SAMPLE_MODE } from '../../lib/sample';

// Every input the number can have, and whether it is actually feeding it.
// Nothing here claims a date it cannot keep.
const SOURCES: { key: string; icon: string; title: string; sub: string; state: 'on' | 'off' }[] = [
  { key: 'snap',   icon: '📷', title: 'Snap',           sub: 'Photograph a meal and it is counted',           state: 'on' },
  { key: 'manual', icon: '✏️', title: 'Logging by hand', sub: 'Describe anything in your own words',           state: 'on' },
  { key: 'chat',   icon: '🌱', title: 'Eco-chat',        sub: 'What you tell it calibrates your numbers',      state: 'on' },
  { key: 'health', icon: '🍎', title: 'Apple Health',    sub: 'Walks and rides, counted without a tap',        state: 'off' },
  { key: 'trips',  icon: '🗺️', title: 'Trip history',    sub: 'Miles driven, seen automatically',              state: 'off' },
  { key: 'bill',   icon: '⚡', title: 'Electricity bill', sub: 'Snap one and home energy joins your number',   state: 'off' },
];

export default function YouScreen({ navigation }: any) {
  const { profile } = useAuthStore();
  const insets = useSafeAreaInsets();
  const [deleting, setDeleting] = useState(false);
  const entitlement = useGrowthStore((g) => g.entitlement);
  const trialStartedAt = useGrowthStore((g) => g.trialStartedAt);
  const days = useGrowthStore((g) => g.days);
  const watchCount = useGrowthStore((g) => g.watchList.length);
  const resetGrowth = useGrowthStore((g) => g.resetGrowth);
  const streak = streakInfo(days);
  const trialLeft = trialDaysLeft(trialStartedAt);

  const initials =
    profile?.full_name
      ?.split(' ')
      .map((w: string) => w[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() || '🌿';

  const handleSignOut = () => {
    Alert.alert('Sign out?', '', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: async () => {
          await supabase.auth.signOut();
          // Auth state listener handles navigation back to Welcome.
        },
      },
    ]);
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete your account?',
      'Everything — activities, profile, and your login — is removed permanently. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete everything',
          style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            const { error } = await supabase.rpc('delete_account');
            setDeleting(false);
            if (error) {
              Alert.alert(
                'Could not delete',
                'Something went wrong on our side. Please try again, or email us and we will delete it for you within 48 hours.'
              );
              return;
            }
            await supabase.auth.signOut();
          },
        },
      ]
    );
  };

  return (
    <View style={[s.root, { paddingTop: insets.top || 12 }]}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.bg} />

      <View style={s.topbar}>
        <Text style={s.wordmark}>
          eco<Text style={s.wordmarkAccent}>pulse</Text>
        </Text>
        <Text style={s.topLabel}>YOU</Text>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: 40 }}
      >
        {/* Identity */}
        <View style={s.idBlock}>
          <View style={s.bigAvatar}>
            <Text style={s.bigAvatarTxt}>{initials}</Text>
          </View>
          <Text style={s.name}>{profile?.full_name || 'Eco member'}</Text>
          {!!profile?.username && <Text style={s.username}>@{profile.username}</Text>}
        </View>

        {/* Membership (v5): one plan, $10 a month after a 7-day trial. */}
        <Text style={s.sect}>MEMBERSHIP</Text>
        <View style={s.planCard}>
          <View style={s.planRow}>
            <Text style={s.planName}>Eco Pulse</Text>
            <View style={s.planBadge}>
              <Text style={s.planBadgeTxt}>{entitlement === 'trial' ? 'TRIAL' : 'MEMBER'}</Text>
            </View>
          </View>
          <Text style={s.planDesc}>
            {entitlement === 'trial'
              ? `${trialLeft} ${trialLeft === 1 ? 'day' : 'days'} left in your free trial, then ${priceLabel} a month. Cancel anytime in Settings.`
              : `${priceLabel} a month. Manage or cancel in Settings.`}
          </Text>
        </View>

        {/* v5: the loop's own screens. */}
        <Text style={s.sect}>YOUR LOOP</Text>
        <TouchableOpacity style={s.setRow} onPress={() => navigation.navigate('Streak')} activeOpacity={0.7}>
          <Text style={s.setIcon}>🔥</Text>
          <View style={{ flex: 1 }}>
            <Text style={s.setL1}>Streak</Text>
            <Text style={s.setL2}>{streak.count} days · what keeps a day, and repairs</Text>
          </View>
          <Text style={s.chev}>›</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.setRow} onPress={() => navigation.navigate('Chain')} activeOpacity={0.7}>
          <Text style={s.setIcon}>🔗</Text>
          <View style={{ flex: 1 }}>
            <Text style={s.setL1}>Your chain</Text>
            <Text style={s.setL2}>Keys you’ve earned, and who joined through you</Text>
          </View>
          <Text style={s.chev}>›</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.setRow} onPress={() => navigation.navigate('HeadsUp')} activeOpacity={0.7}>
          <Text style={s.setIcon}>🛡️</Text>
          <View style={{ flex: 1 }}>
            <Text style={s.setL1}>Heads up</Text>
            <Text style={s.setL2}>Recalls checked against {watchCount} {watchCount === 1 ? 'product' : 'products'} you bought</Text>
          </View>
          <Text style={s.chev}>›</Text>
        </TouchableOpacity>

        {/* Memory (N4) — visible and editable, because a memory layer the
            user cannot correct is one they have to take on faith. */}
        <Text style={s.sect}>MEMORY</Text>
        <TouchableOpacity style={s.setRow} onPress={() => navigation.navigate('Memory')} activeOpacity={0.7}>
          <Text style={s.setIcon}>🧠</Text>
          <View style={{ flex: 1 }}>
            <Text style={s.setL1}>What Eco Pulse remembers</Text>
            <Text style={s.setL2}>Everything it knows about you, and a way to remove it</Text>
          </View>
          <Text style={s.chev}>›</Text>
        </TouchableOpacity>

        {/* Sources — moved off the main surface (M5).
            v3 showed these as two dead "Soon" buttons on AirScreen, which
            reads as abandonment rather than a roadmap (OBS-020). An honest
            connected / not-connected list belongs here instead. */}
        <Text style={s.sect}>WHERE YOUR NUMBER COMES FROM</Text>
        {SOURCES.map((src) => (
          <View key={src.key} style={s.setRow}>
            <Text style={s.setIcon}>{src.icon}</Text>
            <View style={{ flex: 1 }}>
              <Text style={s.setL1}>{src.title}</Text>
              <Text style={s.setL2}>{src.sub}</Text>
            </View>
            <View style={[s.srcPill, src.state === 'on' && s.srcPillOn]}>
              <Text style={[s.srcPillTxt, src.state === 'on' && s.srcPillTxtOn]}>
                {src.state === 'on' ? 'ON' : 'NOT YET'}
              </Text>
            </View>
          </View>
        ))}

        {/* Account */}
        <Text style={s.sect}>ACCOUNT</Text>
        <View style={s.setRow}>
          <Text style={s.setIcon}>👤</Text>
          <View style={{ flex: 1 }}>
            <Text style={s.setL1}>Name & username</Text>
            <Text style={s.setL2}>Editing arrives in a coming build</Text>
          </View>
        </View>
        <TouchableOpacity style={s.setRow} onPress={handleSignOut} activeOpacity={0.7}>
          <Text style={s.setIcon}>🚪</Text>
          <Text style={[s.setL1, { flex: 1 }]}>Sign out</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.setRow} onPress={handleDelete} activeOpacity={0.7} disabled={deleting}>
          <Text style={s.setIcon}>🗑️</Text>
          <View style={{ flex: 1 }}>
            <Text style={[s.setL1, { color: Colors.coral }]}>Delete account</Text>
            <Text style={s.setL2}>Everything, permanently</Text>
          </View>
          {deleting && <ActivityIndicator size="small" color={Colors.coral} />}
        </TouchableOpacity>

        {SAMPLE_MODE && (
          <TouchableOpacity
            style={s.setRow}
            onPress={() =>
              Alert.alert('Replay onboarding?', 'Clears the quiz, plan, trial, streak and check-ins on this phone so you can walk the new flow again.', [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Replay', onPress: resetGrowth },
              ])
            }
            activeOpacity={0.7}
          >
            <Text style={s.setIcon}>🧪</Text>
            <View style={{ flex: 1 }}>
              <Text style={s.setL1}>Replay onboarding</Text>
              <Text style={s.setL2}>Testing only. Sample data is on.</Text>
            </View>
          </TouchableOpacity>
        )}

        <Text style={s.footer}>ecopulse · tryecopulse.com</Text>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg },
  topbar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  wordmark: { fontFamily: Typography.heading, fontSize: 20, color: Colors.tx, letterSpacing: -0.5 },
  wordmarkAccent: { color: Colors.lime },
  topLabel: { fontFamily: Typography.headingBold, fontSize: 9, color: Colors.tx3, letterSpacing: 2 },

  idBlock: { alignItems: 'center', paddingVertical: 16 },
  bigAvatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.sf,
    borderWidth: 1,
    borderColor: Colors.border2,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  bigAvatarTxt: { fontFamily: Typography.headingBold, fontSize: 20, color: Colors.lime },
  name: { fontFamily: Typography.heading, fontSize: 20, color: Colors.tx, letterSpacing: -0.4 },
  username: { fontFamily: Typography.body, fontSize: 12, color: Colors.tx3, marginTop: 3 },

  sect: { fontFamily: Typography.headingBold, fontSize: 9.5, color: Colors.tx3, letterSpacing: 2, marginTop: 16, marginBottom: 8 },

  planCard: {
    borderWidth: 1,
    borderColor: Colors.border2,
    borderRadius: 16,
    backgroundColor: 'rgba(200,244,90,0.04)',
    padding: 14,
    marginBottom: 7,
  },
  planRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  planName: { fontFamily: Typography.heading, fontSize: 16, color: Colors.tx },
  planBadge: { backgroundColor: Colors.lime, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3 },
  planBadgeTxt: { fontFamily: Typography.headingBold, fontSize: 8, color: '#071810', letterSpacing: 1 },
  planDesc: { fontFamily: Typography.body, fontSize: 11.5, color: Colors.tx2, marginTop: 6, lineHeight: 17 },

  upsell: {
    borderWidth: 1,
    borderColor: 'rgba(45,212,191,0.25)',
    borderRadius: 16,
    backgroundColor: 'rgba(45,212,191,0.05)',
    padding: 14,
  },
  upsellName: { fontFamily: Typography.heading, fontSize: 16, color: Colors.teal },
  upsellPrice: { fontFamily: Typography.headingBold, fontSize: 11, color: Colors.tx2 },

  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    backgroundColor: Colors.sf,
    borderWidth: 0.5,
    borderColor: Colors.border,
    borderRadius: 14,
    paddingHorizontal: 13,
    paddingVertical: 12,
    marginBottom: 7,
  },
  setIcon: { fontSize: 15 },
  chev: { fontFamily: Typography.headingBold, fontSize: 18, color: Colors.tx3 },
  srcPill: { borderWidth: 1, borderColor: Colors.border, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 4 },
  srcPillOn: { borderColor: Colors.border2, backgroundColor: 'rgba(200,244,90,0.12)' },
  srcPillTxt: { fontFamily: Typography.headingBold, fontSize: 8.5, color: Colors.tx3, letterSpacing: 1 },
  srcPillTxtOn: { color: Colors.lime },
  setL1: { fontFamily: Typography.headingBold, fontSize: 13, color: Colors.tx },
  setL2: { fontFamily: Typography.body, fontSize: 10.5, color: Colors.tx3, marginTop: 2 },

  footer: { fontFamily: Typography.body, fontSize: 9.5, color: 'rgba(255,255,255,0.12)', textAlign: 'center', marginTop: 24 },
});
