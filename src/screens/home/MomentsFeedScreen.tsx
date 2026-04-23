import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  StatusBar, ActivityIndicator, RefreshControl, Share
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Colors, Typography } from '../../constants/theme';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../lib/authStore';

// ── Types ──────────────────────────────────────────────────────────────────────
interface Moment {
  id: string;
  user_id: string;
  type: 'level_up' | 'streak' | 'green_act';
  title: string;
  subtitle: string;
  value: string;
  emoji: string;
  level?: number;
  likes: number;
  created_at: string;
  profile?: { full_name: string };
  liked?: boolean;
}

// ── Helpers ────────────────────────────────────────────────────────────────────
const TYPE_CONFIG = {
  level_up:  { label: 'Level up',     bg: 'rgba(200,244,90,0.06)',  border: 'rgba(200,244,90,0.2)',  accent: '#C8F45A' },
  streak:    { label: 'Streak',        bg: 'rgba(252,211,77,0.06)',  border: 'rgba(252,211,77,0.2)',  accent: '#FCD34D' },
  green_act: { label: 'Green act',     bg: 'rgba(45,212,191,0.06)',  border: 'rgba(45,212,191,0.2)',  accent: '#2DD4BF' },
};

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function getInitials(name: string) {
  return name?.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || '??';
}

// ── Moment card ────────────────────────────────────────────────────────────────
const MomentCard = ({ moment, onLike, currentUserId }: { moment: Moment; onLike: (id: string) => void; currentUserId: string }) => {
  const cfg = TYPE_CONFIG[moment.type];
  const isOwn = moment.user_id === currentUserId;
  const name = moment.profile?.full_name || 'Eco user';

  return (
    <View style={[mc.card, { backgroundColor: cfg.bg, borderColor: cfg.border }]}>
      {/* Header */}
      <View style={mc.header}>
        <View style={[mc.avatar, { borderColor: cfg.accent + '60' }]}>
          <Text style={[mc.avatarTxt, { color: cfg.accent }]}>{getInitials(name)}</Text>
        </View>
        <View style={mc.headerInfo}>
          <Text style={mc.userName}>{isOwn ? 'You' : name}</Text>
          <Text style={mc.time}>{timeAgo(moment.created_at)}</Text>
        </View>
        <View style={[mc.typeBadge, { borderColor: cfg.accent + '40', backgroundColor: cfg.accent + '12' }]}>
          <Text style={[mc.typeTxt, { color: cfg.accent }]}>{cfg.label}</Text>
        </View>
      </View>

      {/* Content */}
      <View style={mc.content}>
        <Text style={mc.emoji}>{moment.emoji}</Text>
        <View style={mc.contentText}>
          <Text style={mc.title}>{moment.title}</Text>
          {moment.subtitle ? <Text style={mc.subtitle}>{moment.subtitle}</Text> : null}
        </View>
        <View style={[mc.valueBadge, { borderColor: cfg.accent + '50' }]}>
          <Text style={[mc.valueTxt, { color: cfg.accent }]}>{moment.value}</Text>
        </View>
      </View>

      {/* Actions */}
      <View style={mc.actions}>
        <TouchableOpacity style={mc.likeBtn} onPress={() => onLike(moment.id)} activeOpacity={0.7}>
          <Text style={[mc.likeTxt, moment.liked && { color: cfg.accent }]}>
            {moment.liked ? '🌿' : '○'} {moment.likes > 0 ? moment.likes : ''}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity style={mc.shareActionBtn} onPress={async () => {
          await Share.share({ message: `${name} just ${moment.title.toLowerCase()} on Eco Pulse 🌿\n\necopulse.app` });
        }} activeOpacity={0.7}>
          <Text style={mc.shareActionTxt}>Share</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const mc = StyleSheet.create({
  card: { borderRadius: 18, borderWidth: 0.5, padding: 16, marginBottom: 10 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 },
  avatar: { width: 36, height: 36, borderRadius: 18, borderWidth: 1, backgroundColor: 'rgba(255,255,255,0.04)', justifyContent: 'center', alignItems: 'center' },
  avatarTxt: { fontFamily: Typography.headingBold, fontSize: 12 },
  headerInfo: { flex: 1, gap: 2 },
  userName: { fontFamily: Typography.headingBold, fontSize: 13, color: '#fff' },
  time: { fontFamily: Typography.body, fontSize: 10, color: 'rgba(255,255,255,0.3)' },
  typeBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, borderWidth: 0.5 },
  typeTxt: { fontFamily: Typography.headingBold, fontSize: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  content: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 },
  emoji: { fontSize: 28 },
  contentText: { flex: 1, gap: 3 },
  title: { fontFamily: Typography.heading, fontSize: 15, color: '#fff', letterSpacing: -0.3 },
  subtitle: { fontFamily: Typography.body, fontSize: 11, color: 'rgba(255,255,255,0.4)' },
  valueBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10, borderWidth: 0.5, backgroundColor: 'rgba(255,255,255,0.03)' },
  valueTxt: { fontFamily: Typography.heading, fontSize: 13, letterSpacing: -0.3 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 8, borderTopWidth: 0.5, borderTopColor: 'rgba(255,255,255,0.06)', paddingTop: 10 },
  likeBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.08)' },
  likeTxt: { fontFamily: Typography.headingBold, fontSize: 12, color: 'rgba(255,255,255,0.3)' },
  shareActionBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.08)' },
  shareActionTxt: { fontFamily: Typography.headingBold, fontSize: 11, color: 'rgba(255,255,255,0.3)' },
});

// ── Main screen ────────────────────────────────────────────────────────────────
export default function MomentsFeedScreen({ navigation }: any) {
  const { profile } = useAuthStore();
  const insets = useSafeAreaInsets();
  const [moments, setMoments] = useState<Moment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<'all' | 'level_up' | 'streak' | 'green_act'>('all');

  useFocusEffect(useCallback(() => { loadMoments(); }, [profile?.id]));

  const loadMoments = async (refresh = false) => {
    if (refresh) setRefreshing(true);
    else setLoading(true);

    // Load moments with profile info
    const { data } = await supabase
      .from('moments')
      .select('*, profiles(full_name)')
      .order('created_at', { ascending: false })
      .limit(50);

    // Load user's likes
    const { data: likes } = await supabase
      .from('moment_likes')
      .select('moment_id')
      .eq('user_id', profile?.id || '');

    const likedIds = new Set(likes?.map((l: any) => l.moment_id) || []);

    if (data) {
      setMoments(data.map((m: any) => ({
        ...m,
        profile: m.profiles,
        liked: likedIds.has(m.id),
      })));
    }

    if (refresh) setRefreshing(false);
    else setLoading(false);
  };

  const handleLike = async (momentId: string) => {
    if (!profile?.id) return;
    const moment = moments.find(m => m.id === momentId);
    if (!moment) return;

    if (moment.liked) {
      // Unlike
      await supabase.from('moment_likes').delete().eq('moment_id', momentId).eq('user_id', profile.id);
      setMoments(prev => prev.map(m => m.id === momentId ? { ...m, liked: false, likes: m.likes - 1 } : m));
      await supabase.from('moments').update({ likes: moment.likes - 1 }).eq('id', momentId);
    } else {
      // Like
      await supabase.from('moment_likes').insert({ moment_id: momentId, user_id: profile.id });
      setMoments(prev => prev.map(m => m.id === momentId ? { ...m, liked: true, likes: m.likes + 1 } : m));
      await supabase.from('moments').update({ likes: moment.likes + 1 }).eq('id', momentId);
    }
  };

  const filtered = filter === 'all' ? moments : moments.filter(m => m.type === filter);

  const FILTERS = [
    { id: 'all',       label: '🌿 All' },
    { id: 'level_up',  label: '⭐ Level ups' },
    { id: 'streak',    label: '🔥 Streaks' },
    { id: 'green_act', label: '🌍 Green acts' },
  ];

  return (
    <View style={s.root}>
      <View style={[s.phone, { paddingTop: insets.top || 12 }]}>
        <StatusBar barStyle="light-content" backgroundColor={Colors.bg} />

        {/* Header */}
        <View style={s.header}>
          <View>
            <Text style={s.title}>Moments</Text>
            <Text style={s.subtitle}>Green acts worth celebrating</Text>
          </View>
          <TouchableOpacity
            style={s.challengeBtn}
            onPress={() => navigation.navigate('CarbonChallenge')}
            activeOpacity={0.8}
          >
            <Text style={s.challengeBtnTxt}>⚡ Challenge</Text>
          </TouchableOpacity>
        </View>

        {/* Filter pills */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ flexShrink: 0, flexGrow: 0, maxHeight: 44 }}
          contentContainerStyle={{ paddingHorizontal: 14, paddingBottom: 10, gap: 6, flexDirection: 'row', alignItems: 'center' }}
        >
          {FILTERS.map(f => (
            <TouchableOpacity
              key={f.id}
              style={[s.pill, filter === f.id && s.pillOn]}
              onPress={() => setFilter(f.id as any)}
              activeOpacity={0.7}
            >
              <Text style={[s.pillTxt, filter === f.id && s.pillTxtOn]}>{f.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Feed */}
        {loading ? (
          <View style={s.loadWrap}>
            <ActivityIndicator color={Colors.lime} size="large" />
            <Text style={s.loadTxt}>Loading moments...</Text>
          </View>
        ) : (
          <ScrollView
            style={{ flex: 1 }}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 14, paddingBottom: 80 }}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={() => loadMoments(true)} tintColor={Colors.lime} />
            }
          >
            {filtered.length === 0 ? (
              <View style={s.emptyWrap}>
                <Text style={s.emptyIcon}>🌱</Text>
                <Text style={s.emptyTitle}>No moments yet</Text>
                <Text style={s.emptyDesc}>Log activities and reach milestones — your moments will appear here for the community to celebrate.</Text>
                <TouchableOpacity style={s.logBtn} onPress={() => navigation.navigate('LogActivity')} activeOpacity={0.8}>
                  <Text style={s.logBtnTxt}>Log an activity</Text>
                </TouchableOpacity>
              </View>
            ) : (
              filtered.map(moment => (
                <MomentCard
                  key={moment.id}
                  moment={moment}
                  onLike={handleLike}
                  currentUserId={profile?.id || ''}
                />
              ))
            )}
          </ScrollView>
        )}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000', alignItems: 'center' },
  phone: { width: 390, maxWidth: '100%', height: '100%', backgroundColor: Colors.bg, overflow: 'hidden' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12 },
  title: { fontFamily: Typography.heading, fontSize: 22, color: Colors.tx, letterSpacing: -0.5 },
  subtitle: { fontFamily: Typography.body, fontSize: 11, color: Colors.tx3, marginTop: 1 },
  challengeBtn: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: 'rgba(252,211,77,0.1)', borderWidth: 0.5, borderColor: 'rgba(252,211,77,0.3)' },
  challengeBtnTxt: { fontFamily: Typography.headingBold, fontSize: 12, color: '#FCD34D' },
  pill: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 0.5, borderColor: Colors.border, backgroundColor: Colors.bg2 },
  pillOn: { backgroundColor: 'rgba(200,244,90,0.1)', borderColor: 'rgba(200,244,90,0.3)' },
  pillTxt: { fontFamily: Typography.headingBold, fontSize: 11, color: Colors.tx3 },
  pillTxtOn: { color: Colors.lime },
  loadWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  loadTxt: { fontFamily: Typography.body, fontSize: 13, color: Colors.tx3 },
  emptyWrap: { alignItems: 'center', paddingTop: 60, paddingHorizontal: 20, gap: 12 },
  emptyIcon: { fontSize: 48 },
  emptyTitle: { fontFamily: Typography.heading, fontSize: 18, color: Colors.tx2 },
  emptyDesc: { fontFamily: Typography.body, fontSize: 13, color: Colors.tx3, textAlign: 'center', lineHeight: 20 },
  logBtn: { marginTop: 8, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 20, backgroundColor: 'rgba(200,244,90,0.1)', borderWidth: 0.5, borderColor: 'rgba(200,244,90,0.25)' },
  logBtnTxt: { fontFamily: Typography.headingBold, fontSize: 13, color: Colors.lime },
});
