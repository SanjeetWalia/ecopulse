import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  StatusBar, ActivityIndicator, Share, TextInput
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Colors, Typography } from '../../constants/theme';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../lib/authStore';

// ── Types ──────────────────────────────────────────────────────────────────────
interface Challenge {
  id: string;
  challenger_id: string;
  challenger_name: string;
  challenged_name: string;
  challenge_type: string;
  challenger_score: number;
  challenged_score: number;
  target_value: number;
  status: string;
  invite_code: string;
  message: string;
  ends_at: string;
  created_at: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function generateCode(name: string) {
  const base = name.replace(/\s+/g, '').toUpperCase().slice(0, 6);
  const rand = Math.floor(Math.random() * 900 + 100);
  return `${base}${rand}`;
}

function daysLeft(endDate: string) {
  const diff = new Date(endDate).getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / 86400000));
}

const CHALLENGE_TYPES = [
  { id: 'weekly_co2', label: 'Most CO₂e saved', icon: '🌿', desc: 'Who saves more in 30 days?' },
  { id: 'streak',     label: 'Longest streak',  icon: '🔥', desc: 'Who logs more consecutive days?' },
  { id: 'activities', label: 'Most activities',  icon: '📋', desc: 'Who logs the most activities?' },
];

// ── Challenge card ─────────────────────────────────────────────────────────────
const ChallengeCard = ({ challenge, isChallenger, onShare }: { challenge: Challenge; isChallenger: boolean; onShare: () => void }) => {
  const myScore = isChallenger ? challenge.challenger_score : challenge.challenged_score;
  const theirScore = isChallenger ? challenge.challenged_score : challenge.challenger_score;
  const theirName = isChallenger ? (challenge.challenged_name || 'Waiting...') : challenge.challenger_name;
  const winning = myScore >= theirScore;
  const days = daysLeft(challenge.ends_at);
  const pct = challenge.target_value > 0 ? Math.min(100, (myScore / challenge.target_value) * 100) : 0;

  return (
    <View style={cc.card}>
      {/* Status bar */}
      <View style={cc.statusRow}>
        <View style={[cc.statusBadge, { backgroundColor: challenge.status === 'active' ? 'rgba(200,244,90,0.1)' : 'rgba(252,211,77,0.1)', borderColor: challenge.status === 'active' ? 'rgba(200,244,90,0.3)' : 'rgba(252,211,77,0.3)' }]}>
          <Text style={[cc.statusTxt, { color: challenge.status === 'active' ? Colors.lime : '#FCD34D' }]}>
            {challenge.status === 'active' ? `⚡ Active · ${days}d left` : '⏳ Pending'}
          </Text>
        </View>
        <Text style={cc.typeLabel}>{CHALLENGE_TYPES.find(t => t.id === challenge.challenge_type)?.icon} {CHALLENGE_TYPES.find(t => t.id === challenge.challenge_type)?.label}</Text>
      </View>

      {/* VS row */}
      <View style={cc.vsRow}>
        <View style={cc.vsPlayer}>
          <Text style={cc.vsName}>You</Text>
          <Text style={[cc.vsScore, { color: winning ? Colors.lime : Colors.tx2 }]}>{myScore.toFixed(1)}</Text>
          {winning && <Text style={cc.winTag}>👑 Winning</Text>}
        </View>
        <Text style={cc.vs}>VS</Text>
        <View style={[cc.vsPlayer, { alignItems: 'flex-end' }]}>
          <Text style={cc.vsName}>{theirName}</Text>
          <Text style={[cc.vsScore, { color: !winning ? Colors.lime : Colors.tx2 }]}>{theirScore.toFixed(1)}</Text>
          {!winning && theirScore > 0 && <Text style={cc.winTag}>👑 Winning</Text>}
        </View>
      </View>

      {/* Progress bar */}
      {challenge.target_value > 0 && (
        <View style={cc.progressWrap}>
          <View style={cc.progressTrack}>
            <View style={[cc.progressFill, { width: `${pct}%` as any }]} />
          </View>
          <Text style={cc.progressTxt}>{myScore.toFixed(1)} / {challenge.target_value} target</Text>
        </View>
      )}

      {/* Invite code / share */}
      {challenge.status === 'pending' && (
        <View style={cc.inviteWrap}>
          <Text style={cc.inviteLabel}>Share this code with your friend</Text>
          <View style={cc.inviteRow}>
            <Text style={cc.inviteCode}>{challenge.invite_code}</Text>
            <TouchableOpacity style={cc.shareBtn} onPress={onShare} activeOpacity={0.8}>
              <Text style={cc.shareTxt}>Share ↗</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
};

const cc = StyleSheet.create({
  card: { backgroundColor: Colors.bg2, borderRadius: 18, borderWidth: 0.5, borderColor: Colors.border, padding: 16, marginBottom: 10 },
  statusRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, borderWidth: 0.5 },
  statusTxt: { fontFamily: Typography.headingBold, fontSize: 10 },
  typeLabel: { fontFamily: Typography.headingBold, fontSize: 10, color: Colors.tx3 },
  vsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  vsPlayer: { flex: 1, alignItems: 'flex-start', gap: 4 },
  vsName: { fontFamily: Typography.headingBold, fontSize: 12, color: Colors.tx2 },
  vsScore: { fontFamily: Typography.heading, fontSize: 28, letterSpacing: -1 },
  winTag: { fontFamily: Typography.headingBold, fontSize: 9, color: Colors.lime },
  vs: { fontFamily: Typography.heading, fontSize: 16, color: Colors.tx3, paddingHorizontal: 12 },
  progressWrap: { gap: 6, marginBottom: 10 },
  progressTrack: { height: 4, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 2, overflow: 'hidden' },
  progressFill: { height: 4, backgroundColor: Colors.lime, borderRadius: 2 },
  progressTxt: { fontFamily: Typography.body, fontSize: 9, color: Colors.tx3 },
  inviteWrap: { backgroundColor: 'rgba(200,244,90,0.04)', borderRadius: 12, borderWidth: 0.5, borderColor: 'rgba(200,244,90,0.15)', padding: 12, gap: 8 },
  inviteLabel: { fontFamily: Typography.headingBold, fontSize: 9, color: Colors.tx3, textTransform: 'uppercase', letterSpacing: 0.8 },
  inviteRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  inviteCode: { fontFamily: Typography.heading, fontSize: 22, color: Colors.lime, letterSpacing: 2 },
  shareBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10, backgroundColor: Colors.lime },
  shareTxt: { fontFamily: Typography.headingBold, fontSize: 12, color: '#071810' },
});

// ── Main screen ────────────────────────────────────────────────────────────────
export default function CarbonChallengeScreen({ navigation }: any) {
  const { profile } = useAuthStore();
  const insets = useSafeAreaInsets();
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedType, setSelectedType] = useState('weekly_co2');
  const [message, setMessage] = useState('');
  const [myWeeklySaved, setMyWeeklySaved] = useState(0);

  useFocusEffect(useCallback(() => { loadData(); }, [profile?.id]));

  const loadData = async () => {
    if (!profile?.id) return;
    setLoading(true);

    // Load challenges
    const { data: cData } = await supabase
      .from('challenges')
      .select('*')
      .or(`challenger_id.eq.${profile.id},challenged_id.eq.${profile.id}`)
      .order('created_at', { ascending: false });

    if (cData) setChallenges(cData);

    // Get this week's CO₂ saved for target
    const monday = new Date();
    monday.setDate(monday.getDate() - (monday.getDay() === 0 ? 6 : monday.getDay() - 1));
    monday.setHours(0, 0, 0, 0);

    const { data: acts } = await supabase
      .from('activities')
      .select('co2_kg')
      .eq('user_id', profile.id)
      .gte('logged_at', monday.toISOString());

    const weekCo2 = acts?.reduce((s: number, a: any) => s + (a.co2_kg || 0), 0) || 0;
    setMyWeeklySaved(Math.max(0, (28.6 * 7) - weekCo2));
    setLoading(false);
  };

  const createChallenge = async () => {
    if (!profile?.id) return;
    setCreating(true);

    const code = generateCode(profile.full_name || 'ECO');
    const targetVal = selectedType === 'weekly_co2' ? Math.round(myWeeklySaved) :
                      selectedType === 'streak' ? 7 : 20;

    const { data } = await supabase.from('challenges').insert({
      challenger_id: profile.id,
      challenger_name: profile.full_name || 'Eco user',
      challenge_type: selectedType,
      target_value: targetVal,
      invite_code: code,
      message: message || `Can you beat my ${targetVal} ${selectedType === 'weekly_co2' ? 'kg CO₂e saved' : selectedType === 'streak' ? 'day streak' : 'activities'}?`,
      status: 'pending',
      ends_at: new Date(Date.now() + 30 * 86400000).toISOString(),
    }).select().single();

    if (data) {
      setChallenges(prev => [data, ...prev]);
      setShowCreate(false);
      setMessage('');
      // Auto-share
      await Share.share({
        message: `I challenge you to a Carbon Challenge on Eco Pulse! 🌿\n\nUse my code: ${code}\n\n${data.message}\n\necopulse.app`,
      });
    }
    setCreating(false);
  };

  const shareChallenge = async (challenge: Challenge) => {
    await Share.share({
      message: `Join my Carbon Challenge on Eco Pulse! 🌿\n\nCode: ${challenge.invite_code}\n\n${challenge.message}\n\necopulse.app`,
    });
  };

  const myChallenges = challenges.filter(c => c.challenger_id === profile?.id);
  const receivedChallenges = challenges.filter(c => c.challenger_id !== profile?.id);

  return (
    <View style={s.root}>
      <View style={[s.phone, { paddingTop: insets.top || 12 }]}>
        <StatusBar barStyle="light-content" backgroundColor={Colors.bg} />

        {/* Header */}
        <View style={s.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
            <Text style={s.backTxt}>✕</Text>
          </TouchableOpacity>
          <View style={s.headerCenter}>
            <Text style={s.title}>Carbon Challenge</Text>
            <Text style={s.subtitle}>Dare a friend to go greener</Text>
          </View>
          <View style={{ width: 32 }} />
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 14, paddingBottom: 80 }}>

          {/* Create challenge CTA */}
          {!showCreate ? (
            <TouchableOpacity style={s.createCard} onPress={() => setShowCreate(true)} activeOpacity={0.85}>
              <Text style={s.createIcon}>⚡</Text>
              <View style={s.createText}>
                <Text style={s.createTitle}>Start a new challenge</Text>
                <Text style={s.createDesc}>Challenge a friend to beat your weekly CO₂e savings</Text>
              </View>
              <Text style={s.createArrow}>›</Text>
            </TouchableOpacity>
          ) : (
            <View style={s.createForm}>
              <Text style={s.formTitle}>Choose challenge type</Text>
              {CHALLENGE_TYPES.map(t => (
                <TouchableOpacity
                  key={t.id}
                  style={[s.typeOption, selectedType === t.id && s.typeOptionOn]}
                  onPress={() => setSelectedType(t.id)}
                  activeOpacity={0.8}
                >
                  <Text style={s.typeIcon}>{t.icon}</Text>
                  <View style={s.typeText}>
                    <Text style={[s.typeLabel, selectedType === t.id && { color: Colors.lime }]}>{t.label}</Text>
                    <Text style={s.typeDesc}>{t.desc}</Text>
                  </View>
                  {selectedType === t.id && <Text style={s.typeTick}>✓</Text>}
                </TouchableOpacity>
              ))}

              <Text style={[s.formTitle, { marginTop: 16 }]}>Add a message (optional)</Text>
              <TextInput
                style={s.messageInput}
                placeholder="e.g. I bet you can't beat my score this month!"
                placeholderTextColor={Colors.tx3}
                value={message}
                onChangeText={setMessage}
                multiline
              />

              <View style={s.formActions}>
                <TouchableOpacity style={s.cancelBtn} onPress={() => setShowCreate(false)}>
                  <Text style={s.cancelTxt}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.submitBtn} onPress={createChallenge} disabled={creating} activeOpacity={0.8}>
                  {creating ? <ActivityIndicator color="#071810" size="small" /> : <Text style={s.submitTxt}>Create & Share ⚡</Text>}
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Loading */}
          {loading ? (
            <View style={s.loadWrap}>
              <ActivityIndicator color={Colors.lime} size="small" />
            </View>
          ) : (
            <>
              {/* My challenges */}
              {myChallenges.length > 0 && (
                <View style={s.section}>
                  <Text style={s.sectionTitle}>Your challenges</Text>
                  {myChallenges.map(c => (
                    <ChallengeCard key={c.id} challenge={c} isChallenger onShare={() => shareChallenge(c)} />
                  ))}
                </View>
              )}

              {/* Received */}
              {receivedChallenges.length > 0 && (
                <View style={s.section}>
                  <Text style={s.sectionTitle}>Challenges received</Text>
                  {receivedChallenges.map(c => (
                    <ChallengeCard key={c.id} challenge={c} isChallenger={false} onShare={() => shareChallenge(c)} />
                  ))}
                </View>
              )}

              {/* Empty */}
              {challenges.length === 0 && !showCreate && (
                <View style={s.emptyWrap}>
                  <Text style={s.emptyIcon}>⚡</Text>
                  <Text style={s.emptyTitle}>No challenges yet</Text>
                  <Text style={s.emptyDesc}>Create your first challenge and share the code with a friend. The invite IS the challenge.</Text>
                </View>
              )}
            </>
          )}
        </ScrollView>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000', alignItems: 'center' },
  phone: { width: 390, maxWidth: '100%', height: '100%', backgroundColor: Colors.bg, overflow: 'hidden' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 12, marginBottom: 4 },
  backBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: Colors.sf, justifyContent: 'center', alignItems: 'center' },
  backTxt: { color: Colors.tx2, fontSize: 14 },
  headerCenter: { alignItems: 'center', gap: 2 },
  title: { fontFamily: Typography.heading, fontSize: 18, color: Colors.tx, letterSpacing: -0.3 },
  subtitle: { fontFamily: Typography.body, fontSize: 10, color: Colors.tx3 },
  createCard: { backgroundColor: 'rgba(252,211,77,0.06)', borderRadius: 18, borderWidth: 0.5, borderColor: 'rgba(252,211,77,0.2)', padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 20 },
  createIcon: { fontSize: 28 },
  createText: { flex: 1, gap: 3 },
  createTitle: { fontFamily: Typography.heading, fontSize: 15, color: Colors.tx, letterSpacing: -0.3 },
  createDesc: { fontFamily: Typography.body, fontSize: 11, color: Colors.tx3 },
  createArrow: { fontSize: 22, color: Colors.tx3 },
  createForm: { backgroundColor: Colors.bg2, borderRadius: 18, borderWidth: 0.5, borderColor: Colors.border, padding: 16, marginBottom: 20, gap: 8 },
  formTitle: { fontFamily: Typography.headingBold, fontSize: 10, color: Colors.tx3, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 4 },
  typeOption: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 12, borderWidth: 0.5, borderColor: Colors.border, backgroundColor: Colors.sf },
  typeOptionOn: { borderColor: 'rgba(200,244,90,0.3)', backgroundColor: 'rgba(200,244,90,0.06)' },
  typeIcon: { fontSize: 20 },
  typeText: { flex: 1, gap: 2 },
  typeLabel: { fontFamily: Typography.headingBold, fontSize: 13, color: Colors.tx },
  typeDesc: { fontFamily: Typography.body, fontSize: 10, color: Colors.tx3 },
  typeTick: { fontFamily: Typography.headingBold, fontSize: 14, color: Colors.lime },
  messageInput: { backgroundColor: Colors.sf, borderWidth: 0.5, borderColor: Colors.border2, borderRadius: 12, padding: 12, fontSize: 13, color: Colors.tx, minHeight: 60 },
  formActions: { flexDirection: 'row', gap: 8, marginTop: 8 },
  cancelBtn: { flex: 1, paddingVertical: 12, borderRadius: 12, backgroundColor: Colors.sf, borderWidth: 0.5, borderColor: Colors.border, alignItems: 'center' },
  cancelTxt: { fontFamily: Typography.headingBold, fontSize: 13, color: Colors.tx3 },
  submitBtn: { flex: 2, paddingVertical: 12, borderRadius: 12, backgroundColor: '#FCD34D', alignItems: 'center' },
  submitTxt: { fontFamily: Typography.headingBold, fontSize: 13, color: '#071810' },
  section: { marginBottom: 16 },
  sectionTitle: { fontFamily: Typography.headingBold, fontSize: 9, color: Colors.tx3, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 },
  loadWrap: { paddingVertical: 24, alignItems: 'center' },
  emptyWrap: { alignItems: 'center', paddingTop: 40, paddingHorizontal: 20, gap: 12 },
  emptyIcon: { fontSize: 48 },
  emptyTitle: { fontFamily: Typography.heading, fontSize: 18, color: Colors.tx2 },
  emptyDesc: { fontFamily: Typography.body, fontSize: 13, color: Colors.tx3, textAlign: 'center', lineHeight: 20 },
});
