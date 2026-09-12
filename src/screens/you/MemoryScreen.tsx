// src/screens/you/MemoryScreen.tsx — Section N4
//
// What Eco Pulse remembers, in plain language, each line deletable.
//
// Two reasons this screen exists. People trust what they can correct: a memory
// layer the user cannot see is a memory layer they have to take on faith, and
// the first time it gets something wrong they have no way to fix it. And it is
// the cheapest possible answer to an App Store privacy question — the reviewer
// can see exactly what is stored and remove it.
//
// Told vs worked out is surfaced, not hidden. An inference the app made should
// never look like something the user said (OBS-015).

import React, { useCallback, useState } from 'react';
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
import { useFocusEffect } from '@react-navigation/native';
import { Colors, Typography } from '../../constants/theme';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../lib/authStore';

interface Fact {
  id: string;
  key: string;
  fact_type: string;
  value: any;
  origin: 'stated' | 'observed' | null;
  updated_at: string;
}

const TYPE_ICON: Record<string, string> = {
  vehicle: '🚗',
  diet: '🥗',
  home_energy: '⚡',
  household: '🏠',
  habit: '🔁',
  other: '🌿',
};

// Keys the observer writes, rendered as sentences rather than JSON.
function describe(f: Fact): { title: string; detail: string } {
  const v = f.value ?? {};

  switch (f.key) {
    case 'personal_baseline':
      return {
        title: 'Your usual day',
        detail: `About ${Number(v.kg_per_day ?? 0).toFixed(1)} kg of CO₂e, averaged over ${v.days_used ?? 10} days`,
      };
    case 'category_mix':
      return {
        title: 'Where your footprint sits',
        detail: `Mostly ${v.dominant ?? 'unknown'} — transport ${v.transport_pct ?? 0}%, food ${v.food_pct ?? 0}%, energy ${v.energy_pct ?? 0}%, digital ${v.digital_pct ?? 0}%`,
      };
    case 'logging_cadence':
      return {
        title: 'How often you log',
        detail: `${v.days_logged ?? 0} of the last ${v.of_last ?? 14} days`,
      };
    case 'weekday_vs_weekend':
      return {
        title: 'Weekdays vs weekends',
        detail: `${v.heavier === 'weekend' ? 'Weekends' : 'Weekdays'} are heavier — ${Number(v.weekday_kg ?? 0).toFixed(1)} kg vs ${Number(v.weekend_kg ?? 0).toFixed(1)} kg`,
      };
    case 'vehicle':
      return {
        title: 'Your vehicle',
        detail: [v.year, v.make, v.model, v.fuel ? `(${v.fuel})` : null].filter(Boolean).join(' ') || readable(v),
      };
    case 'electricity_bill':
      return {
        title: 'Your electricity bill',
        detail: `${v.kwh ?? '?'} kWh over ${v.period_days ?? 30} days`,
      };
    default:
      return { title: humanKey(f.key), detail: readable(v) };
  }
}

function humanKey(key: string): string {
  return key.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());
}

function readable(v: any): string {
  if (v === null || v === undefined) return '—';
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  const parts = Object.entries(v)
    .filter(([k]) => k !== 'computed_at' && k !== 'noted_at')
    .map(([k, val]) => `${k.replace(/_/g, ' ')}: ${typeof val === 'object' ? JSON.stringify(val) : val}`);
  return parts.join(' · ') || '—';
}

export default function MemoryScreen({ navigation }: any) {
  const { profile } = useAuthStore();
  const insets = useSafeAreaInsets();

  const [facts, setFacts] = useState<Fact[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!profile?.id) return;
    setLoading(true);
    const { data } = await supabase
      .from('user_facts')
      .select('id, key, fact_type, value, origin, updated_at')
      .eq('user_id', profile.id)
      .order('updated_at', { ascending: false });
    setFacts((data as Fact[]) ?? []);
    setLoading(false);
  }, [profile?.id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const forget = (f: Fact) => {
    const { title } = describe(f);
    Alert.alert(
      'Forget this?',
      `"${title}" will be removed. If you mention it again, it comes back.`,
      [
        { text: 'Keep', style: 'cancel' },
        {
          text: 'Forget',
          style: 'destructive',
          onPress: async () => {
            setBusyId(f.id);
            const { error } = await supabase.from('user_facts').delete().eq('id', f.id);
            setBusyId(null);
            if (error) {
              Alert.alert('Could not forget', error.message);
              return;
            }
            setFacts((cur) => cur.filter((x) => x.id !== f.id));
          },
        },
      ]
    );
  };

  const stated = facts.filter((f) => f.origin !== 'observed');
  const observed = facts.filter((f) => f.origin === 'observed');

  const renderFact = (f: Fact) => {
    const { title, detail } = describe(f);
    return (
      <View key={f.id} style={s.row}>
        <Text style={s.rowIcon}>{TYPE_ICON[f.fact_type] ?? '🌿'}</Text>
        <View style={s.rowMid}>
          <Text style={s.rowL1}>{title}</Text>
          <Text style={s.rowL2}>{detail}</Text>
        </View>
        <TouchableOpacity onPress={() => forget(f)} disabled={busyId === f.id} activeOpacity={0.7}>
          {busyId === f.id ? (
            <ActivityIndicator size="small" color={Colors.tx3} />
          ) : (
            <Text style={s.forget}>Forget</Text>
          )}
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <View style={[s.root, { paddingTop: insets.top || 12 }]}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.bg} />

      <View style={s.topbar}>
        <TouchableOpacity onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <Text style={s.back}>←</Text>
        </TouchableOpacity>
        <Text style={s.topLabel}>MEMORY</Text>
        <View style={{ width: 20 }} />
      </View>

      <ScrollView
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: 40 }}
      >
        <Text style={s.intro}>
          Everything Eco Pulse knows about you sits here. It uses these to make your
          numbers yours rather than an average. Remove anything, any time.
        </Text>

        {loading ? (
          <ActivityIndicator style={{ marginTop: 30 }} color={Colors.lime} />
        ) : facts.length === 0 ? (
          <View style={s.empty}>
            <Text style={{ fontSize: 30 }}>🫧</Text>
            <Text style={s.emptyTxt}>
              Nothing yet. Tell Moko-Avi about your car, your diet or your home and it
              starts calibrating to you.
            </Text>
          </View>
        ) : (
          <>
            <Text style={s.sect}>WHAT YOU TOLD IT</Text>
            {stated.length === 0 ? (
              <Text style={s.none}>Nothing yet.</Text>
            ) : (
              stated.map(renderFact)
            )}

            <Text style={s.sect}>WHAT IT WORKED OUT</Text>
            {observed.length === 0 ? (
              <Text style={s.none}>
                Ten days of logging and patterns start appearing here.
              </Text>
            ) : (
              observed.map(renderFact)
            )}
          </>
        )}

        <Text style={s.footnote}>
          Memory never leaves your account. Deleting your account deletes all of it.
        </Text>
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
  back: { fontSize: 22, color: Colors.tx2 },
  topLabel: { fontFamily: Typography.headingBold, fontSize: 9, color: Colors.tx3, letterSpacing: 2 },

  intro: { fontFamily: Typography.body, fontSize: 12.5, color: Colors.tx2, lineHeight: 19, marginTop: 6 },
  sect: { fontFamily: Typography.headingBold, fontSize: 9.5, color: Colors.tx3, letterSpacing: 2, marginTop: 20, marginBottom: 8 },
  none: { fontFamily: Typography.body, fontSize: 12, color: Colors.tx3, lineHeight: 18 },

  row: {
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
  rowIcon: { fontSize: 15 },
  rowMid: { flex: 1, minWidth: 0 },
  rowL1: { fontFamily: Typography.headingBold, fontSize: 13, color: Colors.tx },
  rowL2: { fontFamily: Typography.body, fontSize: 10.5, color: Colors.tx3, marginTop: 2, lineHeight: 15 },
  forget: { fontFamily: Typography.headingBold, fontSize: 10.5, color: Colors.coral },

  empty: { alignItems: 'center', paddingVertical: 30, gap: 10, paddingHorizontal: 20 },
  emptyTxt: { fontFamily: Typography.body, fontSize: 12.5, color: Colors.tx2, textAlign: 'center', lineHeight: 19 },

  footnote: { fontFamily: Typography.body, fontSize: 10, color: Colors.tx3, textAlign: 'center', marginTop: 26, lineHeight: 15 },
});
