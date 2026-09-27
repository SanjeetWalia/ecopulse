// src/screens/chain/ChainScreen.tsx
//
// Your chain (PRODUCT-THESIS.md §4): make a pact, keep it, pass it on.
//   • The number: what your chain has given back, and how much came from
//     people you brought in.
//   • The chain itself, drawn as a chain (the data is a tree).
//   • Your keys, each earned by a kept pact, and a share message that says so.
//   • What the chain has earned: half-price first months and free repairs.
//
// Guardrails (agreed): no quotas, no "don't break the chain" copy, rewards
// only when a friend pays their first month.

import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Share } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Colors, Typography } from '../../constants/theme';
import { Screen, Card, Eyebrow, Body, SampleTag } from '../../components/kit';
import { getChain, getKeys, getRewards, chainTotals, flattenChain, ChainView, KeyInfo } from '../../lib/growth';
import { SAMPLE_MODE } from '../../lib/sample';
import { discountedFirstMonth } from '../../lib/pricing';

export default function ChainScreen({ navigation }: any) {
  const [chain, setChain] = useState<ChainView | null>(null);
  const [keys, setKeys] = useState<KeyInfo[]>([]);
  const [rewards, setRewards] = useState<{ id: string; when: string; text: string }[]>([]);

  useFocusEffect(
    useCallback(() => {
      getChain().then(setChain).catch(() => {});
      getKeys().then(setKeys).catch(() => {});
      getRewards().then(setRewards).catch(() => {});
    }, [])
  );

  if (!chain) return <Screen title="Your chain" onBack={() => navigation.goBack()}>{null}</Screen>;

  const total = chainTotals(chain.you);
  const fromOthers = total.lb - chain.you.givenBackLb;
  const rows = flattenChain(chain.you);
  const unused = keys.filter((k) => !k.used);

  const passOn = async (k: KeyInfo) => {
    const pact = k.earnedFrom.split(',')[0].toLowerCase();
    try {
      await Share.share({
        message: `I kept a pact on Eco Pulse: ${pact}. Want to try one with me? My key ${k.code} takes half off your first month (${discountedFirstMonth}). tryecopulse.com`,
      });
    } catch {}
  };

  return (
    <Screen title="Your chain" onBack={() => navigation.goBack()}>
      {SAMPLE_MODE && <SampleTag />}

      <View style={st.hero}>
        <Text style={st.num}>{total.lb.toLocaleString('en-US')}</Text>
        <Text style={st.unit}>lb your chain has given back</Text>
        <Body style={{ textAlign: 'center', marginTop: 8 }}>
          {fromOthers} lb of it came from the {total.people - 1} people who joined through you and the people they brought in.
        </Body>
      </View>

      {chain.upstream && (
        <Text style={st.upstream}>
          You joined through <Text style={{ color: Colors.tx }}>{chain.upstream.name}</Text>, who kept a pact: {chain.upstream.pact}.
        </Text>
      )}

      <Card style={{ marginTop: 14, paddingVertical: 8 }}>
        {rows.map(({ person, depth }, i) => (
          <View key={person.id} style={[st.link, { paddingLeft: depth * 22 }]}>
            <View style={st.rail}>
              {i > 0 && <View style={st.railUp} />}
              <View style={[st.node, depth === 0 && { backgroundColor: Colors.lime, borderColor: Colors.lime }]} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={st.name}>{person.name}</Text>
              <Text style={st.meta}>
                {depth === 0 ? 'You' : `Joined ${person.joinedDaysAgo} days ago`}
                {depth > 0 && !person.firstMonthPaid ? ' · on their trial' : ''}
              </Text>
            </View>
            <Text style={st.lb}>{person.givenBackLb} lb</Text>
          </View>
        ))}
      </Card>

      <Eyebrow style={{ marginTop: 26, marginBottom: 10 }}>Your keys</Eyebrow>
      {unused.length === 0 ? (
        <Card>
          <Body style={{ fontSize: 13.5 }}>
            Keep a pact to earn a key. Each one carries the promise you kept, so the person you give it to knows why.
          </Body>
        </Card>
      ) : (
        unused.map((k) => (
          <Card key={k.id} accent style={{ marginBottom: 8 }}>
            <View style={st.keyRow}>
              <View style={{ flex: 1 }}>
                <Text style={st.keyCode}>🔑 {k.code}</Text>
                <Text style={st.keyFrom}>Earned by: {k.earnedFrom}</Text>
              </View>
              <TouchableOpacity style={st.passBtn} onPress={() => passOn(k)} activeOpacity={0.85}>
                <Text style={st.passTxt}>Pass it on</Text>
              </TouchableOpacity>
            </View>
          </Card>
        ))
      )}
      <Body muted style={{ fontSize: 12.5, marginTop: 6 }}>
        A friend who uses your key pays {discountedFirstMonth} for their first month. When they pay it, your next month is
        half price too, and everyone in your chain gets a free streak repair.
      </Body>

      <Eyebrow style={{ marginTop: 26, marginBottom: 10 }}>What your chain has earned</Eyebrow>
      {rewards.map((r) => (
        <View key={r.id} style={st.reward}>
          <Text style={st.rewardWhen}>{r.when}</Text>
          <Text style={st.rewardTxt}>{r.text}</Text>
        </View>
      ))}
    </Screen>
  );
}

const st = StyleSheet.create({
  hero: { alignItems: 'center', marginTop: 12 },
  num: { fontFamily: Typography.heading, fontSize: 56, fontWeight: '700', color: Colors.lime, letterSpacing: -2 },
  unit: { fontFamily: Typography.body, fontSize: 14, color: Colors.tx2, marginTop: -2 },
  upstream: { fontFamily: Typography.body, fontSize: 13, color: Colors.tx3, textAlign: 'center', marginTop: 16, lineHeight: 19 },
  link: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 9 },
  rail: { width: 14, alignItems: 'center', justifyContent: 'center', alignSelf: 'stretch' },
  railUp: { position: 'absolute', top: -9, height: 22, width: 1.5, backgroundColor: Colors.border2 },
  node: { width: 12, height: 12, borderRadius: 6, borderWidth: 2, borderColor: Colors.teal, backgroundColor: Colors.bg2 },
  name: { fontFamily: Typography.headingBold, fontSize: 14.5, fontWeight: '600', color: Colors.tx },
  meta: { fontFamily: Typography.body, fontSize: 11.5, color: Colors.tx3, marginTop: 1 },
  lb: { fontFamily: Typography.headingBold, fontSize: 13.5, fontWeight: '600', color: Colors.lime },
  keyRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  keyCode: { fontFamily: Typography.headingBold, fontSize: 15, fontWeight: '700', color: Colors.tx, letterSpacing: 0.5 },
  keyFrom: { fontFamily: Typography.body, fontSize: 12, color: Colors.tx2, marginTop: 3 },
  passBtn: { backgroundColor: Colors.lime, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
  passTxt: { fontFamily: Typography.headingBold, fontSize: 12.5, fontWeight: '700', color: '#071810' },
  reward: { flexDirection: 'row', gap: 12, paddingVertical: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.border },
  rewardWhen: { width: 74, fontFamily: Typography.body, fontSize: 11.5, color: Colors.tx3, paddingTop: 1 },
  rewardTxt: { flex: 1, fontFamily: Typography.body, fontSize: 13, color: Colors.tx2, lineHeight: 18 },
});
