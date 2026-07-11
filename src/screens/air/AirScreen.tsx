// src/screens/air/AirScreen.tsx — Redesign v3 (B4)
//
// Where the number comes from. No switches anywhere.
//   • Chat bar (placeholder — eco-chat ships next batch)
//   • This month's given-back number
//   • Composition bar + contribution rows, color-keyed by category
//   • Optimizer: personalized moves ranked by projected lb (v1: rule-based)
//   • Unclaimed air: what the number is missing

import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Colors, Typography } from '../../constants/theme';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../lib/authStore';

const BASELINE_KG_PER_DAY = 28.6;
const KG_TO_LB = 2.20462;

const CATEGORY_META: Record<string, { label: string; icon: string; color: string }> = {
  transport: { label: 'Getting around', icon: '🚗', color: Colors.amber },
  food: { label: 'Food choices', icon: '🥗', color: Colors.lime },
  energy: { label: 'Home energy', icon: '⚡', color: Colors.teal },
  digital: { label: 'Digital life', icon: '📱', color: Colors.sky },
  other: { label: 'Everything else', icon: '♻️', color: Colors.coral },
};

interface CatRow {
  key: string;
  label: string;
  icon: string;
  color: string;
  kg: number;
  count: number;
}

export default function AirScreen({ navigation }: any) {
  const { profile } = useAuthStore();
  const insets = useSafeAreaInsets();

  const [rows, setRows] = useState<CatRow[]>([]);
  const [givenBackLb, setGivenBackLb] = useState(0);
  const [totalKg, setTotalKg] = useState(0);

  const load = useCallback(async () => {
    if (!profile?.id) return;

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const { data } = await supabase
      .from('activities')
      .select('category, co2_kg')
      .eq('user_id', profile.id)
      .gte('logged_at', monthStart.toISOString());

    const acts = data ?? [];
    const byCat: Record<string, { kg: number; count: number }> = {};
    let total = 0;
    for (const a of acts) {
      const cat = a.category ?? 'other';
      if (!byCat[cat]) byCat[cat] = { kg: 0, count: 0 };
      byCat[cat].kg += a.co2_kg ?? 0;
      byCat[cat].count += 1;
      total += a.co2_kg ?? 0;
    }

    const catRows: CatRow[] = Object.entries(byCat)
      .map(([key, v]) => ({
        key,
        label: CATEGORY_META[key]?.label ?? key,
        icon: CATEGORY_META[key]?.icon ?? '🌿',
        color: CATEGORY_META[key]?.color ?? Colors.lime,
        kg: v.kg,
        count: v.count,
      }))
      .sort((a, b) => b.kg - a.kg);

    setRows(catRows);
    setTotalKg(total);

    const daysElapsed = now.getDate();
    const given = acts.length === 0
      ? 0
      : Math.max(0, (BASELINE_KG_PER_DAY * daysElapsed - total) * KG_TO_LB);
    setGivenBackLb(given);
  }, [profile?.id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  // ── Optimizer v1: rule-based suggestions from the user's own composition.
  // Real per-user modeling arrives with more data density; these estimates
  // are 10% of the top category's monthly lb, expressed weekly.
  const suggestions = (() => {
    const out: { icon: string; title: string; sub: string; gainLbWk: number }[] = [];
    const top = rows[0];
    if (!top) return out;

    const weeklyTenPct = (top.kg * KG_TO_LB * 0.1) / 4;

    if (top.key === 'transport') {
      out.push({
        icon: '🚲',
        title: 'Swap two short drives for rides',
        sub: 'Getting around is your biggest slice this month',
        gainLbWk: weeklyTenPct,
      });
    } else if (top.key === 'food') {
      out.push({
        icon: '🥦',
        title: 'Two more plant-based meals a week',
        sub: 'Food is your biggest slice this month',
        gainLbWk: weeklyTenPct,
      });
    } else if (top.key === 'energy') {
      out.push({
        icon: '🌡️',
        title: 'Nudge the thermostat 2°',
        sub: 'Home energy is your biggest slice this month',
        gainLbWk: weeklyTenPct,
      });
    } else {
      out.push({
        icon: '🫧',
        title: `Trim your ${top.label.toLowerCase()}`,
        sub: 'Your biggest slice this month',
        gainLbWk: weeklyTenPct,
      });
    }

    const second = rows[1];
    if (second) {
      out.push({
        icon: second.icon,
        title: `One lighter ${second.label.toLowerCase()} day a week`,
        sub: 'Your second-biggest slice',
        gainLbWk: (second.kg * KG_TO_LB * 0.1) / 4,
      });
    }
    return out;
  })();

  return (
    <View style={[s.root, { paddingTop: insets.top || 12 }]}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.bg} />

      <View style={s.topbar}>
        <Text style={s.wordmark}>
          eco<Text style={s.wordmarkAccent}>pulse</Text>
        </Text>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: 40 }}
      >
        {/* Eco-chat bar (placeholder until chat batch lands) */}
        <TouchableOpacity
          style={s.chatbar}
          activeOpacity={0.8}
          onPress={() =>
            Alert.alert('Eco-chat', 'Your ecological companion arrives in the next build — it will remember every answer.')
          }
        >
          <Text style={{ fontSize: 15 }}>🌱</Text>
          <Text style={s.chatQ}>Ask your air anything…</Text>
          <Text style={s.chatArrow}>→</Text>
        </TouchableOpacity>

        {/* This month's number */}
        <View style={s.airhead}>
          <Text style={s.airNum}>{givenBackLb.toFixed(0)}</Text>
          <Text style={s.airUnit}>LB GIVEN BACK THIS MONTH</Text>
        </View>

        {/* Composition bar */}
        {totalKg > 0 && (
          <>
            <View style={s.comp}>
              {rows.map((r) => (
                <View
                  key={r.key}
                  style={{ flex: Math.max(r.kg, 0.001), backgroundColor: r.color, borderRadius: 3 }}
                />
              ))}
            </View>
            <View style={s.legend}>
              {rows.map((r) => (
                <View key={r.key} style={s.legendItem}>
                  <View style={[s.legendDot, { backgroundColor: r.color }]} />
                  <Text style={s.legendTxt}>{r.label.toLowerCase()}</Text>
                </View>
              ))}
            </View>
          </>
        )}

        {/* Contributions */}
        <Text style={s.sect}>WHERE YOUR AIR WENT</Text>
        {rows.length === 0 ? (
          <View style={s.empty}>
            <Text style={{ fontSize: 30 }}>🫧</Text>
            <Text style={s.emptyTxt}>Nothing counted yet this month. Snap or log, and your composition appears here.</Text>
          </View>
        ) : (
          rows.map((r) => (
            <View key={r.key} style={s.srcRow}>
              <View style={[s.srcDot, { backgroundColor: r.color }]} />
              <View style={s.srcMid}>
                <Text style={s.srcL1}>{r.label}</Text>
                <Text style={s.srcL2}>
                  {r.count} {r.count === 1 ? 'entry' : 'entries'} this month
                </Text>
              </View>
              <Text style={s.srcVal}>{(r.kg * KG_TO_LB).toFixed(0)} lb</Text>
            </View>
          ))
        )}

        {/* Optimizer */}
        {suggestions.length > 0 && (
          <>
            <Text style={s.sect}>OPTIMIZER</Text>
            {suggestions.map((sg, i) => (
              <View key={i} style={s.opt}>
                <Text style={{ fontSize: 15 }}>{sg.icon}</Text>
                <View style={s.optMid}>
                  <Text style={s.optL1}>{sg.title}</Text>
                  <Text style={s.optL2}>{sg.sub}</Text>
                </View>
                <Text style={s.optGain}>+{sg.gainLbWk.toFixed(0)} lb/wk est.</Text>
              </View>
            ))}
          </>
        )}

        {/* Unclaimed air */}
        <Text style={s.sect}>AIR YOU HAVEN’T CLAIMED</Text>
        <View style={s.claim}>
          <Text style={{ fontSize: 16 }}>🍎</Text>
          <View style={s.claimMid}>
            <Text style={s.claimL1}>Your walks and rides go uncounted</Text>
            <Text style={s.claimL2}>Apple Health can breathe them in automatically — arriving with the next build.</Text>
          </View>
          <View style={s.claimBtn}>
            <Text style={s.claimBtnTxt}>Soon</Text>
          </View>
        </View>
        <View style={s.claim}>
          <Text style={{ fontSize: 16 }}>🗺️</Text>
          <View style={s.claimMid}>
            <Text style={s.claimL1}>Your trips are invisible</Text>
            <Text style={s.claimL2}>Timeline will see every mile without a single tap.</Text>
          </View>
          <View style={s.claimBtn}>
            <Text style={s.claimBtnTxt}>Soon</Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg },
  topbar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, paddingVertical: 10 },
  wordmark: { fontFamily: Typography.heading, fontSize: 20, color: Colors.tx, letterSpacing: -0.5 },
  wordmarkAccent: { color: Colors.lime },

  chatbar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    backgroundColor: Colors.sf,
    borderWidth: 1,
    borderColor: Colors.border2,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 8,
  },
  chatQ: { flex: 1, fontFamily: Typography.body, fontSize: 13, color: Colors.tx3, fontStyle: 'italic' },
  chatArrow: { color: Colors.lime, fontSize: 14 },

  airhead: { alignItems: 'center', paddingVertical: 14 },
  airNum: { fontFamily: Typography.heading, fontSize: 44, color: Colors.lime, letterSpacing: -1.5, lineHeight: 48 },
  airUnit: { fontFamily: Typography.headingBold, fontSize: 8, color: Colors.tx3, letterSpacing: 1.5, marginTop: 6 },

  comp: { flexDirection: 'row', height: 10, borderRadius: 5, overflow: 'hidden', gap: 2, marginBottom: 8 },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 4 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 7, height: 7, borderRadius: 2 },
  legendTxt: { fontFamily: Typography.body, fontSize: 9.5, color: Colors.tx3, textTransform: 'uppercase', letterSpacing: 0.8 },

  sect: { fontFamily: Typography.headingBold, fontSize: 9.5, color: Colors.tx3, letterSpacing: 2, marginTop: 18, marginBottom: 8 },

  srcRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  srcDot: { width: 8, height: 8, borderRadius: 4 },
  srcMid: { flex: 1, minWidth: 0 },
  srcL1: { fontFamily: Typography.headingBold, fontSize: 13.5, color: Colors.tx },
  srcL2: { fontFamily: Typography.body, fontSize: 10.5, color: Colors.tx3, marginTop: 2 },
  srcVal: { fontFamily: Typography.headingBold, fontSize: 13.5, color: Colors.lime },

  opt: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    backgroundColor: 'rgba(200,244,90,0.05)',
    borderWidth: 1,
    borderColor: Colors.border2,
    borderRadius: 14,
    paddingHorizontal: 13,
    paddingVertical: 11,
    marginBottom: 7,
  },
  optMid: { flex: 1, minWidth: 0 },
  optL1: { fontFamily: Typography.headingBold, fontSize: 12.5, color: Colors.tx },
  optL2: { fontFamily: Typography.body, fontSize: 10.5, color: Colors.tx3, marginTop: 2 },
  optGain: { fontFamily: Typography.headingBold, fontSize: 10.5, color: Colors.lime },

  claim: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: 'rgba(200,244,90,0.3)',
    borderRadius: 14,
    paddingHorizontal: 13,
    paddingVertical: 11,
    marginBottom: 7,
  },
  claimMid: { flex: 1, minWidth: 0 },
  claimL1: { fontFamily: Typography.headingBold, fontSize: 12.5, color: Colors.tx },
  claimL2: { fontFamily: Typography.body, fontSize: 10.5, color: Colors.tx3, marginTop: 2, lineHeight: 15 },
  claimBtn: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 5,
  },
  claimBtnTxt: { fontFamily: Typography.headingBold, fontSize: 9.5, color: Colors.tx3, letterSpacing: 1, textTransform: 'uppercase' },

  empty: { alignItems: 'center', paddingVertical: 24, gap: 10, paddingHorizontal: 30 },
  emptyTxt: { fontFamily: Typography.body, fontSize: 12.5, color: Colors.tx2, textAlign: 'center', lineHeight: 19 },
});
