// src/components/StreakCard.tsx
//
// Today's streak block: the count, today's open check-ins (one tap each), and
// the repair offer when yesterday slipped. A snap, a receipt, Apple Health
// movement or any check-in keeps the day.

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Colors, Typography } from '../constants/theme';
import { Chip } from './kit';
import { useGrowthStore, streakInfo, isoDay } from '../lib/growthStore';
import { openCheckIns } from '../lib/checkins';
import { repairLabel } from '../lib/pricing';

function answeredThisPeriod(checkIns: Record<string, Record<string, string>>) {
  return (id: string, cadence: 'daily' | 'weekly' | 'monthly') => {
    const now = new Date();
    return Object.entries(checkIns).some(([day, answers]) => {
      if (!answers[id]) return false;
      const d = new Date(day + 'T12:00:00');
      if (cadence === 'monthly') return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      // weekly: same Monday-start week
      const monday = new Date(now);
      monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
      monday.setHours(0, 0, 0, 0);
      return d >= monday;
    });
  };
}

export default function StreakCard({ navigation }: { navigation: any }) {
  const days = useGrowthStore((s) => s.days);
  const answers = useGrowthStore((s) => s.answers);
  const checkIns = useGrowthStore((s) => s.checkIns);
  const answerCheckIn = useGrowthStore((s) => s.answerCheckIn);
  const freeRepairs = useGrowthStore((s) => s.freeRepairs);
  const repairYesterday = useGrowthStore((s) => s.repairYesterday);

  const info = streakInfo(days);
  const open = openCheckIns(answers, checkIns[isoDay()], answeredThisPeriod(checkIns));

  const repair = () => {
    if (freeRepairs > 0) {
      repairYesterday(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      return;
    }
    // Backend phase: StoreKit consumable purchase, then repair on success.
    Alert.alert('Repair yesterday', `Keep your ${info.count}-day streak for ${repairLabel}?`, [
      { text: 'Not now', style: 'cancel' },
      {
        text: `Repair · ${repairLabel}`,
        onPress: () => {
          repairYesterday(true);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        },
      },
    ]);
  };

  return (
    <View style={st.wrap}>
      <TouchableOpacity style={st.head} onPress={() => navigation.navigate('Streak')} activeOpacity={0.75}>
        <Text style={st.flame}>{info.keptToday ? '🔥' : '◌'}</Text>
        <Text style={st.count}>
          {info.count}-day streak
          {info.keptToday ? <Text style={st.kept}>  · today counts</Text> : null}
        </Text>
        <Text style={st.more}>›</Text>
      </TouchableOpacity>

      {info.yesterdayMissed && !info.keptToday && (
        <View style={st.repair}>
          <Text style={st.repairTxt}>
            Yesterday slipped. {freeRepairs > 0 ? `Your chain gave you ${freeRepairs === 1 ? 'a free repair' : `${freeRepairs} free repairs`}.` : 'Repair it to keep the streak.'}
          </Text>
          <TouchableOpacity style={st.repairBtn} onPress={repair} activeOpacity={0.85}>
            <Text style={st.repairBtnTxt}>{freeRepairs > 0 ? 'Use free repair' : `Repair · ${repairLabel}`}</Text>
          </TouchableOpacity>
        </View>
      )}

      {open.map((c) => (
        <View key={c.id} style={st.ci}>
          <Text style={st.ciQ}>{c.question}</Text>
          <View style={st.ciOpts}>
            {c.options.map((o) => (
              <Chip
                key={o.value}
                label={o.label}
                style={st.ciChip}
                onPress={() => {
                  Haptics.selectionAsync().catch(() => {});
                  answerCheckIn(c.id, o.value);
                  if (o.snap) navigation.navigate('Snap');
                }}
              />
            ))}
          </View>
        </View>
      ))}

      {open.length === 0 && info.keptToday && (
        <Text style={st.done}>All caught up. Snaps and Apple Health keep counting on their own.</Text>
      )}
    </View>
  );
}

const st = StyleSheet.create({
  wrap: { marginHorizontal: 18, marginTop: 14, backgroundColor: Colors.bg2, borderWidth: 1, borderColor: Colors.border, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 12, gap: 10 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  flame: { fontSize: 16, color: Colors.tx3 },
  count: { flex: 1, fontFamily: Typography.headingBold, fontSize: 14.5, fontWeight: '700', color: Colors.tx },
  kept: { fontFamily: Typography.body, fontSize: 12, fontWeight: '400', color: Colors.teal },
  more: { fontSize: 20, color: Colors.tx3 },
  repair: { backgroundColor: 'rgba(252,211,77,0.07)', borderWidth: 1, borderColor: 'rgba(252,211,77,0.3)', borderRadius: 12, padding: 11, gap: 9 },
  repairTxt: { fontFamily: Typography.body, fontSize: 13, color: Colors.tx2, lineHeight: 18 },
  repairBtn: { alignSelf: 'flex-start', backgroundColor: Colors.amber, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 7 },
  repairBtnTxt: { fontFamily: Typography.headingBold, fontSize: 12.5, fontWeight: '700', color: '#1a1405' },
  ci: { gap: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.border, paddingTop: 10 },
  ciQ: { fontFamily: Typography.bodyMedium, fontSize: 13.5, fontWeight: '500', color: Colors.tx },
  ciOpts: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  ciChip: { paddingVertical: 7, paddingHorizontal: 12 },
  done: { fontFamily: Typography.body, fontSize: 12.5, color: Colors.tx3 },
});
