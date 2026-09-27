// src/screens/onboarding/StartingPlanScreen.tsx
//
// The first thing a new user sees is about them: an estimate built from their
// six answers, their biggest lines, and three moves with the same Add to plan
// switch the Snap tip uses. With a 7-day trial, this screen carries the first
// reveal; the 10-day baseline finishes after billing and turns these moves
// into the first pact.

import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors, Typography } from '../../constants/theme';
import { Screen, Button, Card, Eyebrow, ToggleRow, Body } from '../../components/kit';
import { useGrowthStore } from '../../lib/growthStore';
import { buildPlan, fmtUsdWeek } from '../../lib/plan';

export default function StartingPlanScreen({ navigation }: any) {
  const answers = useGrowthStore((s) => s.answers);
  const planMoves = useGrowthStore((s) => s.planMoves);
  const setPlanMove = useGrowthStore((s) => s.setPlanMove);
  const joinedWithKeyFrom = useGrowthStore((s) => s.joinedWithKeyFrom);

  const plan = useMemo(() => buildPlan(answers), [answers]);
  const on = plan.moves.filter((m) => planMoves[m.id]);
  const lbWeek = on.reduce((t, m) => t + m.lbPerWeek, 0);
  const usdWeek = on.reduce((t, m) => t + m.usdPerWeek, 0);

  return (
    <Screen
      title="Your starting plan"
      footer={<Button label="Continue" onPress={() => navigation.navigate('Paywall')} />}
    >
      <Eyebrow style={{ marginTop: 8 }}>With the moves you’ve switched on</Eyebrow>
      <View style={st.numRow}>
        <Text style={st.num}>~{lbWeek.toFixed(0)}</Text>
        <Text style={st.unit}>lb given back a week</Text>
      </View>
      <Body>
        {usdWeek < -0.5 ? `And about $${Math.abs(usdWeek).toFixed(0)} a week back in your pocket. ` : ''}
        Your biggest lines are likely {plan.biggestLines.join(', then ')}. This is an estimate from your answers until
        Eco Pulse sees your real week.
      </Body>

      <Card style={{ marginTop: 20, paddingVertical: 4 }}>
        {plan.moves.map((m, i) => (
          <View key={m.id} style={i === 0 ? { borderTopWidth: 0 } : undefined}>
            <ToggleRow
              title={m.title}
              meta={`−${m.lbPerWeek.toFixed(0)} lb · ${fmtUsdWeek(m.usdPerWeek)}`}
              value={!!planMoves[m.id]}
              onChange={(v) => setPlanMove(m.id, v)}
            />
          </View>
        ))}
      </Card>

      <View style={st.foot}>
        <Text style={st.footTxt}>
          In 10 days Eco Pulse will know your real week and turn these into your first pact.
        </Text>
        {!!joinedWithKeyFrom && (
          <Text style={[st.footTxt, { marginTop: 8 }]}>
            You’re a link in <Text style={{ color: Colors.tx, fontWeight: '600' }}>{joinedWithKeyFrom}’s</Text> chain.
          </Text>
        )}
      </View>
    </Screen>
  );
}

const st = StyleSheet.create({
  numRow: { flexDirection: 'row', alignItems: 'baseline', gap: 10, marginTop: 8, marginBottom: 10 },
  num: { fontFamily: Typography.heading, fontSize: 52, fontWeight: '700', color: Colors.lime, letterSpacing: -2 },
  unit: { fontFamily: Typography.body, fontSize: 15, color: Colors.tx2 },
  foot: { marginTop: 18, borderTopWidth: 1, borderStyle: 'dashed', borderTopColor: Colors.border2, paddingTop: 14 },
  footTxt: { fontFamily: Typography.body, fontSize: 13.5, color: Colors.tx2, lineHeight: 20 },
});
