import React, { useState, useRef, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, StatusBar, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useAuthStore } from '../../lib/authStore';
import { supabase } from '../../lib/supabase';
import { Colors, Typography, Spacing, Radius } from '../../constants/theme';

const STORIES = [
  { id: '1', name: 'Alex',  initials: 'AC', color: '#5BC8A8', seen: false },
  { id: '2', name: 'Maya',  initials: 'MR', color: '#7DD3FC', seen: false },
  { id: '3', name: 'Tom',   initials: 'TK', color: '#FCD34D', seen: true  },
  { id: '4', name: 'Sara',  initials: 'SW', color: '#FB923C', seen: true  },
  { id: '5', name: 'Dan',   initials: 'DL', color: '#FB7185', seen: true  },
];

const PERIOD_DATA: any = {
  day:   { score: '0.0',   unit: 'kg CO₂e · today',        label: 'Green steps · Today',      rank: '#3', rankSub: 'friends',   ringPct: 0.85, badges: [{ text: '✦ 19% below avg', s: 'green' }, { text: '🚌 Transit day', s: 'teal' }, { text: '🔥 12-day streak', s: 'amber' }], tiles: [{ icon: '🗺️', name: 'Transport', val: '0 kg' }, { icon: '🍽️', name: 'Food', val: '0 kg' }, { icon: '🌡️', name: 'Energy', val: '0 kg' }, { icon: '📱', name: 'Digital', val: '0 kg' }] },
  month: { score: '284',   unit: 'kg CO₂e · March 2026',    label: 'Green steps · This month', rank: '#3', rankSub: 'friends',   ringPct: 0.72, badges: [{ text: '✦ Best month', s: 'green' }, { text: '🌱 38.4 kg saved', s: 'teal' }, { text: '🔥 29 active days', s: 'amber' }], tiles: [{ icon: '🗺️', name: 'Transport', val: '62 kg' }, { icon: '🍽️', name: 'Food', val: '74 kg' }, { icon: '🌡️', name: 'Energy', val: '103 kg' }, { icon: '📱', name: 'Digital', val: '45 kg' }] },
  year:  { score: '1,842', unit: 'kg CO₂e · 2026 so far',   label: 'Green steps · This year',  rank: '#7', rankSub: 'Frisco',    ringPct: 0.6,  badges: [{ text: '✦ 14% below 2025', s: 'green' }, { text: '🏆 6 months', s: 'teal' }, { text: '💚 184 trees', s: 'amber' }], tiles: [{ icon: '🗺️', name: 'Transport', val: '420 kg' }, { icon: '🍽️', name: 'Food', val: '510 kg' }, { icon: '🌡️', name: 'Energy', val: '612 kg' }, { icon: '📱', name: 'Digital', val: '300 kg' }] },
};

const STORY_DATA: any = {
  '1': { icon: '🚴', title: 'Cycled to work today!',   stat: '14 miles · 0 kg CO₂e\nSaved 2.4 kg CO₂e vs driving', badge: '🌿 Zero emission commute' },
  '2': { icon: '🥗', title: 'Plant-based lunch swap!', stat: 'Oat milk + veg bowl\nSaved 0.8 kg vs usual',    badge: '🌿 Food swap win' },
  '3': { icon: '🌳', title: 'Planted 2 trees!',        stat: 'Offset: ~48 kg CO₂e/yr',                         badge: '🌿 Community action' },
  '4': { icon: '☀️', title: 'Solar install — day 30!', stat: 'Generated 4.2 kWh\nOffset 1.8 kg CO₂e',          badge: '⚡ Renewable energy' },
  '5': { icon: '♻️', title: '3 bags recycled!',        stat: 'Diverted 4.2 kg from landfill',                  badge: '♻️ Waste reduction' },
};

function RingChart({ pct, rank, sub }: any) {
  return (
    <View style={{ width: 72, height: 72, alignItems: 'center', justifyContent: 'center' }}>
      <View style={{ position: 'absolute', width: 72, height: 72, borderRadius: 36, borderWidth: 5, borderColor: 'rgba(200,244,90,0.08)' }} />
      <View style={{ position: 'absolute', width: 72, height: 72, borderRadius: 36, borderWidth: 5, borderColor: Colors.lime, borderTopColor: pct < 0.25 ? 'transparent' : Colors.lime, borderRightColor: pct < 0.5 ? 'transparent' : Colors.lime, borderBottomColor: pct < 0.75 ? 'transparent' : Colors.lime, transform: [{ rotate: '-90deg' }] }} />
      <View style={{ alignItems: 'center' }}>
        <Text style={{ fontFamily: Typography.headingBold, fontSize: 13, color: Colors.lime }}>{rank}</Text>
        <Text style={{ fontFamily: Typography.body, fontSize: 8, color: Colors.tx3 }}>{sub}</Text>
      </View>
    </View>
  );
}

export default function HomeScreen({ navigation }: any) {
  const { profile, signOut } = useAuthStore();
  const insets = useSafeAreaInsets();
  const [period, setPeriod] = useState('day');
  const [activeStory, setActiveStory] = useState<string | null>(null);
  const [realScore, setRealScore] = useState<string | null>(null);
  const [realTiles, setRealTiles] = useState<any[] | null>(null);
  const liveAnim = useRef(new Animated.Value(1)).current;

  const data = PERIOD_DATA[period];
  const initials = profile?.full_name?.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase() ?? 'JP';
  const displayScore = period === 'day' && realScore !== null ? realScore : data.score;
  const displayTiles = period === 'day' && realTiles ? realTiles : data.tiles;

  // Fetch today's real score from Supabase
  const fetchTodayScore = useCallback(async () => {
    if (!profile?.id) return;
    const today = new Date().toISOString().split('T')[0];
    const { data: summary } = await supabase
      .from('daily_summaries')
      .select('*')
      .eq('user_id', profile.id)
      .eq('date', today)
      .single();

    if (summary) {
      setRealScore((summary.total_co2_kg ?? 0).toFixed(1));
      setRealTiles([
        { icon: '🗺️', name: 'Transport', val: `${(summary.transport_co2 ?? 0).toFixed(1)} kg` },
        { icon: '🍽️', name: 'Food',      val: `${(summary.food_co2 ?? 0).toFixed(1)} kg` },
        { icon: '🌡️', name: 'Energy',    val: `${(summary.energy_co2 ?? 0).toFixed(1)} kg` },
        { icon: '📱', name: 'Digital',   val: `${(summary.digital_co2 ?? 0).toFixed(1)} kg` },
      ]);
    } else {
      setRealScore('0.0');
      setRealTiles([
        { icon: '🗺️', name: 'Transport', val: '0.0 kg' },
        { icon: '🍽️', name: 'Food',      val: '0.0 kg' },
        { icon: '🌡️', name: 'Energy',    val: '0.0 kg' },
        { icon: '📱', name: 'Digital',   val: '0.0 kg' },
      ]);
    }
  }, [profile?.id]);

  // Refresh score every time home screen is focused
  useFocusEffect(useCallback(() => { fetchTodayScore(); }, [fetchTodayScore]));

  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.timing(liveAnim, { toValue: 0.3, duration: 1000, useNativeDriver: false }),
      Animated.timing(liveAnim, { toValue: 1,   duration: 1000, useNativeDriver: false }),
    ])).start();
  }, []);

  const bc = (s: string) => {
    if (s === 'green') return { bg: 'rgba(200,244,90,0.1)', border: 'rgba(200,244,90,0.2)', text: Colors.lime };
    if (s === 'teal')  return { bg: 'rgba(45,212,191,0.1)',  border: 'rgba(45,212,191,0.2)',  text: Colors.teal };
    return                   { bg: 'rgba(252,211,77,0.1)',  border: 'rgba(252,211,77,0.2)',  text: Colors.amber };
  };

  return (
    <View style={s.root}>
      <View style={[s.phone, { paddingTop: insets.top || 12 }]}>
        <StatusBar barStyle="light-content" backgroundColor={Colors.bg} />

        {/* TOP BAR */}
        <View style={s.topBar}>
          <Text style={s.wordmark}>eco<Text style={s.accent}>pulse</Text></Text>
          <View style={s.topIcons}>
            <TouchableOpacity style={s.iconBtn} onPress={() => navigation.navigate('Messages')}>
              <Text style={{ fontSize: 14 }}>💬</Text>
              <View style={s.notifDot} />
            </TouchableOpacity>
            <TouchableOpacity style={[s.iconBtn, { backgroundColor: Colors.sf2 }]} onPress={() => signOut()}>
              <Text style={{ fontFamily: Typography.headingBold, fontSize: 10, color: Colors.lime }}>{initials}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* STORIES */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.storiesScroll} contentContainerStyle={{ paddingHorizontal: 10, paddingVertical: 4 }}>
          <TouchableOpacity style={s.storyWrap}>
            <View style={[s.storyRing, { borderWidth: 1.5, borderColor: 'rgba(200,244,90,0.35)', borderStyle: 'dashed', backgroundColor: 'transparent' }]}>
              <View style={s.storyInner}>
                <View style={[s.storyAv, { backgroundColor: Colors.sf2 }]}>
                  <Text style={[s.storyInit, { color: Colors.lime }]}>{initials}</Text>
                </View>
              </View>
              <View style={s.addBtn}><Text style={{ fontSize: 8, color: '#071810', fontWeight: '900' }}>+</Text></View>
            </View>
            <Text style={[s.storyName, { color: Colors.tx3 }]}>Your story</Text>
          </TouchableOpacity>
          {STORIES.map(st => (
            <TouchableOpacity key={st.id} style={s.storyWrap} onPress={() => setActiveStory(st.id)}>
              <LinearGradient colors={st.seen ? [Colors.sf2, Colors.sf2] : ['#C8F45A', '#2DD4BF']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.storyRing}>
                <View style={s.storyInner}>
                  <View style={[s.storyAv, { backgroundColor: st.color }]}>
                    <Text style={s.storyInit}>{st.initials}</Text>
                  </View>
                </View>
              </LinearGradient>
              <Text style={s.storyName}>{st.name}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <View style={{ height: 0.5, backgroundColor: 'rgba(255,255,255,0.04)' }} />

        {/* GREEN STEPS HERO */}
        <TouchableOpacity style={s.heroCard} onPress={() => period === 'day' && navigation.navigate('ActivityDetail')} activeOpacity={period === 'day' ? 0.85 : 1}>
          <View style={s.heroGlow} />
          <View style={{ padding: 10 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 6 }}>
              <Animated.View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: Colors.lime, opacity: liveAnim }} />
              <Text style={{ fontFamily: Typography.headingMedium, fontSize: 8, color: Colors.tx3, textTransform: 'uppercase', letterSpacing: 1 }}>{data.label}</Text>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 6 }}>
              <View>
                <Text style={{ fontFamily: Typography.heading, fontSize: 44, color: Colors.lime, letterSpacing: -3, lineHeight: 44 }}>{displayScore}</Text>
                <Text style={{ fontFamily: Typography.body, fontSize: 10, color: Colors.tx2, marginTop: 2 }}>{data.unit}</Text>
              </View>
              <View style={{ alignItems: 'center', gap: 2 }}>
                <RingChart pct={data.ringPct} rank={data.rank} sub={data.rankSub} />
                <Text style={{ fontFamily: Typography.headingMedium, fontSize: 7, color: Colors.tx3 }}>friend rank</Text>
              </View>
            </View>
          </View>
          <View style={{ flexDirection: 'row', gap: 4, paddingHorizontal: 10, marginBottom: 6, overflow: 'hidden' }}>
            {data.badges.map((b: any, i: number) => { const c = bc(b.s); return <View key={i} style={{ paddingHorizontal: 6, paddingVertical: 3, borderRadius: 12, borderWidth: 0.5, backgroundColor: c.bg, borderColor: c.border }}><Text style={{ fontFamily: Typography.headingBold, fontSize: 8, color: c.text }}>{b.text}</Text></View>; })}
          </View>
          <View style={{ flexDirection: 'row', borderTopWidth: 0.5, borderTopColor: 'rgba(200,244,90,0.08)' }}>
            {(['day', 'month', 'year'] as const).map(p => (
              <TouchableOpacity key={p} style={[{ flex: 1, paddingVertical: 6, alignItems: 'center' }, period === p && { backgroundColor: 'rgba(200,244,90,0.05)' }]} onPress={(e: any) => { e.stopPropagation?.(); setPeriod(p); }}>
                <Text style={{ fontFamily: Typography.headingBold, fontSize: 9, color: period === p ? Colors.lime : Colors.tx3 }}>{p.charAt(0).toUpperCase() + p.slice(1)}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={{ flexDirection: 'row', borderTopWidth: 0.5, borderTopColor: 'rgba(200,244,90,0.08)' }}>
            {displayTiles.map((t: any, i: number) => (
              <View key={i} style={[{ flex: 1, paddingVertical: 7, alignItems: 'center' }, i < 3 && { borderRightWidth: 0.5, borderRightColor: 'rgba(200,244,90,0.06)' }]}>
                <Text style={{ fontSize: 12, marginBottom: 1 }}>{t.icon}</Text>
                <Text style={{ fontFamily: Typography.headingMedium, fontSize: 7, color: Colors.tx3, marginBottom: 1 }}>{t.name}</Text>
                <Text style={{ fontFamily: Typography.headingBold, fontSize: 9, color: Colors.tx }}>{t.val}</Text>
              </View>
            ))}
          </View>
          {period === 'day' && <View style={{ flexDirection: 'row', justifyContent: 'center', paddingVertical: 5, borderTopWidth: 0.5, borderTopColor: 'rgba(200,244,90,0.06)' }}><Text style={{ fontFamily: Typography.headingMedium, fontSize: 8, color: Colors.tx3 }}>📋 Tap to see today's activities</Text></View>}
        </TouchableOpacity>

        {/* GIFT A PLANT */}
        <TouchableOpacity style={s.giftCard} onPress={() => navigation.navigate('GiftPlant')} activeOpacity={0.85}>
          <View style={{ position: 'absolute', top: -30, right: -30, width: 100, height: 100, borderRadius: 50, backgroundColor: 'rgba(200,244,90,0.07)' }} />
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9, padding: 10 }}>
            <View style={{ width: 38, height: 38, borderRadius: 11, backgroundColor: 'rgba(200,244,90,0.12)', borderWidth: 0.5, borderColor: 'rgba(200,244,90,0.2)', justifyContent: 'center', alignItems: 'center' }}><Text style={{ fontSize: 18 }}>🌱</Text></View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: Typography.headingBold, fontSize: 8, color: 'rgba(200,244,90,0.6)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 1 }}>⭐ Gift a Plant</Text>
              <Text style={{ fontFamily: Typography.heading, fontSize: 12, color: Colors.tx, marginBottom: 1 }}>Send a living thank-you</Text>
              <Text style={{ fontFamily: Typography.body, fontSize: 8, color: Colors.tx2, marginBottom: 4 }}>Unlock at 50 kg CO₂e saved or Top 3</Text>
              <View style={{ height: 3, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 2, overflow: 'hidden', marginBottom: 2 }}><View style={{ height: '100%', width: '77%', backgroundColor: Colors.lime, borderRadius: 2 }} /></View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ fontFamily: Typography.headingMedium, fontSize: 7, color: Colors.tx3 }}>CO₂e this month</Text>
                <Text style={{ fontFamily: Typography.headingBold, fontSize: 7, color: Colors.lime }}>38.4 / 50 kg</Text>
              </View>
            </View>
            <View style={{ alignItems: 'flex-end', gap: 5 }}>
              <View style={{ paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, backgroundColor: 'rgba(200,244,90,0.12)', borderWidth: 0.5, borderColor: 'rgba(200,244,90,0.25)' }}><Text style={{ fontFamily: Typography.headingBold, fontSize: 8, color: Colors.lime }}>✓ Top 3!</Text></View>
              <View style={{ width: 22, height: 22, borderRadius: 6, backgroundColor: 'rgba(200,244,90,0.1)', justifyContent: 'center', alignItems: 'center' }}><Text style={{ color: Colors.lime, fontSize: 14 }}>›</Text></View>
            </View>
          </View>
        </TouchableOpacity>

        {/* LOG ACTIVITY */}
        <TouchableOpacity style={s.logWidget} onPress={() => navigation.navigate('LogActivity')} activeOpacity={0.85}>
          <View style={{ width: 38, height: 38, borderRadius: 11, backgroundColor: 'rgba(200,244,90,0.08)', borderWidth: 0.5, borderColor: 'rgba(200,244,90,0.15)', justifyContent: 'center', alignItems: 'center' }}><Text style={{ fontSize: 18 }}>✏️</Text></View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: Typography.heading, fontSize: 13, color: Colors.tx, marginBottom: 1 }}>Log an activity</Text>
            <Text style={{ fontFamily: Typography.body, fontSize: 9, color: Colors.tx3 }}>Add transport, food, energy & more</Text>
          </View>
          <View style={{ width: 26, height: 26, borderRadius: 7, backgroundColor: 'rgba(200,244,90,0.1)', borderWidth: 0.5, borderColor: 'rgba(200,244,90,0.2)', justifyContent: 'center', alignItems: 'center' }}><Text style={{ color: Colors.lime, fontSize: 16 }}>›</Text></View>
        </TouchableOpacity>

        {/* STORY VIEWER */}
        {activeStory && (
          <TouchableOpacity style={s.storyOverlay} activeOpacity={1} onPress={() => setActiveStory(null)}>
            <LinearGradient colors={['rgba(7,16,13,0.97)', 'rgba(7,16,13,0.85)', 'rgba(7,16,13,0.97)']} style={StyleSheet.absoluteFillObject} />
            {(() => {
              const st = STORIES.find(x => x.id === activeStory)!;
              const sd = STORY_DATA[activeStory];
              return (
                <View style={{ width: '100%', paddingHorizontal: 16, gap: 14 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: st.color, justifyContent: 'center', alignItems: 'center', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.5)' }}><Text style={{ fontFamily: Typography.headingBold, fontSize: 11, color: '#071810' }}>{st.initials}</Text></View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontFamily: Typography.headingBold, fontSize: 13, color: '#fff' }}>{st.name}</Text>
                      <Text style={{ fontFamily: Typography.body, fontSize: 10, color: 'rgba(255,255,255,0.6)' }}>just now</Text>
                    </View>
                    <TouchableOpacity onPress={() => setActiveStory(null)}><Text style={{ color: '#fff', fontSize: 18 }}>✕</Text></TouchableOpacity>
                  </View>
                  <View style={{ backgroundColor: 'rgba(7,16,13,0.9)', borderWidth: 0.5, borderColor: 'rgba(200,244,90,0.35)', borderRadius: 16, padding: 14, gap: 5 }}>
                    <Text style={{ fontSize: 28 }}>{sd.icon}</Text>
                    <Text style={{ fontFamily: Typography.heading, fontSize: 15, color: Colors.lime }}>{sd.title}</Text>
                    <Text style={{ fontFamily: Typography.body, fontSize: 12, color: Colors.tx2, lineHeight: 18 }}>{sd.stat}</Text>
                    <View style={{ alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, backgroundColor: 'rgba(200,244,90,0.15)', borderWidth: 0.5, borderColor: 'rgba(200,244,90,0.3)', marginTop: 3 }}><Text style={{ fontFamily: Typography.headingBold, fontSize: 10, color: Colors.lime }}>{sd.badge}</Text></View>
                  </View>
                  <Text style={{ fontFamily: Typography.body, fontSize: 11, color: 'rgba(255,255,255,0.4)', textAlign: 'center' }}>Tap anywhere to close</Text>
                </View>
              );
            })()}
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg, alignItems: 'center' },
  phone: { width: 390, maxWidth: '100%', flex: 1, backgroundColor: Colors.bg, overflow: 'hidden' },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 8 },
  wordmark: { fontFamily: Typography.heading, fontSize: 18, color: Colors.tx, letterSpacing: -0.5 },
  accent: { color: Colors.lime },
  topIcons: { flexDirection: 'row', gap: 8 },
  iconBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: Colors.sf, borderWidth: 0.5, borderColor: Colors.border2, justifyContent: 'center', alignItems: 'center', position: 'relative' },
  notifDot: { position: 'absolute', top: 4, right: 4, width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.coral, borderWidth: 1, borderColor: Colors.bg },
  storiesScroll: { height: 76, flexShrink: 0, flexGrow: 0 },
  storyWrap: { alignItems: 'center', gap: 3, paddingHorizontal: 6 },
  storyRing: { width: 50, height: 50, borderRadius: 25, padding: 2, justifyContent: 'center', alignItems: 'center', position: 'relative' },
  storyInner: { width: '100%', height: '100%', borderRadius: 23, backgroundColor: Colors.bg, padding: 2, justifyContent: 'center', alignItems: 'center' },
  storyAv: { width: '100%', height: '100%', borderRadius: 21, justifyContent: 'center', alignItems: 'center' },
  storyInit: { fontFamily: Typography.headingBold, fontSize: 12, color: '#071810' },
  addBtn: { position: 'absolute', bottom: -1, right: -1, width: 15, height: 15, borderRadius: 8, backgroundColor: Colors.lime, borderWidth: 1.5, borderColor: Colors.bg, justifyContent: 'center', alignItems: 'center' },
  storyName: { fontFamily: Typography.headingMedium, fontSize: 8, color: Colors.tx2, textAlign: 'center' },
  heroCard: { marginHorizontal: 10, marginTop: 5, backgroundColor: Colors.bg3, borderWidth: 0.5, borderColor: Colors.border2, borderRadius: 20, overflow: 'hidden', position: 'relative' },
  heroGlow: { position: 'absolute', top: -40, right: -40, width: 140, height: 140, borderRadius: 70, backgroundColor: 'rgba(200,244,90,0.07)' },
  giftCard: { marginHorizontal: 10, marginTop: 7, borderRadius: 18, overflow: 'hidden', borderWidth: 0.5, borderColor: 'rgba(200,244,90,0.35)', backgroundColor: '#0D2A10', position: 'relative' },
  logWidget: { marginHorizontal: 10, marginTop: 7, borderRadius: 16, backgroundColor: Colors.bg2, borderWidth: 0.5, borderColor: Colors.border, padding: 11, flexDirection: 'row', alignItems: 'center', gap: 10 },
  storyOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 50, justifyContent: 'center', alignItems: 'center' },
});
