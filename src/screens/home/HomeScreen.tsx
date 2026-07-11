// src/screens/home/HomeScreen.tsx — Redesign v3 (B2)
//
// The Oura pattern: open on the outcome, never a demand.
//   • Breathing ring with today's "air given back" in lb
//   • Moko-Avi's one interpretive line beneath it
//   • Today's flow: every activity, source-tagged, one stream
//
// Math: givenBack = max(0, BASELINE_KG_PER_DAY − emittedToday) in lb.
// Baseline 28.6 kg/day is the same constant WeeklyWrapped has always used.
// If nothing is logged today, we show 0.0 — an empty day earns nothing,
// it invites. (No fake credit for silence.)

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
import { Colors, Typography } from '../../constants/theme';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../lib/authStore';

const BASELINE_KG_PER_DAY = 28.6;
const KG_TO_LB = 2.20462;

const CATEGORY_ICONS: Record<string, string> = {
  transport: '🚗',
  food: '🥗',
  energy: '⚡',
  digital: '📱',
  other: '♻️',
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

function lb(kg: number): string {
  return (kg * KG_TO_LB).toFixed(1);
}

export default function HomeScreen({ navigation }: any) {
  const { profile } = useAuthStore();
  const insets = useSafeAreaInsets();

  const [activities, setActivities] = useState<any[]>([]);
  const [givenBackLb, setGivenBackLb] = useState(0);
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

    const dayStart = new Date();
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date();
    dayEnd.setHours(23, 59, 59, 999);

    const { data } = await supabase
      .from('activities')
      .select('id, label, category, activity_type, co2_kg, logged_at, source')
      .eq('user_id', profile.id)
      .gte('logged_at', dayStart.toISOString())
      .lte('logged_at', dayEnd.toISOString())
      .order('logged_at', { ascending: false });

    const acts = data ?? [];
    setActivities(acts);

    const emittedKg = acts.reduce((sum, a) => sum + (a.co2_kg ?? 0), 0);
    const given =
      acts.length === 0
        ? 0
        : Math.max(0, (BASELINE_KG_PER_DAY - emittedKg) * KG_TO_LB);
    setGivenBackLb(given);
  }, [profile?.id]);

  const loadMoko = useCallback(async () => {
    if (!profile?.id) return;
    try {
      const { data, error } = await supabase.functions.invoke('moko-avi-summary', {
        body: { user_id: profile.id, userId: profile.id },
      });
      if (error) throw error;
      const line =
        data?.summary ?? data?.message ?? data?.text ?? data?.line ?? null;
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

  const initials =
    profile?.full_name
      ?.split(' ')
      .map((w: string) => w[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() || '🌿';

  const giftLine =
    activities.length === 0
      ? 'Your day hasn’t started breathing yet'
      : `${(givenBackLb / (BASELINE_KG_PER_DAY * KG_TO_LB)).toFixed(1)} days of clean air, given back`;

  return (
    <View style={[s.root, { paddingTop: insets.top || 12 }]}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.bg} />

      {/* Header */}
      <View style={s.topbar}>
        <Text style={s.wordmark}>
          eco<Text style={s.wordmarkAccent}>pulse</Text>
        </Text>
        <TouchableOpacity
          style={s.avatar}
          onPress={() => navigation.navigate('You')}
          activeOpacity={0.7}
        >
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
        {/* Breathing ring */}
        <View style={s.hero}>
          <Animated.View style={[s.ring, { transform: [{ scale: breathe }] }]}>
            <View style={s.ringInner}>
              <Text style={s.ringNumber}>{givenBackLb.toFixed(1)}</Text>
              <Text style={s.ringUnit}>LB GIVEN BACK TODAY</Text>
            </View>
          </Animated.View>
          <Text style={s.gift}>{giftLine}</Text>
          <View style={s.mokoRow}>
            <View style={s.mokoDot} />
            <Text style={s.mokoTxt}>
              {mokoLine ?? 'Moko-Avi is listening — a few more days and it starts to speak.'}
            </Text>
          </View>
        </View>

        {/* Today's flow */}
        <View style={s.flowHead}>
          <Text style={s.flowTitle}>TODAY’S FLOW</Text>
          <TouchableOpacity onPress={() => navigation.navigate('ActivityDetail')}>
            <Text style={s.flowAll}>All →</Text>
          </TouchableOpacity>
        </View>

        {activities.length === 0 ? (
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
          activities.map((act) => {
            const time = new Date(act.logged_at).toLocaleTimeString(undefined, {
              hour: 'numeric',
              minute: '2-digit',
            });
            return (
              <View key={act.id} style={s.row}>
                <View style={s.rowIcon}>
                  <Text style={{ fontSize: 16 }}>{CATEGORY_ICONS[act.category] ?? '🌿'}</Text>
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

        {activities.length > 0 && (
          <TouchableOpacity
            style={s.logLink}
            onPress={() => navigation.navigate('LogActivity')}
            activeOpacity={0.7}
          >
            <Text style={s.logLinkTxt}>＋ Log something by hand</Text>
          </TouchableOpacity>
        )}
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
  ringInner: { alignItems: 'center', gap: 6 },
  ringNumber: {
    fontFamily: Typography.heading,
    fontSize: 46,
    color: Colors.lime,
    letterSpacing: -1.5,
    lineHeight: 50,
  },
  ringUnit: {
    fontFamily: Typography.headingBold,
    fontSize: 8,
    color: Colors.tx3,
    letterSpacing: 1.5,
  },
  gift: { fontFamily: Typography.body, fontSize: 14, color: Colors.teal, marginTop: 16, fontStyle: 'italic' },
  mokoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
    maxWidth: 300,
  },
  mokoDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.teal },
  mokoTxt: {
    fontFamily: Typography.body,
    fontSize: 12,
    color: Colors.tx2,
    textAlign: 'center',
    lineHeight: 18,
    flexShrink: 1,
  },

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

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 18,
    paddingVertical: 11,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  rowIcon: {
    width: 38,
    height: 38,
    borderRadius: 11,
    backgroundColor: Colors.sf,
    justifyContent: 'center',
    alignItems: 'center',
  },
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
});
