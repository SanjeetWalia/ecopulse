import React, { useState, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, StatusBar, ActivityIndicator, Animated, Share, ScrollView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Colors, Typography } from '../../constants/theme';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../lib/authStore';
import { calcPastLevel, calcCleanAirStat, PAST_LEVELS } from '../../lib/levelEngine';
import { LEVEL_META } from '../../components/GreenAvatar';

function getWeekRange() {
  const now = new Date();
  const day = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - (day === 0 ? 6 : day - 1));
  monday.setHours(0, 0, 0, 0);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);
  return { start: monday, end: sunday };
}

function getLastWeekRange() {
  const { start } = getWeekRange();
  const lastMonday = new Date(start);
  lastMonday.setDate(start.getDate() - 7);
  const lastSunday = new Date(lastMonday);
  lastSunday.setDate(lastMonday.getDate() + 6);
  lastSunday.setHours(23, 59, 59, 999);
  return { start: lastMonday, end: lastSunday };
}

function formatDateRange(start: Date, end: Date) {
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
  return `${start.toLocaleDateString('en-US', opts)} - ${end.toLocaleDateString('en-US', opts)}`;
}

const BREAKDOWN_COLORS: Record<string, string> = {
  transport: '#FCD34D', food: '#C8F45A', energy: '#2DD4BF', digital: '#A78BFA', other: '#FB7185',
};
const BREAKDOWN_ICONS: Record<string, string> = {
  transport: '🚗', food: '🥗', energy: '⚡', digital: '📱', other: '♻️',
};

export default function WeeklyWrappedScreen({ navigation }: any) {
  const { profile } = useAuthStore();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [weekData, setWeekData] = useState<any>(null);
  const [showingLastWeek, setShowingLastWeek] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useFocusEffect(useCallback(() => {
    loadWeekData(false);
  }, [profile?.id]));

  const loadWeekData = async (lastWeek: boolean) => {
    if (!profile?.id) return;
    setLoading(true);
    setWeekData(null);
    setShowingLastWeek(lastWeek);
    fadeAnim.setValue(0);

    const range = lastWeek ? getLastWeekRange() : getWeekRange();

    const { data: acts } = await supabase
      .from('activities')
      .select('category, activity_type, co2_kg, logged_at')
      .eq('user_id', profile.id)
      .gte('logged_at', range.start.toISOString())
      .lte('logged_at', range.end.toISOString());

    const { data: allActs } = await supabase
      .from('activities')
      .select('co2_kg, logged_at')
      .eq('user_id', profile.id);

    const weekly_co2 = acts?.reduce((s: number, a: any) => s + (a.co2_kg || 0), 0) || 0;
    const weekly_saved = Math.max(0, (28.6 * 7) - weekly_co2);
    const weekly_count = acts?.length || 0;
    const unique_days = new Set(acts?.map((a: any) => a.logged_at?.split('T')[0])).size;

    const breakdown: Record<string, number> = {};
    acts?.forEach((a: any) => { breakdown[a.category] = (breakdown[a.category] || 0) + 1; });

    const typeCounts: Record<string, number> = {};
    acts?.forEach((a: any) => { typeCounts[a.activity_type] = (typeCounts[a.activity_type] || 0) + 1; });
    const topType = Object.entries(typeCounts).sort((a, b) => b[1] - a[1])[0];

    const allUnique = new Set(allActs?.map((a: any) => a.logged_at?.split('T')[0])).size;
    const allCo2 = allActs?.reduce((s: number, a: any) => s + (a.co2_kg || 0), 0) || 0;
    const allSaved = Math.max(0, (28.6 * allUnique) - allCo2);
    const actStats = { totalActivities: allActs?.length || 0, uniqueDays: allUnique, currentStreak: 0, co2Saved: allSaved, co2Logged: allCo2, monthlyActivityDays: 0 };
    const rawLevel = calcPastLevel(actStats);
    const level = (Math.min(6, Math.max(1, rawLevel))) as 1|2|3|4|5|6;
    const cleanAir = calcCleanAirStat(weekly_saved);

    setWeekData({ range, weekly_co2, weekly_saved, weekly_count, unique_days, breakdown, topType, level, cleanAir, dateLabel: formatDateRange(range.start, range.end) });
    setLoading(false);
    Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }).start();
  };

  const handleShare = async () => {
    if (!weekData) return;
    const firstName = profile?.full_name?.split(' ')[0] || 'I';
    try {
      await Share.share({ message: `${firstName}'s Weekly Wrapped 🌿\n\nWeek of ${weekData.dateLabel}\n\n${weekData.cleanAir} given back to Earth\n${weekData.weekly_count} activities logged\n\necopulse.app` });
    } catch (e) {}
  };

  if (loading) return (
    <View style={s.root}>
      <LinearGradient colors={['#0A2A18', '#071810', '#050F0A']} style={[s.phone, { justifyContent: 'center', alignItems: 'center', paddingTop: insets.top }]}>
        <ActivityIndicator color={Colors.lime} size="large" />
        <Text style={s.loadingTxt}>Wrapping your week...</Text>
      </LinearGradient>
    </View>
  );

  if (!weekData) return null;

  const safeLevel = (Math.min(6, Math.max(1, weekData.level || 1))) as 1|2|3|4|5|6;
  const meta = LEVEL_META[safeLevel];
  const pastInfo = PAST_LEVELS[safeLevel];

  return (
    <View style={s.root}>
      <LinearGradient colors={['#0A2A18', '#071810', '#050F0A']} style={[s.phone, { paddingTop: insets.top || 44 }]}>
        <StatusBar barStyle="light-content" />
        <View style={s.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
            <Text style={s.backTxt}>✕</Text>
          </TouchableOpacity>
          <View style={s.headerCenter}>
            <Text style={s.headerTitle}>Weekly Wrapped</Text>
            <Text style={s.headerSub}>{weekData.dateLabel}</Text>
          </View>
          <TouchableOpacity onPress={() => loadWeekData(!showingLastWeek)} style={s.weekToggle}>
            <Text style={s.weekToggleTxt}>{showingLastWeek ? 'This week' : 'Last week'}</Text>
          </TouchableOpacity>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}>
          <Animated.View style={{ opacity: fadeAnim }}>

            <View style={s.heroSection}>
              <Text style={s.heroEyebrow}>This week you gave Earth</Text>
              <Text style={s.heroStat}>{weekData.cleanAir}</Text>
              <View style={[s.levelBadge, { borderColor: safeLevel >= 4 ? Colors.teal + '60' : Colors.lime + '40' }]}>
                <Text style={[s.levelBadgeTxt, { color: safeLevel >= 4 ? Colors.teal : Colors.lime }]}>
                  {meta.emoji} {meta.name} · {pastInfo.label}
                </Text>
              </View>
            </View>

            <View style={s.statsRow}>
              <View style={s.statCard}>
                <Text style={s.statIcon}>📋</Text>
                <Text style={[s.statVal, { color: 'rgba(255,255,255,0.8)' }]}>{weekData.weekly_count}</Text>
                <Text style={s.statLbl}>Activities</Text>
              </View>
              <View style={s.statCard}>
                <Text style={s.statIcon}>📅</Text>
                <Text style={[s.statVal, { color: Colors.lime }]}>{weekData.unique_days}</Text>
                <Text style={s.statLbl}>Active days</Text>
              </View>
              <View style={s.statCard}>
                <Text style={s.statIcon}>🌿</Text>
                <Text style={[s.statVal, { color: Colors.teal }]}>{Math.round(weekData.weekly_saved)}kg</Text>
                <Text style={s.statLbl}>CO₂e saved</Text>
              </View>
            </View>

            {Object.keys(weekData.breakdown).length > 0 && (
              <View style={s.section}>
                <Text style={s.sectionTitle}>What you logged</Text>
                {Object.entries(weekData.breakdown).sort((a: any, b: any) => b[1] - a[1]).map(([cat, count]: any) => (
                  <View key={cat} style={s.barRow}>
                    <Text style={s.barIcon}>{BREAKDOWN_ICONS[cat] || '🌿'}</Text>
                    <View style={s.barTrack}>
                      <View style={[s.barFill, { width: `${(count / weekData.weekly_count) * 100}%` as any, backgroundColor: BREAKDOWN_COLORS[cat] || Colors.lime }]} />
                    </View>
                    <Text style={s.barCount}>{count}</Text>
                  </View>
                ))}
              </View>
            )}

            {weekData.topType && (
              <View style={s.topCard}>
                <Text style={s.topEyebrow}>Most logged this week</Text>
                <Text style={s.topName}>{weekData.topType[0].replace('meal', ' meal')} · {weekData.topType[1]}x</Text>
              </View>
            )}

            {weekData.weekly_count === 0 && (
              <View style={s.emptyState}>
                <Text style={s.emptyIcon}>🌱</Text>
                <Text style={s.emptyTitle}>{showingLastWeek ? 'No activities last week' : 'Week just started'}</Text>
                <Text style={s.emptyDesc}>Log activities and your wrapped will show here.</Text>
              </View>
            )}

            <TouchableOpacity style={s.shareBtn} onPress={handleShare} activeOpacity={0.85}>
              <Text style={s.shareBtnTxt}>Share your wrapped 🌿</Text>
            </TouchableOpacity>
            <Text style={s.watermark}>ecopulse.app · weekly wrapped</Text>
          </Animated.View>
        </ScrollView>
      </LinearGradient>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000', alignItems: 'center' },
  phone: { width: 390, maxWidth: '100%', flex: 1 },
  loadingTxt: { color: Colors.lime, fontFamily: Typography.body, fontSize: 12, marginTop: 12, opacity: 0.5 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingVertical: 12, marginBottom: 4 },
  backBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.06)', justifyContent: 'center', alignItems: 'center' },
  backTxt: { color: 'rgba(255,255,255,0.5)', fontSize: 14 },
  headerCenter: { alignItems: 'center', gap: 2 },
  headerTitle: { fontFamily: Typography.heading, fontSize: 16, color: '#fff', letterSpacing: -0.3 },
  headerSub: { fontFamily: Typography.body, fontSize: 10, color: 'rgba(255,255,255,0.3)' },
  weekToggle: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10, backgroundColor: 'rgba(200,244,90,0.08)', borderWidth: 0.5, borderColor: 'rgba(200,244,90,0.2)' },
  weekToggleTxt: { fontFamily: Typography.headingBold, fontSize: 9, color: Colors.lime },
  heroSection: { alignItems: 'center', paddingVertical: 28, gap: 8 },
  heroEyebrow: { fontFamily: Typography.headingBold, fontSize: 10, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: 1.5 },
  heroStat: { fontFamily: Typography.heading, fontSize: 28, color: Colors.teal, letterSpacing: -1, textAlign: 'center' },
  levelBadge: { paddingHorizontal: 14, paddingVertical: 5, borderRadius: 20, borderWidth: 0.5, backgroundColor: 'rgba(200,244,90,0.05)' },
  levelBadgeTxt: { fontFamily: Typography.headingBold, fontSize: 11, letterSpacing: 0.5 },
  statsRow: { flexDirection: 'row', gap: 8, marginBottom: 20 },
  statCard: { flex: 1, backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 16, borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.08)', padding: 14, alignItems: 'center', gap: 4 },
  statIcon: { fontSize: 22, marginBottom: 2 },
  statVal: { fontFamily: Typography.heading, fontSize: 20, letterSpacing: -0.5 },
  statLbl: { fontFamily: Typography.body, fontSize: 9, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: 0.8, textAlign: 'center' },
  section: { backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 16, borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.07)', padding: 16, marginBottom: 12 },
  sectionTitle: { fontFamily: Typography.headingBold, fontSize: 9, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 14 },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  barIcon: { fontSize: 14, width: 24 },
  barTrack: { flex: 1, height: 6, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 3, overflow: 'hidden' },
  barFill: { height: 6, borderRadius: 3 },
  barCount: { fontSize: 11, color: 'rgba(255,255,255,0.4)', width: 20, textAlign: 'right' },
  topCard: { backgroundColor: 'rgba(200,244,90,0.05)', borderRadius: 16, borderWidth: 0.5, borderColor: 'rgba(200,244,90,0.15)', padding: 16, marginBottom: 12, alignItems: 'center' },
  topEyebrow: { fontFamily: Typography.headingBold, fontSize: 9, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 },
  topName: { fontFamily: Typography.heading, fontSize: 20, color: Colors.lime, letterSpacing: -0.5, textTransform: 'capitalize' },
  emptyState: { alignItems: 'center', paddingVertical: 32, gap: 10 },
  emptyIcon: { fontSize: 40 },
  emptyTitle: { fontFamily: Typography.heading, fontSize: 16, color: 'rgba(255,255,255,0.5)' },
  emptyDesc: { fontFamily: Typography.body, fontSize: 12, color: 'rgba(255,255,255,0.25)', textAlign: 'center', lineHeight: 18 },
  shareBtn: { width: '100%', paddingVertical: 15, borderRadius: 16, backgroundColor: Colors.lime, alignItems: 'center', marginTop: 8, marginBottom: 16 },
  shareBtnTxt: { fontFamily: Typography.headingBold, fontSize: 14, color: '#071810' },
  watermark: { fontFamily: Typography.body, fontSize: 9, color: 'rgba(255,255,255,0.1)', textAlign: 'center', paddingBottom: 8 },
});
