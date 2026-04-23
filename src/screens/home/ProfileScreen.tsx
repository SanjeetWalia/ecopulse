import React, { useState, useCallback, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, StatusBar, ActivityIndicator, Animated, Share } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Colors, Typography } from '../../constants/theme';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../lib/authStore';
import GreenAvatar, { LEVEL_META, AvatarLevel } from '../../components/GreenAvatar';
import LevelUpCard from '../../components/LevelUpCard';
import {
  calcPastLevel, calcPresentLevel, calcFutureLevel,
  calcCleanAirStat, buildProfileTagline,
  PAST_LEVELS, PRESENT_LEVELS, FUTURE_LEVELS,
} from '../../lib/levelEngine';

const LEVEL_GRADIENTS: [string, string, string][] = [
  ['#0D3320', '#071810', '#050F0A'],
  ['#0A3A22', '#071810', '#040E09'],
  ['#083A24', '#061A10', '#03100A'],
  ['#063A28', '#041808', '#020E06'],
  ['#043A2A', '#031408', '#020A04'],
  ['#023A2A', '#021006', '#010804'],
];
const PRESENT_COLORS = [Colors.amber, Colors.lime, Colors.teal];

const co2ToCleanAir = (kg: number) => {
  if (kg <= 0) return { val: 'a few', unit: 'minutes of clean air' };
  const mins = Math.round(kg * 22);
  if (mins < 60) return { val: `${mins}`, unit: 'minutes of clean air' };
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return { val: `${hrs}`, unit: `hour${hrs > 1 ? 's' : ''} of clean air` };
  const days = Math.round(hrs / 24);
  if (days < 7) return { val: `${days}`, unit: `day${days > 1 ? 's' : ''} of clean air` };
  const wks = Math.round(days / 7);
  if (wks < 8) return { val: `${wks}`, unit: `week${wks > 1 ? 's' : ''} of clean air` };
  return { val: `${Math.round(wks / 4)}`, unit: 'months of clean air' };
};

export default function ProfileScreen({ navigation }: any) {
  const { profile, signOut } = useAuthStore();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ activities: 0, unique_days: 0, saved_vs_avg: 0, monthly_days: 0, streak: 0 });
  const [avatarLevel, setAvatarLevel] = useState<AvatarLevel>(1);
  const [presentIdx, setPresentIdx] = useState(0);
  const [futureIdx, setFutureIdx] = useState(0);
  const [showShare, setShowShare] = useState(false);
  const [showLevelUp, setShowLevelUp] = useState(false);
  const prevLevel = useRef<AvatarLevel>(1);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => { if (profile?.id) loadStats(); }, [profile?.id]);

  useFocusEffect(useCallback(() => {
    loadStats();
    Animated.loop(Animated.sequence([
      Animated.timing(pulseAnim, { toValue: 1.05, duration: 2500, useNativeDriver: true }),
      Animated.timing(pulseAnim, { toValue: 1.0,  duration: 2500, useNativeDriver: true }),
    ])).start();
  }, [profile?.id]));

  const loadStats = async () => {
    if (!profile?.id) { setLoading(false); return; }
    setLoading(true);

    const { data: acts } = await supabase
      .from('activities')
      .select('activity_type, co2_kg, logged_at')
      .eq('user_id', profile.id);

    if (acts) {
      const total_co2 = acts.reduce((s: number, a: any) => s + (a.co2_kg || 0), 0);
      const uniqueDaysSet = new Set(acts.map((a: any) => a.logged_at?.split('T')[0]));
      const unique_days = uniqueDaysSet.size;

      // Streak calc
      const sortedDates = [...uniqueDaysSet].filter(Boolean).sort().reverse();
      let streak = 0;
      for (let i = 0; i < sortedDates.length; i++) {
        const expected = new Date(Date.now() - i * 86400000).toISOString().split('T')[0];
        if (sortedDates[i] === expected) streak++;
        else break;
      }

      // Monthly days
      const thisMonth = new Date().toISOString().slice(0, 7);
      const monthly_days = new Set(
        acts.filter((a: any) => a.logged_at?.startsWith(thisMonth))
            .map((a: any) => a.logged_at?.split('T')[0])
      ).size;

      const saved_vs_avg = Math.max(0, (28.6 * unique_days) - total_co2);
      const actStats = {
        totalActivities: acts.length,
        uniqueDays: unique_days,
        currentStreak: streak,
        co2Saved: saved_vs_avg,
        co2Logged: total_co2,
        monthlyActivityDays: monthly_days,
      };

      const newPastLevel = calcPastLevel(actStats);
      const newPresentLevel = calcPresentLevel(actStats);
      const newFutureLevel = calcFutureLevel(actStats);
      const newAvatarLevel = newPastLevel as AvatarLevel;

      // Detect level up
      if (prevLevel.current >= 1 && newAvatarLevel > prevLevel.current) {
        setTimeout(() => setShowLevelUp(true), 600);
      }
      prevLevel.current = newAvatarLevel;

      setStats({ activities: acts.length, unique_days, saved_vs_avg, monthly_days, streak });
      setAvatarLevel(newAvatarLevel);
      setPresentIdx(newPresentLevel - 1);
      setFutureIdx(newFutureLevel - 1);
    }
    setLoading(false);
  };

  const handleShare = async () => {
    const firstName = profile?.full_name?.split(' ')[0] || 'I';
    const cleanAir = calcCleanAirStat(stats.saved_vs_avg);
    try {
      await Share.share({
        message: `${firstName}'s Green Profile on Eco Pulse 🌿\n\n${cleanAir} given back to Earth.\n\necopulse.app`,
      });
    } catch (e) {}
    setShowShare(false);
  };

  const cleanAir = co2ToCleanAir(stats.saved_vs_avg);
  const grad = LEVEL_GRADIENTS[avatarLevel - 1];
  const firstName = profile?.full_name?.split(' ')[0] || 'You';
  const meta = LEVEL_META[avatarLevel];

  if (loading) return (
    <View style={s.root}>
      <LinearGradient colors={['#0D3320','#071810','#050F0A']} style={[s.phone, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator color={Colors.lime} size="large" />
        <Text style={{ color: Colors.lime, fontFamily: Typography.body, fontSize: 12, marginTop: 12, opacity: 0.5 }}>Reading your story...</Text>
      </LinearGradient>
    </View>
  );

  return (
    <View style={s.root}>
      <LinearGradient colors={grad} style={[s.phone, { paddingTop: insets.top || 44 }]}>
        <StatusBar barStyle="light-content" />
        {/* Header */}
        <View style={s.topRow}>
          <Text style={s.wordmark}>eco<Text style={{ color: Colors.lime }}>pulse</Text></Text>
          <TouchableOpacity onPress={signOut}><Text style={s.signOutTxt}>Sign out</Text></TouchableOpacity>
        </View>

        {/* Avatar */}
        <View style={s.avatarSection}>
          <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
            <GreenAvatar level={avatarLevel} size={120} animate />
          </Animated.View>
          <View style={[s.levelPill, { borderColor: avatarLevel >= 4 ? Colors.teal + '60' : Colors.lime + '50' }]}>
            <Text style={[s.levelPillTxt, { color: avatarLevel >= 4 ? Colors.teal : Colors.lime }]}>
              {meta.emoji} {meta.name}
            </Text>
          </View>
        </View>

        <Text style={s.name}>{profile?.full_name}</Text>
        <Text style={s.handle}>@{profile?.full_name?.toLowerCase().replace(/\s+/g, '') || 'greenuser'}</Text>

        {/* The statement */}
        <View style={s.statementWrap}>
          <View style={s.statementRow}>
            <Text style={s.statementDim}>A story of  </Text>
            <Text style={[s.statementBold, { color: Colors.lime }]}>{PAST_LEVELS[avatarLevel].label}</Text>
          </View>
          <View style={s.statementRow}>
            <Text style={s.statementDim}>living as  </Text>
            <Text style={[s.statementBold, { color: PRESENT_COLORS[presentIdx] }]}>
              {PRESENT_LEVELS[(presentIdx + 1) as 1 | 2 | 3].label}
            </Text>
          </View>
          <View style={s.statementRow}>
            <Text style={s.statementDim}>toward  </Text>
            <Text style={[s.statementBold, { color: Colors.teal }]}>
              {FUTURE_LEVELS[(futureIdx + 1) as 1 | 2 | 3 | 4 | 5 | 6].label}
            </Text>
          </View>
        </View>

        {/* Clean air hero */}
        <View style={s.cleanAirSection}>
          <Text style={s.cleanAirEyebrow}>{firstName} has given Earth</Text>
          <Text style={s.cleanAirNumber}>{cleanAir.val}</Text>
          <Text style={s.cleanAirUnit}>{cleanAir.unit}</Text>
        </View>

        {/* Stats */}
        <View style={s.statsRow}>
          <View style={s.statItem}><Text style={s.statVal}>{stats.activities}</Text><Text style={s.statLbl}>logged</Text></View>
          <View style={s.statSep} />
          <View style={s.statItem}><Text style={s.statVal}>{stats.unique_days}</Text><Text style={s.statLbl}>days</Text></View>
          <View style={s.statSep} />
          <View style={s.statItem}><Text style={s.statVal}>{stats.streak}d</Text><Text style={s.statLbl}>streak</Text></View>
          <View style={s.statSep} />
          <View style={s.statItem}><Text style={s.statVal}>{Math.round(stats.saved_vs_avg)}kg</Text><Text style={s.statLbl}>saved</Text></View>
        </View>

        {/* Share */}
        {!showShare ? (
          <>
            <TouchableOpacity style={s.wrappedBtn} onPress={() => navigation.navigate('WeeklyWrapped')} activeOpacity={0.8}><Text style={s.wrappedBtnTxt}>📊 Weekly Wrapped</Text></TouchableOpacity>
        <TouchableOpacity style={s.shareBtn} onPress={() => setShowShare(true)} activeOpacity={0.8}>
            <Text style={s.shareBtnTxt}>Share your green profile ↗</Text>
          </TouchableOpacity>
          </>
        ) : (
          <View style={s.shareExpanded}>
            <Text style={s.shareLabel}>Share to</Text>
            <View style={s.shareIconRow}>
              {[{ icon: '𝕏', label: 'X' },{ icon: '📸', label: 'Instagram' },{ icon: '💬', label: 'WhatsApp' },{ icon: '🔗', label: 'Copy' }].map((sh, i) => (
                <TouchableOpacity key={i} style={s.shareIconBtn} onPress={handleShare}>
                  <Text style={s.shareIconEmoji}>{sh.icon}</Text>
                  <Text style={s.shareIconLbl}>{sh.label}</Text>
                </TouchableOpacity>
              ))}
              <TouchableOpacity style={s.shareIconBtn} onPress={() => setShowShare(false)}>
                <Text style={s.shareIconEmoji}>✕</Text>
                <Text style={s.shareIconLbl}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        <Text style={s.watermark}>ecopulse.app</Text>
        {/* Level up celebration */}
        {showLevelUp && (
          <LevelUpCard
            newLevel={avatarLevel}
            userName={firstName}
            cleanAirStat={calcCleanAirStat(stats.saved_vs_avg)}
            onClose={() => setShowLevelUp(false)}
          />
        )}
      </LinearGradient>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000', alignItems: 'center' },
  phone: { width: 390, maxWidth: '100%', flex: 1, alignItems: 'center', paddingHorizontal: 28 },
  topRow: { width: '100%', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  wordmark: { fontFamily: Typography.heading, fontSize: 14, color: 'rgba(255,255,255,0.25)', letterSpacing: 3, textTransform: 'uppercase' },
  signOutTxt: { fontFamily: Typography.headingBold, fontSize: 10, color: 'rgba(255,255,255,0.2)' },
  avatarSection: { alignItems: 'center', gap: 10, marginBottom: 14 },
  levelPill: { paddingHorizontal: 14, paddingVertical: 4, borderRadius: 20, borderWidth: 0.5, backgroundColor: 'rgba(200,244,90,0.06)' },
  levelPillTxt: { fontFamily: Typography.headingBold, fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase' },
  name: { fontFamily: Typography.heading, fontSize: 26, color: '#fff', letterSpacing: -1, marginBottom: 3 },
  handle: { fontFamily: Typography.headingBold, fontSize: 11, color: 'rgba(255,255,255,0.25)', letterSpacing: 0.5, marginBottom: 24 },
  statementWrap: { width: '100%', gap: 5, marginBottom: 24, paddingLeft: 4 },
  statementRow: { flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap' },
  statementDim: { fontFamily: Typography.body, fontSize: 16, color: 'rgba(255,255,255,0.22)', fontStyle: 'italic' },
  statementBold: { fontFamily: Typography.heading, fontSize: 20, letterSpacing: -0.5 },
  cleanAirSection: { alignItems: 'center', marginBottom: 20 },
  cleanAirEyebrow: { fontFamily: Typography.headingBold, fontSize: 10, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 2 },
  cleanAirNumber: { fontFamily: Typography.heading, fontSize: 60, color: Colors.teal, letterSpacing: -3, lineHeight: 64 },
  cleanAirUnit: { fontFamily: Typography.headingBold, fontSize: 11, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: 2 },
  statsRow: { flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 24 },
  statItem: { alignItems: 'center', gap: 2 },
  statVal: { fontFamily: Typography.heading, fontSize: 16, color: 'rgba(255,255,255,0.7)', letterSpacing: -0.5 },
  statLbl: { fontFamily: Typography.body, fontSize: 9, color: 'rgba(255,255,255,0.25)', textTransform: 'uppercase', letterSpacing: 0.8 },
  statSep: { width: 1, height: 24, backgroundColor: 'rgba(255,255,255,0.08)' },
  shareBtn: { width: '100%', paddingVertical: 14, borderRadius: 14, backgroundColor: 'rgba(200,244,90,0.08)', borderWidth: 0.5, borderColor: 'rgba(200,244,90,0.2)', alignItems: 'center' },
  shareBtnTxt: { fontFamily: Typography.headingBold, fontSize: 13, color: Colors.lime, letterSpacing: 0.3 },
  shareExpanded: { width: '100%', gap: 8 },
  shareLabel: { fontFamily: Typography.headingBold, fontSize: 9, color: 'rgba(255,255,255,0.2)', textTransform: 'uppercase', letterSpacing: 1, textAlign: 'center' },
  shareIconRow: { flexDirection: 'row', justifyContent: 'center', gap: 8 },
  shareIconBtn: { alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.08)', minWidth: 52 },
  shareIconEmoji: { fontSize: 18 },
  shareIconLbl: { fontFamily: Typography.headingBold, fontSize: 7, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: 0.4 },
  wrappedBtn: { width: '100%', paddingVertical: 12, borderRadius: 14, backgroundColor: 'rgba(45,212,191,0.08)', borderWidth: 0.5, borderColor: 'rgba(45,212,191,0.2)', alignItems: 'center', marginBottom: 10 },
  wrappedBtnTxt: { fontFamily: Typography.headingBold, fontSize: 13, color: Colors.teal, letterSpacing: 0.3 },
  watermark: { fontFamily: Typography.body, fontSize: 9, color: 'rgba(255,255,255,0.1)', marginTop: 'auto', paddingTop: 12, paddingBottom: 8 },
});
