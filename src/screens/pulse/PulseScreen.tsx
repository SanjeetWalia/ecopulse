// src/screens/pulse/PulseScreen.tsx — Redesign v3 (B5)
//
// Your number through time, together.
//   • Week / Month / Year toggle over given-back lb (from daily_summaries)
//   • 7-day sparkline of daily given-back
//   • Circle feed: shared_snaps from you + accepted friends (RLS does the
//     filtering — the client never sees strangers' rows)
//   • Leaves: one per person per snap, toggleable
//   • EcoKey invite card: your unspent codes, shared via the system sheet

import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  RefreshControl,
  Share,
  Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Colors, Typography } from '../../constants/theme';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../lib/authStore';

const BASELINE_KG_PER_DAY = 28.6;
const KG_TO_LB = 2.20462;

type Period = 'week' | 'month' | 'year';

interface FeedSnap {
  id: string;
  user_id: string;
  label: string;
  co2_kg: number;
  photo_path: string | null;
  created_at: string;
  full_name: string;
  leafCount: number;
  myLeaf: boolean;
  photoUrl?: string | null;
}

function initialsOf(name: string) {
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || '🌿';
}

function timeAgo(iso: string) {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function periodStart(p: Period): Date {
  const now = new Date();
  if (p === 'week') {
    const day = now.getDay();
    const monday = new Date(now);
    monday.setDate(now.getDate() - (day === 0 ? 6 : day - 1));
    monday.setHours(0, 0, 0, 0);
    return monday;
  }
  if (p === 'month') return new Date(now.getFullYear(), now.getMonth(), 1);
  return new Date(now.getFullYear(), 0, 1);
}

const FRIEND_COLORS = ['#5BC8A8', '#7DD3FC', '#FCD34D', '#FB923C', '#FB7185', '#A78BFA'];
function colorFor(userId: string) {
  let h = 0;
  for (let i = 0; i < userId.length; i++) h = (h * 31 + userId.charCodeAt(i)) >>> 0;
  return FRIEND_COLORS[h % FRIEND_COLORS.length];
}

export default function PulseScreen() {
  const { profile } = useAuthStore();
  const insets = useSafeAreaInsets();

  const [period, setPeriod] = useState<Period>('week');
  const [givenLb, setGivenLb] = useState(0);
  const [deltaPct, setDeltaPct] = useState<number | null>(null);
  const [spark, setSpark] = useState<number[]>([]);
  const [feed, setFeed] = useState<FeedSnap[]>([]);
  const [unspentCode, setUnspentCode] = useState<string | null>(null);
  const [unspentCount, setUnspentCount] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const loadNumbers = useCallback(async (p: Period) => {
    if (!profile?.id) return;

    const start = periodStart(p);
    const startStr = start.toISOString().slice(0, 10);

    const { data } = await supabase
      .from('daily_summaries')
      .select('date, total_co2_kg')
      .eq('user_id', profile.id)
      .gte('date', startStr)
      .order('date', { ascending: true });

    const rows = data ?? [];
    const emittedKg = rows.reduce((s, r) => s + Number(r.total_co2_kg || 0), 0);
    const daysElapsed = Math.max(1, Math.floor((Date.now() - start.getTime()) / 86400000) + 1);
    const given = rows.length === 0
      ? 0
      : Math.max(0, (BASELINE_KG_PER_DAY * daysElapsed - emittedKg) * KG_TO_LB);
    setGivenLb(given);

    // Delta vs previous equal-length period
    const prevStart = new Date(start.getTime() - daysElapsed * 86400000);
    const { data: prevData } = await supabase
      .from('daily_summaries')
      .select('total_co2_kg')
      .eq('user_id', profile.id)
      .gte('date', prevStart.toISOString().slice(0, 10))
      .lt('date', startStr);
    const prevRows = prevData ?? [];
    if (prevRows.length > 0 && rows.length > 0) {
      const prevEmitted = prevRows.reduce((s, r) => s + Number(r.total_co2_kg || 0), 0);
      const prevGiven = Math.max(0.001, (BASELINE_KG_PER_DAY * daysElapsed - prevEmitted) * KG_TO_LB);
      setDeltaPct(Math.round(((given - prevGiven) / prevGiven) * 100));
    } else {
      setDeltaPct(null);
    }

    // 7-day sparkline (always last 7 days, independent of period)
    const sevenAgo = new Date(Date.now() - 6 * 86400000).toISOString().slice(0, 10);
    const { data: sparkData } = await supabase
      .from('daily_summaries')
      .select('date, total_co2_kg')
      .eq('user_id', profile.id)
      .gte('date', sevenAgo)
      .order('date', { ascending: true });
    const byDate = new Map((sparkData ?? []).map(r => [r.date, Number(r.total_co2_kg || 0)]));
    const bars: number[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
      const kg = byDate.get(d);
      bars.push(kg === undefined ? 0 : Math.max(0, (BASELINE_KG_PER_DAY - kg) * KG_TO_LB));
    }
    setSpark(bars);
  }, [profile?.id]);

  const loadFeed = useCallback(async () => {
    if (!profile?.id) return;

    // RLS returns own + accepted friends' rows only.
    const { data: snaps } = await supabase
      .from('shared_snaps')
      .select('id, user_id, label, co2_kg, photo_path, created_at, profiles(full_name)')
      .order('created_at', { ascending: false })
      .limit(30);

    const rows = (snaps ?? []).map((r: any) => ({
      id: r.id,
      user_id: r.user_id,
      label: r.label,
      co2_kg: Number(r.co2_kg || 0),
      photo_path: r.photo_path,
      created_at: r.created_at,
      full_name: r.profiles?.full_name || 'Eco member',
      leafCount: 0,
      myLeaf: false,
      photoUrl: null as string | null,
    }));

    if (rows.length > 0) {
      const ids = rows.map(r => r.id);
      const { data: leaves } = await supabase
        .from('leaves')
        .select('snap_id, user_id')
        .in('snap_id', ids);
      for (const r of rows) {
        const ls = (leaves ?? []).filter(l => l.snap_id === r.id);
        r.leafCount = ls.length;
        r.myLeaf = ls.some(l => l.user_id === profile.id);
      }
      // Signed URLs for photos (private bucket)
      await Promise.all(
        rows.map(async (r) => {
          if (!r.photo_path) return;
          try {
            const { data: signed } = await supabase.storage
              .from('snaps')
              .createSignedUrl(r.photo_path, 3600);
            r.photoUrl = signed?.signedUrl ?? null;
          } catch {
            r.photoUrl = null;
          }
        })
      );
    }
    setFeed(rows);
  }, [profile?.id]);

  const loadKeys = useCallback(async () => {
    if (!profile?.id) return;
    const { data } = await supabase
      .from('invite_codes')
      .select('*')
      .eq('owner_id', profile.id);
    const codes = data ?? [];
    const unspent = codes.filter((c: any) =>
      c.status ? c.status === 'unused' : (c.uses ?? 0) === 0
    );
    setUnspentCount(unspent.length);
    setUnspentCode(unspent[0]?.code ?? null);
  }, [profile?.id]);

  useFocusEffect(
    useCallback(() => {
      loadNumbers(period);
      loadFeed();
      loadKeys();
    }, [loadNumbers, loadFeed, loadKeys, period])
  );

  const changePeriod = (p: Period) => {
    setPeriod(p);
    loadNumbers(p);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([loadNumbers(period), loadFeed(), loadKeys()]);
    setRefreshing(false);
  };

  const toggleLeaf = async (snap: FeedSnap) => {
    if (!profile?.id) return;
    // Optimistic
    setFeed(prev =>
      prev.map(f =>
        f.id === snap.id
          ? { ...f, myLeaf: !f.myLeaf, leafCount: f.leafCount + (f.myLeaf ? -1 : 1) }
          : f
      )
    );
    if (snap.myLeaf) {
      await supabase.from('leaves').delete().eq('snap_id', snap.id).eq('user_id', profile.id);
    } else {
      const { error } = await supabase.from('leaves').insert({ snap_id: snap.id, user_id: profile.id });
      if (error) {
        // Revert on failure (e.g., duplicate)
        setFeed(prev =>
          prev.map(f =>
            f.id === snap.id ? { ...f, myLeaf: snap.myLeaf, leafCount: snap.leafCount } : f
          )
        );
      }
    }
  };

  const sendInvite = async () => {
    if (!unspentCode) return;
    try {
      await Share.share({
        message: `You're invited to Eco Pulse 🌿 — my EcoKey is ${unspentCode}. It works once. tryecopulse.com`,
      });
    } catch {}
  };

  const maxBar = Math.max(...spark, 1);
  const periodLabel = period === 'week' ? 'this week' : period === 'month' ? 'this month' : 'this year';

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
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.lime} />
        }
      >
        {/* Period toggle */}
        <View style={s.segment}>
          {(['week', 'month', 'year'] as Period[]).map(p => (
            <TouchableOpacity
              key={p}
              style={[s.seg, period === p && s.segOn]}
              onPress={() => changePeriod(p)}
              activeOpacity={0.7}
            >
              <Text style={[s.segTxt, period === p && s.segTxtOn]}>{p}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* The number */}
        <View style={s.meter}>
          <Text style={s.meterN}>{givenLb.toFixed(0)}</Text>
          <Text style={s.meterU}>lb given back {periodLabel}</Text>
          {deltaPct !== null && (
            <Text style={[s.meterDelta, { color: deltaPct >= 0 ? Colors.teal : Colors.amber }]}>
              {deltaPct >= 0 ? '▲' : '▼'} {Math.abs(deltaPct)}% vs last {period}
            </Text>
          )}
          <View style={s.spark}>
            {spark.map((v, i) => (
              <View
                key={i}
                style={[
                  s.sparkBar,
                  {
                    height: 6 + (v / maxBar) * 26,
                    backgroundColor: i >= 5 ? Colors.lime : 'rgba(200,244,90,0.25)',
                  },
                ]}
              />
            ))}
          </View>
          <Text style={s.sparkLbl}>last 7 days</Text>
        </View>

        {/* Circle */}
        <View style={s.circleHead}>
          <View style={s.circleDot} />
          <Text style={s.circleTitle}>YOUR CIRCLE</Text>
        </View>

        {feed.length === 0 ? (
          <View style={s.emptyCircle}>
            <Text style={{ fontSize: 30 }}>🫧</Text>
            <Text style={s.emptyCircleTxt}>
              Your circle is quiet. Share a snap from the camera, or hand someone an EcoKey below.
            </Text>
          </View>
        ) : (
          feed.map(snap => {
            const isMe = snap.user_id === profile?.id;
            return (
              <View key={snap.id} style={s.snapCard}>
                <View style={s.snapHead}>
                  <View style={[s.face, { backgroundColor: colorFor(snap.user_id) }]}>
                    <Text style={s.faceTxt}>{initialsOf(snap.full_name)}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.snapWho}>{isMe ? 'You' : snap.full_name}</Text>
                    <Text style={s.snapWhen}>{timeAgo(snap.created_at)}</Text>
                  </View>
                </View>
                <View style={s.snapBody}>
                  {snap.photoUrl ? (
                    <Image source={{ uri: snap.photoUrl }} style={s.snapThumb} />
                  ) : (
                    <View style={[s.snapThumb, s.snapThumbEmpty]}>
                      <Text style={{ fontSize: 20 }}>🌿</Text>
                    </View>
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={s.snapWhat} numberOfLines={2}>{snap.label}</Text>
                    <Text style={s.snapNum}>{(snap.co2_kg * KG_TO_LB).toFixed(1)} lb CO₂e</Text>
                  </View>
                </View>
                <View style={s.snapFoot}>
                  <TouchableOpacity
                    style={[s.leaf, snap.myLeaf && s.leafLit]}
                    onPress={() => toggleLeaf(snap)}
                    activeOpacity={0.7}
                  >
                    <Text style={[s.leafTxt, snap.myLeaf && { color: Colors.lime }]}>
                      🌿 {snap.leafCount > 0 ? snap.leafCount : 'Send a leaf'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })
        )}

        {/* EcoKey invite */}
        <View style={s.keyCard}>
          <Text style={{ fontSize: 17 }}>🔑</Text>
          <View style={{ flex: 1 }}>
            <Text style={s.keyTxt}>
              {unspentCount > 0
                ? <>You hold <Text style={{ color: Colors.lime, fontFamily: Typography.headingBold }}>{unspentCount} EcoKey{unspentCount === 1 ? '' : 's'}</Text>. Every invite is intentional.</>
                : 'All your EcoKeys are spent — your circle is growing.'}
            </Text>
          </View>
          {unspentCount > 0 && (
            <TouchableOpacity style={s.keyBtn} onPress={sendInvite} activeOpacity={0.85}>
              <Text style={s.keyBtnTxt}>Invite</Text>
            </TouchableOpacity>
          )}
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

  segment: { flexDirection: 'row', backgroundColor: Colors.sf, borderWidth: 0.5, borderColor: Colors.border, borderRadius: 12, padding: 3, marginBottom: 12 },
  seg: { flex: 1, alignItems: 'center', paddingVertical: 7, borderRadius: 9 },
  segOn: { backgroundColor: 'rgba(200,244,90,0.1)' },
  segTxt: { fontFamily: Typography.headingBold, fontSize: 11, color: Colors.tx3, textTransform: 'uppercase', letterSpacing: 1 },
  segTxtOn: { color: Colors.lime },

  meter: { alignItems: 'center', paddingVertical: 8, marginBottom: 6 },
  meterN: { fontFamily: Typography.heading, fontSize: 48, color: Colors.lime, letterSpacing: -1.5, lineHeight: 52 },
  meterU: { fontFamily: Typography.body, fontSize: 12, color: Colors.tx2, marginTop: 4 },
  meterDelta: { fontFamily: Typography.headingBold, fontSize: 10, letterSpacing: 1, textTransform: 'uppercase', marginTop: 7 },
  spark: { flexDirection: 'row', alignItems: 'flex-end', gap: 4, height: 34, marginTop: 12 },
  sparkBar: { width: 11, borderRadius: 3 },
  sparkLbl: { fontFamily: Typography.body, fontSize: 9, color: Colors.tx3, marginTop: 6, textTransform: 'uppercase', letterSpacing: 1 },

  circleHead: { flexDirection: 'row', alignItems: 'center', gap: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(255,255,255,0.08)', paddingTop: 14, marginBottom: 10 },
  circleDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: Colors.teal },
  circleTitle: { fontFamily: Typography.headingBold, fontSize: 9.5, color: Colors.tx3, letterSpacing: 2 },

  emptyCircle: { alignItems: 'center', paddingVertical: 22, paddingHorizontal: 30, gap: 10 },
  emptyCircleTxt: { fontFamily: Typography.body, fontSize: 12.5, color: Colors.tx2, textAlign: 'center', lineHeight: 19 },

  snapCard: { backgroundColor: Colors.sf, borderWidth: 0.5, borderColor: Colors.border, borderRadius: 16, padding: 12, marginBottom: 8 },
  snapHead: { flexDirection: 'row', alignItems: 'center', gap: 9, marginBottom: 9 },
  face: { width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  faceTxt: { fontFamily: Typography.headingBold, fontSize: 9.5, color: '#071810' },
  snapWho: { fontFamily: Typography.headingBold, fontSize: 12.5, color: Colors.tx },
  snapWhen: { fontFamily: Typography.body, fontSize: 9.5, color: Colors.tx3, marginTop: 2 },
  snapBody: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  snapThumb: { width: 46, height: 46, borderRadius: 11 },
  snapThumbEmpty: { backgroundColor: Colors.sf2, justifyContent: 'center', alignItems: 'center' },
  snapWhat: { fontFamily: Typography.headingBold, fontSize: 12.5, color: Colors.tx },
  snapNum: { fontFamily: Typography.body, fontSize: 10.5, color: Colors.lime, marginTop: 3 },
  snapFoot: { flexDirection: 'row', marginTop: 10, paddingTop: 9, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(255,255,255,0.07)' },
  leaf: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 999, borderWidth: 0.5, borderColor: Colors.border },
  leafLit: { borderColor: Colors.border2, backgroundColor: 'rgba(200,244,90,0.07)' },
  leafTxt: { fontFamily: Typography.headingBold, fontSize: 11, color: Colors.tx2 },

  keyCard: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderStyle: 'dashed', borderColor: 'rgba(200,244,90,0.35)', borderRadius: 16, padding: 12, marginTop: 4 },
  keyTxt: { fontFamily: Typography.body, fontSize: 11.5, color: Colors.tx2, lineHeight: 17 },
  keyBtn: { backgroundColor: Colors.lime, borderRadius: 999, paddingHorizontal: 13, paddingVertical: 7 },
  keyBtnTxt: { fontFamily: Typography.headingBold, fontSize: 11, color: '#071810' },
});
