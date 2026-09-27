// src/screens/streak/StreakScreen.tsx
//
// The streak in full: the last five weeks, what kept each day, what counts,
// and repairs (free ones from the chain, or $0.99). The streak is personal:
// a missed day never touches anyone else's chain.

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors, Typography } from '../../constants/theme';
import { Screen, Card, Eyebrow, Body, SampleTag } from '../../components/kit';
import { useGrowthStore, streakInfo, daysAgo, DaySource } from '../../lib/growthStore';
import { repairLabel } from '../../lib/pricing';
import { SAMPLE_MODE } from '../../lib/sample';

const SOURCE_COLOR: Record<DaySource, string> = {
  snap: Colors.lime,
  checkin: Colors.teal,
  health: Colors.sky,
  receipt: Colors.lime2,
  repair: Colors.amber,
};

const SOURCE_LABEL: Record<DaySource, string> = {
  snap: 'Snap',
  checkin: 'Check-in',
  health: 'Apple Health',
  receipt: 'Receipt',
  repair: 'Repaired',
};

export default function StreakScreen({ navigation }: any) {
  const days = useGrowthStore((s) => s.days);
  const freeRepairs = useGrowthStore((s) => s.freeRepairs);
  const purchasedRepairs = useGrowthStore((s) => s.purchasedRepairs);
  const info = streakInfo(days);

  // 35 days, oldest first, laid out in weeks.
  const cells = Array.from({ length: 35 }, (_, i) => {
    const key = daysAgo(34 - i);
    return { key, src: days[key] as DaySource | undefined, today: i === 34 };
  });
  const longest = (() => {
    let best = 0;
    let cur = 0;
    for (const c of cells) {
      cur = c.src ? cur + 1 : 0;
      best = Math.max(best, cur);
    }
    return best;
  })();

  return (
    <Screen title="Streak" onBack={() => navigation.goBack()}>
      {SAMPLE_MODE && <SampleTag />}
      <View style={st.hero}>
        <Text style={st.num}>{info.count}</Text>
        <Text style={st.unit}>days in a row</Text>
      </View>
      <Body style={{ textAlign: 'center' }}>
        {info.keptToday ? 'Today already counts.' : 'One snap or one check-in keeps today.'} Longest in the last five weeks: {longest}.
      </Body>

      <View style={st.grid}>
        {cells.map((c) => (
          <View
            key={c.key}
            style={[
              st.cell,
              c.src ? { backgroundColor: SOURCE_COLOR[c.src] } : null,
              c.today && !c.src ? { borderColor: Colors.lime, borderWidth: 1.5 } : null,
            ]}
          />
        ))}
      </View>
      <View style={st.legend}>
        {(Object.keys(SOURCE_LABEL) as DaySource[]).map((k) => (
          <View key={k} style={st.legItem}>
            <View style={[st.legDot, { backgroundColor: SOURCE_COLOR[k] }]} />
            <Text style={st.legTxt}>{SOURCE_LABEL[k]}</Text>
          </View>
        ))}
      </View>

      <Eyebrow style={{ marginTop: 26, marginBottom: 10 }}>What keeps a day</Eyebrow>
      <Card>
        <Body style={{ fontSize: 13.5 }}>
          Any one of these: a snap, a receipt, a check-in answered from Today or the notification, or movement from Apple
          Health once it’s connected. You never need to open the app just to keep it.
        </Body>
      </Card>

      <Eyebrow style={{ marginTop: 26, marginBottom: 10 }}>Repairs</Eyebrow>
      <Card>
        <View style={st.repRow}>
          <Text style={st.repN}>{freeRepairs}</Text>
          <Text style={st.repT}>free {freeRepairs === 1 ? 'repair' : 'repairs'} from your chain</Text>
        </View>
        <Body muted style={{ fontSize: 12.5, marginTop: 6 }}>
          Every time someone new joins your chain, everyone in it gets one. Otherwise a repair is {repairLabel}. A repair can
          only fix yesterday.
        </Body>
        {purchasedRepairs > 0 && (
          <Body muted style={{ fontSize: 12.5, marginTop: 6 }}>
            You’ve bought {purchasedRepairs}.
          </Body>
        )}
      </Card>
    </Screen>
  );
}

const st = StyleSheet.create({
  hero: { alignItems: 'center', marginTop: 12, marginBottom: 6 },
  num: { fontFamily: Typography.heading, fontSize: 64, fontWeight: '700', color: Colors.lime, letterSpacing: -2 },
  unit: { fontFamily: Typography.body, fontSize: 14, color: Colors.tx2, marginTop: -4 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 22, justifyContent: 'center' },
  cell: { width: '12%', aspectRatio: 1, borderRadius: 7, backgroundColor: Colors.sf },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'center', marginTop: 12 },
  legItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legDot: { width: 8, height: 8, borderRadius: 2 },
  legTxt: { fontFamily: Typography.body, fontSize: 11, color: Colors.tx3 },
  repRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  repN: { fontFamily: Typography.heading, fontSize: 28, fontWeight: '700', color: Colors.amber },
  repT: { fontFamily: Typography.body, fontSize: 14, color: Colors.tx2 },
});
