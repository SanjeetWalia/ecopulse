// src/screens/home/HomeScreen.tsx — Today (Section M)
//
// The Oura pattern: open on the outcome, never a demand.
//   • Breathing ring with "air given back" — TAP IT to cycle the scope
//     (today → week → month → year). The scope lives on the number itself.
//   • Moko-Avi's one interpretive line beneath it — tap to open eco-chat
//   • The flow: every activity in scope, source-tagged, one stream
//   • Where your air went: composition bar + contribution rows
//   • Optimizer: moves ranked by projected lb
//
// The last two sections came from AirScreen. Composition is the answer to
// "why is my number what it is," so it belongs directly under the number
// rather than one tab away (OBS-013). AirScreen is preserved but unrouted.
//
// Math lives in src/lib/scope.ts so Home and Pulse cannot drift apart.

import React, { useCallback, useRef, useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  Animated,
  RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import { Colors, Typography } from '../../constants/theme';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../lib/authStore';
import {
  Scope,
  SCOPES,
  SCOPE_LABEL,
  SCOPE_FLOW_TITLE,
  nextScope,
  scopeRange,
  givenBackLb as computeGivenBack,
  lb,
  KG_TO_LB,
} from '../../lib/scope';
import StreakCard from '../../components/StreakCard';
import HeadsUpBanner from '../../components/HeadsUpBanner';

const CATEGORY_META: Record<string, { label: string; icon: string; color: string }> = {
  transport: { label: 'Getting around', icon: '🚗', color: Colors.amber },
  food: { label: 'Food choices', icon: '🥗', color: Colors.lime },
  energy: { label: 'Home energy', icon: '⚡', color: Colors.teal },
  digital: { label: 'Digital life', icon: '📱', color: Colors.sky },
  other: { label: 'Everything else', icon: '♻️', color: Colors.coral },
};

const SOURCE_LABELS: Record<string, string> = {
  snap: '📷 snapped',
  photo: '📷 snapped',
  health: '🍎 health',
  apple_health: '🍎 health',
  manual: '✏️ logged',
};

function sourceLabel(source: string | null | undefined): string {
  if (!source) return '✏️ logged';
  return SOURCE_LABELS[source] ?? '✏️ logged';
}

interface CatRow {
  key: string;
  label: string;
  icon: string;
  color: string;
  kg: number;
  count: number;
}

// Flow stays readable at wide scopes — the full ledger is one tap away.
const FLOW_LIMIT: Record<Scope, number> = { today: 100, week: 40, month: 25, year: 15 };

export default function HomeScreen({ navigation }: any) {
  const { profile } = useAuthStore();
  const insets = useSafeAreaInsets();

  const [scope, setScope] = useState<Scope>('today');
  const [activities, setActivities] = useState<any[]>([]);
  const [givenBack, setGivenBack] = useState(0);
  const [rows, setRows] = useState<CatRow[]>([]);
  const [totalKg, setTotalKg] = useState(0);
  const [mokoLine, setMokoLine] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Breathing ring — core Animated, no Reanimated dependency.
  const breathe = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(breathe, { toValue: 1.03, duration: 2300, useNativeDriver: true }),
        Animated.timing(breathe, { toValue: 1.0, duration: 2300, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [breathe]);

  const load = useCallback(async () => {
    if (!profile?.id) return;

    const { start, days } = scopeRange(scope);

    const { data } = await supabase
      .from('activities')
      .select('id, label, category, activity_type, co2_kg, logged_at, source')
      .eq('user_id', profile.id)
      .gte('logged_at', start.toISOString())
      .order('logged_at', { ascending: false });

    const acts = data ?? [];
    setActivities(acts);

    const byCat: Record<string, { kg: number; count: number }> = {};
    let total = 0;
    for (const a of acts) {
      const cat = a.category ?? 'other';
      if (!byCat[cat]) byCat[cat] = { kg: 0, count: 0 };
      byCat[cat].kg += a.co2_kg ?? 0;
      byCat[cat].count += 1;
      total += a.co2_kg ?? 0;
    }

    setRows(
      Object.entries(byCat)
        .map(([key, v]) => ({
          key,
          label: CATEGORY_META[key]?.label ?? key,
          icon: CATEGORY_META[key]?.icon ?? '🌿',
          color: CATEGORY_META[key]?.color ?? Colors.lime,
          kg: v.kg,
          count: v.count,
        }))
        .sort((a, b) => b.kg - a.kg)
    );
    setTotalKg(total);
    setGivenBack(computeGivenBack(total, acts.length, days));
  }, [profile?.id, scope]);

  const loadMoko = useCallback(async () => {
    if (!profile?.id) return;
    try {
      const { data, error } = await supabase.functions.invoke('moko-avi-summary', {
        body: { user_id: profile.id, userId: profile.id },
      });
      if (error) throw error;
      const line = data?.summary ?? data?.message ?? data?.text ?? data?.line ?? null;
      if (typeof line === 'string' && line.trim().length > 0) {
        setMokoLine(line.trim());
      }
    } catch {
      setMokoLine(null); // fall back to the learning line below
    }
  }, [profile?.id]);

  useFocusEffect(
    useCallback(() => {
      load();
      loadMoko();
    }, [load, loadMoko])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([load(), loadMoko()]);
    setRefreshing(false);
  };

  const cycleScope = () => {
    Haptics.selectionAsync().catch(() => {});
    setScope((cur) => nextScope(cur));
  };

  const initials =
    profile?.full_name
      ?.split(' ')
      .map((w: string) => w[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() || '🌿';

  const { days } = scopeRange(scope);
  const giftLine =
    activities.length === 0
      ? scope === 'today'
        ? 'Your day hasn’t started breathing yet'
        : `Nothing counted ${SCOPE_LABEL[scope].toLowerCase()} yet`
      : `${(givenBack / (28.6 * KG_TO_LB)).toFixed(1)} days of clean air, given back`;

  // Optimizer: rule-based moves off the user's own composition, expressed
  // weekly. Personalization proper arrives with observed facts (Section N).
  const suggestions = (() => {
    const out: { icon: string; title: string; sub: string; gainLbWk: number }[] = [];
    const top = rows[0];
    if (!top) return out;

    const weeks = Math.max(days / 7, 1);
    const weeklyTenPct = (top.kg * KG_TO_LB * 0.1) / weeks;
    const slice = `your biggest slice ${SCOPE_LABEL[scope].toLowerCase()}`;

    if (top.key === 'transport') {
      out.push({ icon: '🚲', title: 'Swap two short drives for rides', sub: `Getting around is ${slice}`, gainLbWk: weeklyTenPct });
    } else if (top.key === 'food') {
      out.push({ icon: '🥦', title: 'Two more plant-based meals a week', sub: `Food is ${slice}`, gainLbWk: weeklyTenPct });
    } else if (top.key === 'energy') {
      out.push({ icon: '🌡️', title: 'Nudge the thermostat 2°', sub: `Home energy is ${slice}`, gainLbWk: weeklyTenPct });
    } else {
      out.push({ icon: '🫧', title: `Trim your ${top.label.toLowerCase()}`, sub: `That is ${slice}`, gainLbWk: weeklyTenPct });
    }

    const second = rows[1];
    if (second) {
      out.push({
        icon: second.icon,
        title: `One lighter ${second.label.toLowerCase()} day a week`,
        sub: 'Your second-biggest slice',
        gainLbWk: (second.kg * KG_TO_LB * 0.1) / weeks,
      });
    }
    return out;
  })();

  const flow = activities.slice(0, FLOW_LIMIT[scope]);

  return (
    <View style={[s.root, { paddingTop: insets.top || 12 }]}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.bg} />

      {/* Header */}
      <View style={s.topbar}>
        <Text style={s.wordmark}>
          eco<Text style={s.wordmarkAccent}>pulse</Text>
        </Text>
        <TouchableOpacity style={s.avatar} onPress={() => navigation.navigate('You')} activeOpacity={0.7}>
          <Text style={s.avatarTxt}>{initials}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.lime} />
        }
      >
        {/* Breathing ring — the scope control */}
        <View style={s.hero}>
          <TouchableOpacity onPress={cycleScope} activeOpacity={0.85}>
            <Animated.View style={[s.ring, { transform: [{ scale: breathe }] }]}>
              <View style={s.ringInner}>
                <Text style={s.ringNumber}>
                  {scope === 'today' ? givenBack.toFixed(1) : givenBack.toFixed(0)}
                </Text>
                <Text style={s.ringUnit}>LB GIVEN BACK</Text>
                <Text style={s.ringScope}>{SCOPE_LABEL[scope]}</Text>
              </View>
            </Animated.View>
          </TouchableOpacity>

          {/* The same control, spelled out — tapping the ring is discoverable
              only once you know it exists. */}
          <View style={s.scopeRow}>
            {SCOPES.map((sc) => (
              <TouchableOpacity
                key={sc}
                onPress={() => {
                  Haptics.selectionAsync().catch(() => {});
                  setScope(sc);
                }}
                style={[s.scopePill, scope === sc && s.scopePillOn]}
                activeOpacity={0.8}
              >
                <Text style={[s.scopePillTxt, scope === sc && s.scopePillTxtOn]}>
                  {sc === 'today' ? 'Day' : sc === 'week' ? 'Week' : sc === 'month' ? 'Month' : 'Year'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={s.gift}>{giftLine}</Text>

          {/* Moko-Avi's line is the door to eco-chat — chat is the
              interpretation layer, not a destination of its own. */}
          <TouchableOpacity
            style={s.mokoRow}
            onPress={() => navigation.navigate('EcoChat')}
            activeOpacity={0.75}
          >
            <View style={s.mokoDot} />
            <Text style={s.mokoTxt}>
              {mokoLine ?? 'Moko-Avi is listening — a few more days and it starts to speak.'}
            </Text>
            <Text style={s.mokoArrow}>→</Text>
          </TouchableOpacity>
        </View>

        {/* Heads up: only items that touch something this person bought or
            scanned reach Today. Everything else waits in the weekly digest. */}
        <HeadsUpBanner navigation={navigation} />

        {/* Streak and today's check-ins (v5). */}
        <StreakCard navigation={navigation} />

        {/* The flow */}
        <View style={s.flowHead}>
          <Text style={s.flowTitle}>{SCOPE_FLOW_TITLE[scope]}</Text>
          <TouchableOpacity onPress={() => navigation.navigate('ActivityDetail')}>
            <Text style={s.flowAll}>All →</Text>
          </TouchableOpacity>
        </View>

        {flow.length === 0 ? (
          <View style={s.empty}>
            <Text style={s.emptyIcon}>🫧</Text>
            <Text style={s.emptyTxt}>
              Snap something with the camera below, or{' '}
              <Text style={s.emptyLink} onPress={() => navigation.navigate('LogActivity')}>
                log it by hand
              </Text>
              .
            </Text>
          </View>
        ) : (
          flow.map((act) => {
            const d = new Date(act.logged_at);
            const time =
              scope === 'today'
                ? d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
                : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
            return (
              <View key={act.id} style={s.row}>
                <View style={s.rowIcon}>
                  <Text style={{ fontSize: 16 }}>{CATEGORY_META[act.category]?.icon ?? '🌿'}</Text>
                </View>
                <View style={s.rowMid}>
                  <Text style={s.rowLabel} numberOfLines={1}>
                    {(act.label || act.activity_type || 'Activity').split('·')[0].trim()}
                  </Text>
                  <Text style={s.rowMeta}>
                    {time} · {sourceLabel(act.source)}
                  </Text>
                </View>
                <Text style={s.rowVal}>{lb(act.co2_kg ?? 0)} lb</Text>
              </View>
            );
          })
        )}

        {activities.length > flow.length && (
          <Text style={s.flowMore}>
            +{activities.length - flow.length} more this period
          </Text>
        )}

        {activities.length > 0 && (
          <TouchableOpacity style={s.logLink} onPress={() => navigation.navigate('LogActivity')} activeOpacity={0.7}>
            <Text style={s.logLinkTxt}>＋ Log something by hand</Text>
          </TouchableOpacity>
        )}

        {/* Where your air went — was AirScreen */}
        {totalKg > 0 && (
          <View style={s.pad}>
            <Text style={s.sect}>WHERE YOUR AIR WENT</Text>
            <View style={s.comp}>
              {rows.map((r) => (
                <View key={r.key} style={{ flex: Math.max(r.kg, 0.001), backgroundColor: r.color, borderRadius: 3 }} />
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

            {rows.map((r) => (
              <View key={r.key} style={s.srcRow}>
                <View style={[s.srcDot, { backgroundColor: r.color }]} />
                <View style={s.srcMid}>
                  <Text style={s.srcL1}>{r.label}</Text>
                  <Text style={s.srcL2}>
                    {r.count} {r.count === 1 ? 'entry' : 'entries'} {SCOPE_LABEL[scope].toLowerCase()}
                  </Text>
                </View>
                <Text style={s.srcVal}>{(r.kg * KG_TO_LB).toFixed(0)} lb</Text>
              </View>
            ))}
          </View>
        )}

        {/* Optimizer — was AirScreen */}
        {suggestions.length > 0 && (
          <View style={s.pad}>
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
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg },
  pad: { paddingHorizontal: 18 },
  topbar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  wordmark: { fontFamily: Typography.heading, fontSize: 20, color: Colors.tx, letterSpacing: -0.5 },
  wordmarkAccent: { color: Colors.lime },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.sf,
    borderWidth: 1,
    borderColor: Colors.border2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarTxt: { fontFamily: Typography.headingBold, fontSize: 11, color: Colors.lime },

  hero: { alignItems: 'center', paddingTop: 18, paddingBottom: 10, paddingHorizontal: 24 },
  ring: {
    width: 190,
    height: 190,
    borderRadius: 95,
    borderWidth: 8,
    borderColor: Colors.lime,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: Colors.lime,
    shadowOpacity: 0.35,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 0 },
    elevation: 10,
  },
  ringInner: { alignItems: 'center', gap: 4 },
  ringNumber: { fontFamily: Typography.heading, fontSize: 46, color: Colors.lime, letterSpacing: -1.5, lineHeight: 50 },
  ringUnit: { fontFamily: Typography.headingBold, fontSize: 8, color: Colors.tx3, letterSpacing: 1.5 },
  ringScope: { fontFamily: Typography.headingBold, fontSize: 8, color: Colors.teal, letterSpacing: 1.5 },

  scopeRow: { flexDirection: 'row', gap: 6, marginTop: 16 },
  scopePill: {
    paddingHorizontal: 13,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  scopePillOn: { backgroundColor: 'rgba(200,244,90,0.12)', borderColor: Colors.border2 },
  scopePillTxt: { fontFamily: Typography.headingBold, fontSize: 10.5, color: Colors.tx3 },
  scopePillTxtOn: { color: Colors.lime },

  gift: { fontFamily: Typography.body, fontSize: 14, color: Colors.teal, marginTop: 14, fontStyle: 'italic', textAlign: 'center' },
  mokoRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10, maxWidth: 320 },
  mokoDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.teal },
  mokoTxt: { fontFamily: Typography.body, fontSize: 12, color: Colors.tx2, lineHeight: 18, flexShrink: 1 },
  mokoArrow: { fontFamily: Typography.headingBold, fontSize: 12, color: Colors.teal },

  flowHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    paddingHorizontal: 18,
    marginTop: 14,
    marginBottom: 4,
  },
  flowTitle: { fontFamily: Typography.headingBold, fontSize: 10, color: Colors.tx3, letterSpacing: 2 },
  flowAll: { fontFamily: Typography.headingBold, fontSize: 11, color: Colors.teal },
  flowMore: { fontFamily: Typography.body, fontSize: 11, color: Colors.tx3, textAlign: 'center', paddingTop: 12 },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 18,
    paddingVertical: 11,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  rowIcon: { width: 38, height: 38, borderRadius: 11, backgroundColor: Colors.sf, justifyContent: 'center', alignItems: 'center' },
  rowMid: { flex: 1, minWidth: 0 },
  rowLabel: { fontFamily: Typography.headingBold, fontSize: 13.5, color: Colors.tx },
  rowMeta: { fontFamily: Typography.body, fontSize: 10.5, color: Colors.tx3, marginTop: 2 },
  rowVal: { fontFamily: Typography.headingBold, fontSize: 13, color: Colors.tx2 },

  empty: { alignItems: 'center', paddingVertical: 28, paddingHorizontal: 40, gap: 10 },
  emptyIcon: { fontSize: 34 },
  emptyTxt: { fontFamily: Typography.body, fontSize: 13, color: Colors.tx2, textAlign: 'center', lineHeight: 20 },
  emptyLink: { color: Colors.lime, fontFamily: Typography.headingBold },

  logLink: { alignItems: 'center', paddingVertical: 16 },
  logLinkTxt: { fontFamily: Typography.headingBold, fontSize: 12, color: Colors.tx3 },

  sect: { fontFamily: Typography.headingBold, fontSize: 9.5, color: Colors.tx3, letterSpacing: 2, marginTop: 14, marginBottom: 8 },
  comp: { flexDirection: 'row', height: 10, borderRadius: 5, overflow: 'hidden', gap: 2, marginBottom: 8 },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 4 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 7, height: 7, borderRadius: 2 },
  legendTxt: { fontFamily: Typography.body, fontSize: 9.5, color: Colors.tx3, textTransform: 'uppercase', letterSpacing: 0.8 },

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
});
