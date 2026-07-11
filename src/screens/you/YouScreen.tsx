// src/screens/you/YouScreen.tsx — Redesign v3 (B6)
//
// Profile + membership + account. Replaces ProfileScreen as the You tab
// (ProfileScreen is preserved, unrouted).
//   • Eco (free) / Eco Pulse (paid) membership display — no payment flow yet
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

export default function YouScreen() {
  const { profile } = useAuthStore();
  const insets = useSafeAreaInsets();
  const [deleting, setDeleting] = useState(false);

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

        {/* Membership */}
        <Text style={s.sect}>MEMBERSHIP</Text>
        <View style={s.planCard}>
          <View style={s.planRow}>
            <Text style={s.planName}>Eco</Text>
            <View style={s.planBadge}>
              <Text style={s.planBadgeTxt}>YOUR PLAN</Text>
            </View>
          </View>
          <Text style={s.planDesc}>Snap, your daily number, your circle. The heartbeat.</Text>
        </View>
        <TouchableOpacity
          style={s.upsell}
          activeOpacity={0.85}
          onPress={() =>
            Alert.alert('Eco Pulse', 'The full breath — Optimizer, every passive source, unlimited chat memory. Arriving soon.')
          }
        >
          <View style={s.planRow}>
            <Text style={s.upsellName}>Eco Pulse</Text>
            <Text style={s.upsellPrice}>$3.99/mo · $29/yr</Text>
          </View>
          <Text style={s.planDesc}>
            The full breath — Optimizer, every passive source, unlimited chat memory, weekly journals.
          </Text>
        </TouchableOpacity>

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
  setL1: { fontFamily: Typography.headingBold, fontSize: 13, color: Colors.tx },
  setL2: { fontFamily: Typography.body, fontSize: 10.5, color: Colors.tx3, marginTop: 2 },

  footer: { fontFamily: Typography.body, fontSize: 9.5, color: 'rgba(255,255,255,0.12)', textAlign: 'center', marginTop: 24 },
});
