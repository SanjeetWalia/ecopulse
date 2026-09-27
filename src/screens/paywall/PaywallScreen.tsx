// src/screens/paywall/PaywallScreen.tsx
//
// Hard paywall after onboarding: 7 days free, then $10 a month
// (claude/PRICING-MODEL.md). A key from someone's kept pact takes half off the
// first paid month, and the person who passed it on gets the same once this
// user pays that month.
//
// UI phase: "Start 7 days free" flips the local entitlement. Backend phase:
// the purchase goes through StoreKit (RevenueCat), the key discount is an App
// Store offer, and entitlement is read from the server.

import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking } from 'react-native';
import { Colors, Typography } from '../../constants/theme';
import { Screen, Button, Card, Eyebrow, H1, Body, SampleTag } from '../../components/kit';
import { useGrowthStore } from '../../lib/growthStore';
import { PRICE_MONTHLY_USD, TRIAL_DAYS, TRIAL_REMINDER_DAY, discountedFirstMonth, priceLabel } from '../../lib/pricing';
import { SAMPLE_MODE } from '../../lib/sample';

const INCLUDED = [
  ['Every camera read', 'Meals, menus, labels, receipts, bills, and what they give back'],
  ['An assistant that knows you', 'Your car, your habits, your week, in the terms you care about'],
  ['Heads up', 'Recalls and rule changes checked against what you actually bought'],
  ['Pacts and your chain', 'Keep a promise, pass on a key, see what your chain gives back'],
];

export default function PaywallScreen({ navigation }: any) {
  const startTrial = useGrowthStore((s) => s.startTrial);
  const keyFrom = useGrowthStore((s) => s.joinedWithKeyFrom);
  const [busy, setBusy] = useState(false);

  const start = async () => {
    setBusy(true);
    // Backend phase: await purchases.purchasePackage(monthlyWithTrial)
    await new Promise((r) => setTimeout(r, 500));
    startTrial();
    setBusy(false);
  };

  const firstMonth = keyFrom ? discountedFirstMonth : priceLabel;

  return (
    <Screen
      onBack={navigation.canGoBack() ? () => navigation.goBack() : undefined}
      footer={
        <>
          <Button label={`Start ${TRIAL_DAYS} days free`} onPress={start} loading={busy} />
          <Text style={st.fine}>
            Then {firstMonth} for your first month{keyFrom ? `, ${priceLabel} after` : ''}, billed monthly. Cancel anytime in
            Settings before day {TRIAL_DAYS} and you won’t be charged.
          </Text>
        </>
      }
    >
      {SAMPLE_MODE && <SampleTag />}
      <Eyebrow style={{ marginTop: 10 }}>Eco Pulse</Eyebrow>
      <H1 style={{ marginTop: 6 }}>Try all of it free for {TRIAL_DAYS} days</H1>

      {keyFrom && (
        <Card accent style={{ marginTop: 16 }}>
          <Text style={st.keyTitle}>🔑 {keyFrom}’s key</Text>
          <Body style={{ fontSize: 13.5, marginTop: 4 }}>
            Your first paid month is {discountedFirstMonth}. When you pay it, {keyFrom}’s next month is half price too, and
            everyone in the chain gets a free streak repair.
          </Body>
        </Card>
      )}

      <View style={{ marginTop: 20, gap: 14 }}>
        {INCLUDED.map(([t, d]) => (
          <View key={t} style={st.inc}>
            <Text style={st.tick}>✓</Text>
            <View style={{ flex: 1 }}>
              <Text style={st.incT}>{t}</Text>
              <Text style={st.incD}>{d}</Text>
            </View>
          </View>
        ))}
      </View>

      <Eyebrow style={{ marginTop: 26, marginBottom: 12 }}>How the trial works</Eyebrow>
      <View style={st.timeline}>
        {[
          ['Today', 'Everything unlocked. Your plan starts now.'],
          [`Day ${TRIAL_REMINDER_DAY}`, 'We remind you two days before the trial ends.'],
          [`Day ${TRIAL_DAYS}`, `${firstMonth} for the first month${keyFrom ? `, then $${PRICE_MONTHLY_USD}` : ''}, unless you cancel.`],
        ].map(([d, t], i, arr) => (
          <View key={d} style={st.tlRow}>
            <View style={st.tlRail}>
              <View style={[st.tlDot, i === 0 && { backgroundColor: Colors.lime }]} />
              {i < arr.length - 1 && <View style={st.tlLine} />}
            </View>
            <View style={{ flex: 1, paddingBottom: i < arr.length - 1 ? 16 : 0 }}>
              <Text style={st.tlDay}>{d}</Text>
              <Text style={st.tlTxt}>{t}</Text>
            </View>
          </View>
        ))}
      </View>

      <View style={st.links}>
        <TouchableOpacity onPress={() => {}} accessibilityRole="button">
          <Text style={st.link}>Restore purchase</Text>
        </TouchableOpacity>
        <Text style={st.link}>·</Text>
        <TouchableOpacity onPress={() => Linking.openURL('https://tryecopulse.com/terms')}>
          <Text style={st.link}>Terms</Text>
        </TouchableOpacity>
        <Text style={st.link}>·</Text>
        <TouchableOpacity onPress={() => Linking.openURL('https://tryecopulse.com/privacy')}>
          <Text style={st.link}>Privacy</Text>
        </TouchableOpacity>
      </View>
    </Screen>
  );
}

const st = StyleSheet.create({
  fine: { fontFamily: Typography.body, fontSize: 11.5, color: Colors.tx3, textAlign: 'center', lineHeight: 16 },
  keyTitle: { fontFamily: Typography.headingBold, fontSize: 14.5, fontWeight: '700', color: Colors.lime },
  inc: { flexDirection: 'row', gap: 12 },
  tick: { color: Colors.lime, fontSize: 15, fontWeight: '700', marginTop: 1 },
  incT: { fontFamily: Typography.headingBold, fontSize: 15, fontWeight: '600', color: Colors.tx },
  incD: { fontFamily: Typography.body, fontSize: 13, color: Colors.tx2, marginTop: 2, lineHeight: 18 },
  timeline: { gap: 0 },
  tlRow: { flexDirection: 'row', gap: 12 },
  tlRail: { width: 12, alignItems: 'center' },
  tlDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.sf2, marginTop: 4 },
  tlLine: { flex: 1, width: 2, backgroundColor: Colors.sf2, marginTop: 2 },
  tlDay: { fontFamily: Typography.headingBold, fontSize: 13.5, fontWeight: '700', color: Colors.tx },
  tlTxt: { fontFamily: Typography.body, fontSize: 13, color: Colors.tx2, marginTop: 1 },
  links: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginTop: 26 },
  link: { fontFamily: Typography.body, fontSize: 12, color: Colors.tx3 },
});
