import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  StatusBar, ActivityIndicator, TextInput
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Colors, Typography } from '../../constants/theme';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../lib/authStore';

interface Habit {
  id: string;
  name: string;
  icon: string;
  frequency: string;
  color: string;
  dotColor: string;
  streak: number;
  logs: string[];
  co2_saved: number;
  stat: string;
}

interface Suggestion {
  id: string;
  name: string;
  icon: string;
  evidence: string;
  quote: string;
  co2_preview: string;
  activity_type: string;
}

const getLast14Days = (): string[] => {
  const days: string[] = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push(d.toISOString().split('T')[0]);
  }
  return days;
};

const calcStreak = (logs: string[]): number => {
  let streak = 0;
  const sorted = [...logs].sort().reverse();
  for (let i = 0; i < sorted.length; i++) {
    const expected = new Date(Date.now() - i * 86400000).toISOString().split('T')[0];
    if (sorted[i] === expected) streak++;
    else break;
  }
  return streak;
};

const RhythmHeatmap = ({ logs, dotColor, streak }: { logs: string[]; dotColor: string; streak: number }) => {
  const last14 = getLast14Days();
  const logSet = new Set(logs);
  const today = new Date().toISOString().split('T')[0];
  return (
    <View style={hm.row}>
      <Text style={hm.label}>14 days</Text>
      {last14.map((day, i) => {
        const done = logSet.has(day);
        const isToday = day === today;
        const daysFromEnd = last14.length - 1 - i;
        const inStreak = done && daysFromEnd < streak;
        return (
          <View key={day} style={[hm.dot, done && { backgroundColor: dotColor }, inStreak && { shadowColor: dotColor, shadowOpacity: 0.7, shadowRadius: 4, shadowOffset: { width: 0, height: 0 } }, isToday && done && { width: 11, height: 11, borderRadius: 6, borderWidth: 1, borderColor: dotColor + 'CC' }]} />
        );
      })}
    </View>
  );
};

const hm = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 8 },
  label: { fontFamily: Typography.headingBold, fontSize: 7, color: Colors.tx3, textTransform: 'uppercase', letterSpacing: 0.4, width: 30, flexShrink: 0 },
  dot: { width: 9, height: 9, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.07)', flex: 1, maxWidth: 14 },
});

export default function HabitsScreen({ navigation }: any) {
  const { profile } = useAuthStore();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [habits, setHabits] = useState<Habit[]>([]);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [nudge, setNudge] = useState('');
  const [streak, setStreak] = useState(0);
  const [totalDays, setTotalDays] = useState(0);
  const [totalCo2, setTotalCo2] = useState(0);
  const [addingHabit, setAddingHabit] = useState(false);
  const [newHabitText, setNewHabitText] = useState('');
  const [dismissedSuggestions, setDismissedSuggestions] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<'habits' | 'moments'>('habits');
  const [moments, setMoments] = useState<any[]>([]);

  useEffect(() => { if (profile?.id) { loadHabitsData(); loadMoments(); } }, [profile?.id]);

  useFocusEffect(useCallback(() => { loadHabitsData(); loadMoments(); }, [profile?.id]));

  const loadMoments = async () => {
    const { data } = await supabase
      .from('moments')
      .select('*, profiles(full_name)')
      .order('created_at', { ascending: false })
      .limit(20);
    if (data) setMoments(data.map((m: any) => ({ ...m, profile: m.profiles })));
  };

  const loadHabitsData = async () => {
    if (!profile?.id) { setLoading(false); return; }
    setLoading(true);
    const { data: acts } = await supabase
      .from('activities')
      .select('activity_type, category, co2_kg, logged_at')
      .eq('user_id', profile.id)
      .order('logged_at', { ascending: false });

    if (!acts) { setLoading(false); return; }

    const last14 = getLast14Days();
    const last14Set = new Set(last14);
    const cutoff30 = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
    const recent = acts.filter((a: any) => a.logged_at?.split('T')[0] >= cutoff30);

    const typeCounts: Record<string, number> = {};
    const typeDates: Record<string, Set<string>> = {};
    const typeCo2: Record<string, number> = {};

    recent.forEach((a: any) => {
      const t = a.activity_type || a.category || 'other';
      const d = a.logged_at?.split('T')[0];
      typeCounts[t] = (typeCounts[t] || 0) + 1;
      if (!typeDates[t]) typeDates[t] = new Set();
      if (d) typeDates[t].add(d);
      typeCo2[t] = (typeCo2[t] || 0) + (a.co2_kg || 0);
    });

    const HABIT_META: Record<string, { icon: string; name: string; frequency: string; color: string; dotColor: string }> = {
      cycling:   { icon: '🚴', name: 'Cycle to work',        frequency: 'Mon · Wed · Fri', color: 'rgba(200,244,90,0.08)',  dotColor: Colors.lime  },
      vegmeal:   { icon: '🥗', name: 'Plant-based meal',     frequency: 'Daily',           color: 'rgba(252,211,77,0.08)',  dotColor: Colors.amber },
      bus:       { icon: '🚌', name: 'Take the bus',          frequency: 'Weekdays',        color: 'rgba(45,212,191,0.08)',  dotColor: Colors.teal  },
      walking:   { icon: '🚶', name: 'Walk instead of drive', frequency: 'Daily',           color: 'rgba(200,244,90,0.08)',  dotColor: Colors.lime  },
      ac:        { icon: '❄️', name: 'No A/C after 10pm',     frequency: 'Every night',     color: 'rgba(45,212,191,0.08)',  dotColor: Colors.teal  },
      coffee:    { icon: '☕', name: 'Walk for coffee',        frequency: 'Daily',           color: 'rgba(251,113,133,0.08)', dotColor: '#FB7185'    },
      meatmeal:  { icon: '🥩', name: 'Reduce meat meals',     frequency: 'Weekdays',        color: 'rgba(252,211,77,0.08)',  dotColor: Colors.amber },
      streaming: { icon: '📱', name: 'Screen-free evenings',  frequency: 'Evenings',        color: 'rgba(200,244,90,0.08)',  dotColor: Colors.lime  },
    };

    const confirmedHabits: Habit[] = [];
    Object.entries(typeCounts)
      .filter(([_, count]) => count >= 3)
      .slice(0, 4)
      .forEach(([type]) => {
        const meta = HABIT_META[type];
        if (!meta) return;
        const actDates = [...(typeDates[type] || [])];
        const last14Logs = actDates.filter(d => last14Set.has(d));
        const s = calcStreak(last14Logs);
        const co2 = Math.abs(typeCo2[type] || 0);
        confirmedHabits.push({ id: type, name: meta.name, icon: meta.icon, frequency: meta.frequency, color: meta.color, dotColor: meta.dotColor, streak: s, logs: last14Logs, co2_saved: co2, stat: `${actDates.length}× this month · ${co2.toFixed(1)} kg tracked` });
      });

    setHabits(confirmedHabits);

    const SUGGEST_META: Record<string, { icon: string; name: string; quote: string; co2_preview: string }> = {
      cycling: { icon: '🚴', name: 'Cycling commute',  quote: "Looks like cycling is becoming part of your routine. Want me to track this as a habit?", co2_preview: '~4.2 kg saved/week' },
      vegmeal: { icon: '🥗', name: 'Meatless days',    quote: "You've been choosing plant-based meals more often. Want to make this official?",          co2_preview: '~2.4 kg saved/week' },
      bus:     { icon: '🚌', name: 'Transit days',      quote: "You've taken the bus on several days this month. This habit could save 1.8 kg CO₂e/week.", co2_preview: '~1.8 kg saved/week' },
      walking: { icon: '🚶', name: 'Walking instead',   quote: "You've been walking more lately. Want to make this a tracked habit?",                     co2_preview: '~0.5 kg saved/week' },
      ac:      { icon: '❄️', name: 'Lower energy use',  quote: "Your energy footprint has been lower this week. Want to set a habit around this?",        co2_preview: '~0.9 kg saved/week' },
    };

    const suggestionCandidates: Suggestion[] = [];
    Object.entries(typeCounts)
      .filter(([type, count]) => count >= 1 && count < 3 && SUGGEST_META[type])
      .slice(0, 2)
      .forEach(([type, count]) => {
        const meta = SUGGEST_META[type];
        suggestionCandidates.push({ id: type, name: meta.name, icon: meta.icon, evidence: `You've logged this ${count} time${count > 1 ? 's' : ''} in the last 30 days`, quote: meta.quote, co2_preview: meta.co2_preview, activity_type: type });
      });

    setSuggestions(suggestionCandidates);

    const uniqueDays = new Set(acts.map((a: any) => a.logged_at?.split('T')[0])).size;
    const savedVsAvg = Math.max(0, (28.6 * uniqueDays) - acts.reduce((s: number, a: any) => s + (a.co2_kg || 0), 0));
    setTotalDays(uniqueDays);
    setTotalCo2(Math.round(savedVsAvg));

    const allDates = acts.map((a: any) => a.logged_at?.split('T')[0]).filter(Boolean);
    const uniqueSortedDates = [...new Set(allDates)].sort().reverse();
    let overallStreak = 0;
    for (let i = 0; i < uniqueSortedDates.length; i++) {
      const expected = new Date(Date.now() - i * 86400000).toISOString().split('T')[0];
      if (uniqueSortedDates[i] === expected) overallStreak++;
      else break;
    }
    setStreak(overallStreak);

    const topHabit = confirmedHabits[0];
    if (topHabit && topHabit.streak > 0) setNudge(`You've kept your ${topHabit.name.toLowerCase()} habit going for ${topHabit.streak} days. Don't break it today.`);
    else if (confirmedHabits.length > 0) setNudge(`You have ${confirmedHabits.length} active habit${confirmedHabits.length > 1 ? 's' : ''} this month. Every choice builds something real.`);
    else setNudge("Your first habit starts with one logged moment. What did you do differently today?");

    setLoading(false);
  };

  const confirmSuggestion = async (suggestion: Suggestion) => {
    const newHabit: Habit = { id: suggestion.activity_type, name: suggestion.name, icon: suggestion.icon, frequency: 'As you log it', color: 'rgba(45,212,191,0.08)', dotColor: Colors.teal, streak: 0, logs: [], co2_saved: 0, stat: 'Just started · building momentum' };
    setHabits(prev => [...prev, newHabit]);
    setSuggestions(prev => prev.filter(s => s.id !== suggestion.id));
  };

  const dismissSuggestion = (id: string) => {
    setDismissedSuggestions(prev => [...prev, id]);
    setSuggestions(prev => prev.filter(s => s.id !== id));
  };

  const visibleSuggestions = suggestions.filter(s => !dismissedSuggestions.includes(s.id));

  if (loading) return (
    <View style={s.root}>
      <View style={[s.phone, { paddingTop: insets.top || 12, justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator color={Colors.lime} size="large" />
        <Text style={{ color: Colors.tx3, fontFamily: Typography.body, fontSize: 12, marginTop: 10 }}>Reading your rhythm...</Text>
      </View>
    </View>
  );

  return (
    <View style={s.root}>
      <View style={[s.phone, { paddingTop: insets.top || 12 }]}>
        <StatusBar barStyle="light-content" backgroundColor={Colors.bg} />

        {/* HEADER */}
        <View style={s.header}>
          <View>
            <Text style={s.title}>{activeTab === 'habits' ? 'Habits' : 'Moments'}</Text>
            <Text style={s.subtitle}>{activeTab === 'habits' ? 'Your green rhythm' : 'Community green acts'}</Text>
          </View>
          <View style={s.toggleWrap}>
            <TouchableOpacity style={[s.toggleBtn, activeTab === 'habits' && s.toggleBtnOn]} onPress={() => setActiveTab('habits')}>
              <Text style={[s.toggleTxt, activeTab === 'habits' && s.toggleTxtOn]}>My Habits</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.toggleBtn, activeTab === 'moments' && s.toggleBtnMoments]} onPress={() => setActiveTab('moments')}>
              <Text style={[s.toggleTxt, activeTab === 'moments' && s.toggleTxtMoments]}>Moments</Text>
            </TouchableOpacity>
          </View>
        </View>

        {activeTab === 'habits' ? (
          <>
            {/* SUMMARY STRIP */}
            <View style={s.summaryRow}>
              {[
                { val: String(habits.length),             label: 'Active',      color: Colors.lime  },
                { val: `${streak}d`,                      label: 'Best streak', color: Colors.amber },
                { val: `${totalCo2}kg`,                   label: 'CO₂e saved',   color: Colors.teal  },
                { val: String(visibleSuggestions.length), label: 'Suggested',   color: Colors.tx2   },
              ].map((st, i) => (
                <View key={i} style={[s.sumCell, i < 3 && { borderRightWidth: 0.5, borderRightColor: Colors.border }]}>
                  <Text style={[s.sumVal, { color: st.color }]}>{st.val}</Text>
                  <Text style={s.sumLabel}>{st.label}</Text>
                </View>
              ))}
            </View>

            <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
              {/* ECO NUDGE */}
              <View style={s.nudge}>
                <Text style={{ fontSize: 16 }}>🌿</Text>
                <Text style={s.nudgeText}>{nudge}</Text>
              </View>

              {/* ACTIVE HABITS */}
              <View style={s.section}>
                <View style={s.sectionHeader}>
                  <Text style={s.sectionTitle}>🔥 Your active habits</Text>
                  <TouchableOpacity><Text style={s.sectionLink}>Manage</Text></TouchableOpacity>
                </View>
                {habits.length === 0 ? (
                  <View style={s.emptyCard}>
                    <Text style={s.emptyIcon}>🌱</Text>
                    <Text style={s.emptyTitle}>No habits yet</Text>
                    <Text style={s.emptyDesc}>Log a few activities and Eco will spot your patterns.</Text>
                  </View>
                ) : habits.map((habit) => (
                  <View key={habit.id} style={[s.habitCard, { backgroundColor: habit.color, borderColor: habit.dotColor + '30' }]}>
                    <View style={s.habitTop}>
                      <View style={[s.habitIcon, { backgroundColor: habit.dotColor + '15' }]}>
                        <Text style={{ fontSize: 18 }}>{habit.icon}</Text>
                      </View>
                      <View style={s.habitInfo}>
                        <Text style={s.habitName}>{habit.name}</Text>
                        <Text style={s.habitFreq}>{habit.frequency}</Text>
                      </View>
                      <View style={s.habitRight}>
                        {habit.streak > 0 && <Text style={[s.habitStreak, { color: habit.dotColor }]}>{habit.streak > 6 ? '🔥' : habit.streak > 2 ? '🌱' : '✦'} {habit.streak} days</Text>}
                        <Text style={s.habitImpact}>{habit.co2_saved > 0 ? `−${habit.co2_saved.toFixed(1)} kg` : 'tracking'}</Text>
                      </View>
                    </View>
                    <RhythmHeatmap logs={habit.logs} dotColor={habit.dotColor} streak={habit.streak} />
                    <View style={s.habitBottom}>
                      <Text style={s.habitStat}>{habit.stat}</Text>
                      <TouchableOpacity style={s.pauseBtn}><Text style={s.pauseTxt}>Pause</Text></TouchableOpacity>
                    </View>
                  </View>
                ))}
              </View>

              {/* ECO SUGGESTS */}
              {visibleSuggestions.length > 0 && (
                <View style={s.section}>
                  <View style={s.sectionHeader}>
                    <Text style={s.sectionTitle}>💡 Eco suggests</Text>
                    <TouchableOpacity><Text style={s.sectionLink}>See all</Text></TouchableOpacity>
                  </View>
                  {visibleSuggestions.map((suggestion) => (
                    <View key={suggestion.id} style={s.suggestCard}>
                      <View style={s.suggestTop}>
                        <View style={[s.habitIcon, { backgroundColor: 'rgba(200,244,90,0.1)' }]}>
                          <Text style={{ fontSize: 18 }}>{suggestion.icon}</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                            <Text style={s.suggestName}>{suggestion.name}</Text>
                            <View style={s.spotBadge}><Text style={s.spotBadgeTxt}>Eco spotted</Text></View>
                          </View>
                          <Text style={s.suggestEvidence}>{suggestion.evidence}</Text>
                        </View>
                      </View>
                      <Text style={s.suggestQuote}>"{suggestion.quote}"</Text>
                      <Text style={s.suggestCo2}>{suggestion.co2_preview} if you keep it up</Text>
                      <View style={s.suggestActions}>
                        <TouchableOpacity style={s.confirmBtn} onPress={() => confirmSuggestion(suggestion)}>
                          <Text style={s.confirmTxt}>✓ Yes, track it</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={s.dismissBtn} onPress={() => dismissSuggestion(suggestion.id)}>
                          <Text style={s.dismissTxt}>Dismiss</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))}
                </View>
              )}

              {/* ADD A HABIT */}
              <View style={s.section}>
                {!addingHabit ? (
                  <TouchableOpacity style={s.addHabitBtn} onPress={() => setAddingHabit(true)} activeOpacity={0.8}>
                    <View style={s.addHabitIcon}><Text style={{ fontSize: 18 }}>✨</Text></View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.addHabitTitle}>Set a new intention</Text>
                      <Text style={s.addHabitDesc}>Tell Eco what you want to do — it'll track it for you</Text>
                    </View>
                    <Text style={s.addArrow}>›</Text>
                  </TouchableOpacity>
                ) : (
                  <View style={s.addHabitInput}>
                    <Text style={s.addInputLabel}>What do you want to do more of?</Text>
                    <TextInput style={s.textInput} value={newHabitText} onChangeText={setNewHabitText} placeholder="e.g. cycle to work on Tuesdays..." placeholderTextColor={Colors.tx3} multiline autoFocus />
                    <View style={s.addInputActions}>
                      <TouchableOpacity style={[s.addSaveBtn, !newHabitText.trim() && { opacity: 0.4 }]} onPress={() => { if (newHabitText.trim()) { setHabits(prev => [...prev, { id: `custom_${Date.now()}`, name: newHabitText.trim().slice(0, 40), icon: '🌿', frequency: 'As you log it', color: 'rgba(200,244,90,0.06)', dotColor: Colors.lime, streak: 0, logs: [], co2_saved: 0, stat: 'Just started · building momentum' }]); setNewHabitText(''); setAddingHabit(false); } }} disabled={!newHabitText.trim()}>
                        <Text style={s.addSaveTxt}>Save habit</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={s.addCancelBtn} onPress={() => { setAddingHabit(false); setNewHabitText(''); }}>
                        <Text style={s.addCancelTxt}>Cancel</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </View>
            </ScrollView>
          </>
        ) : (
          /* MOMENTS VIEW */
          <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 14, paddingBottom: 100 }}>
            <View style={{ flexDirection: 'row', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
              {['All', 'Level ups', 'Streaks', 'Green acts'].map((f, i) => (
                <View key={f} style={{ paddingHorizontal: 12, paddingVertical: 5, borderRadius: 16, backgroundColor: i === 0 ? 'rgba(200,244,90,0.1)' : Colors.bg2, borderWidth: 0.5, borderColor: i === 0 ? 'rgba(200,244,90,0.3)' : Colors.border }}>
                  <Text style={{ fontFamily: Typography.headingBold, fontSize: 11, color: i === 0 ? Colors.lime : Colors.tx3 }}>{f}</Text>
                </View>
              ))}
            </View>
            {moments.length === 0 ? (
              <View style={{ alignItems: 'center', paddingTop: 40, gap: 10 }}>
                <Text style={{ fontSize: 40 }}>🌱</Text>
                <Text style={{ fontFamily: Typography.heading, fontSize: 16, color: Colors.tx2 }}>No moments yet</Text>
                <Text style={{ fontFamily: Typography.body, fontSize: 12, color: Colors.tx3, textAlign: 'center', lineHeight: 18 }}>Log activities and hit milestones — they'll appear here.</Text>
              </View>
            ) : moments.map((m: any) => (
              <View key={m.id} style={{ backgroundColor: Colors.bg2, borderRadius: 16, borderWidth: 0.5, borderColor: Colors.border, padding: 14, marginBottom: 10 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                  <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(200,244,90,0.1)', justifyContent: 'center', alignItems: 'center' }}>
                    <Text style={{ fontFamily: Typography.headingBold, fontSize: 10, color: Colors.lime }}>
                      {m.profile?.full_name?.split(' ').map((w: string) => w[0]).join('').slice(0, 2) || 'EP'}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontFamily: Typography.headingBold, fontSize: 12, color: Colors.tx }}>{m.profile?.full_name || 'Eco user'}</Text>
                    <Text style={{ fontFamily: Typography.body, fontSize: 10, color: Colors.tx3 }}>{new Date(m.created_at).toLocaleDateString()}</Text>
                  </View>
                  <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, backgroundColor: 'rgba(200,244,90,0.08)', borderWidth: 0.5, borderColor: 'rgba(200,244,90,0.2)' }}>
                    <Text style={{ fontFamily: Typography.headingBold, fontSize: 8, color: Colors.lime, textTransform: 'uppercase' }}>{m.type?.replace('_', ' ')}</Text>
                  </View>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <Text style={{ fontSize: 24 }}>{m.emoji}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontFamily: Typography.heading, fontSize: 15, color: Colors.tx }}>{m.title}</Text>
                    {m.subtitle && <Text style={{ fontFamily: Typography.body, fontSize: 11, color: Colors.tx3 }}>{m.subtitle}</Text>}
                  </View>
                  <Text style={{ fontFamily: Typography.heading, fontSize: 14, color: Colors.lime }}>{m.value}</Text>
                </View>
              </View>
            ))}
          </ScrollView>
        )}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg, alignItems: 'center' },
  phone: { width: 390, maxWidth: '100%', flex: 1, backgroundColor: Colors.bg, overflow: 'hidden' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingTop: 4, paddingBottom: 12, borderBottomWidth: 0.5, borderBottomColor: Colors.border },
  title: { fontFamily: Typography.heading, fontSize: 22, color: Colors.tx, letterSpacing: -0.8 },
  subtitle: { fontFamily: Typography.body, fontSize: 11, color: Colors.tx3, marginTop: 2 },
  toggleWrap: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 20, padding: 3, gap: 2, borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.08)' },
  toggleBtn: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 16 },
  toggleBtnOn: { backgroundColor: 'rgba(200,244,90,0.15)' },
  toggleBtnMoments: { backgroundColor: 'rgba(45,212,191,0.15)' },
  toggleTxt: { fontFamily: Typography.headingBold, fontSize: 9, color: 'rgba(255,255,255,0.3)' },
  toggleTxtOn: { color: Colors.lime },
  toggleTxtMoments: { color: Colors.teal },
  summaryRow: { flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: Colors.border },
  sumCell: { flex: 1, paddingVertical: 10, alignItems: 'center' },
  sumVal: { fontFamily: Typography.heading, fontSize: 18, letterSpacing: -0.5 },
  sumLabel: { fontFamily: Typography.body, fontSize: 8, color: Colors.tx3, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 1 },
  nudge: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, margin: 12, backgroundColor: 'rgba(45,212,191,0.06)', borderWidth: 0.5, borderColor: 'rgba(45,212,191,0.2)', borderRadius: 14, padding: 12 },
  nudgeText: { fontFamily: Typography.body, fontSize: 12, color: Colors.tx2, lineHeight: 18, flex: 1 },
  section: { paddingHorizontal: 12, marginBottom: 4 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  sectionTitle: { fontFamily: Typography.headingBold, fontSize: 11, color: Colors.tx3, textTransform: 'uppercase', letterSpacing: 0.8 },
  sectionLink: { fontFamily: Typography.headingBold, fontSize: 10, color: 'rgba(200,244,90,0.6)' },
  habitCard: { borderRadius: 16, borderWidth: 0.5, padding: 12, marginBottom: 8 },
  habitTop: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  habitIcon: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  habitInfo: { flex: 1 },
  habitName: { fontFamily: Typography.headingBold, fontSize: 13, color: Colors.tx, marginBottom: 2, letterSpacing: -0.2 },
  habitFreq: { fontFamily: Typography.body, fontSize: 10, color: Colors.tx3 },
  habitRight: { alignItems: 'flex-end', gap: 3 },
  habitStreak: { fontFamily: Typography.headingBold, fontSize: 12 },
  habitImpact: { fontFamily: Typography.headingBold, fontSize: 9, color: 'rgba(200,244,90,0.7)' },
  habitBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 0.5, borderTopColor: 'rgba(255,255,255,0.05)', paddingTop: 8 },
  habitStat: { fontFamily: Typography.body, fontSize: 9, color: Colors.tx3, flex: 1 },
  pauseBtn: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.08)' },
  pauseTxt: { fontFamily: Typography.headingBold, fontSize: 9, color: Colors.tx3 },
  suggestCard: { backgroundColor: Colors.bg2, borderWidth: 0.5, borderColor: 'rgba(200,244,90,0.18)', borderRadius: 16, borderStyle: 'dashed', padding: 12, marginBottom: 8 },
  suggestTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 10 },
  suggestName: { fontFamily: Typography.headingBold, fontSize: 13, color: Colors.tx, letterSpacing: -0.2 },
  spotBadge: { backgroundColor: 'rgba(200,244,90,0.1)', borderWidth: 0.5, borderColor: 'rgba(200,244,90,0.2)', borderRadius: 5, paddingHorizontal: 5, paddingVertical: 2 },
  spotBadgeTxt: { fontFamily: Typography.headingBold, fontSize: 7, color: Colors.lime, textTransform: 'uppercase', letterSpacing: 0.5 },
  suggestEvidence: { fontFamily: Typography.body, fontSize: 10, color: Colors.tx3, lineHeight: 15 },
  suggestQuote: { fontFamily: Typography.body, fontSize: 11, color: Colors.tx2, lineHeight: 17, fontStyle: 'italic', marginBottom: 6 },
  suggestCo2: { fontFamily: Typography.headingBold, fontSize: 9, color: 'rgba(200,244,90,0.6)', marginBottom: 10 },
  suggestActions: { flexDirection: 'row', gap: 8 },
  confirmBtn: { flex: 1, paddingVertical: 9, borderRadius: 10, backgroundColor: 'rgba(200,244,90,0.1)', borderWidth: 0.5, borderColor: 'rgba(200,244,90,0.25)', alignItems: 'center' },
  confirmTxt: { fontFamily: Typography.headingBold, fontSize: 11, color: Colors.lime },
  dismissBtn: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.08)', alignItems: 'center' },
  dismissTxt: { fontFamily: Typography.headingBold, fontSize: 11, color: Colors.tx3 },
  addHabitBtn: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.1)', borderRadius: 16, padding: 14, borderStyle: 'dashed', backgroundColor: 'rgba(255,255,255,0.02)', marginBottom: 8 },
  addHabitIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(200,244,90,0.06)', borderWidth: 0.5, borderColor: 'rgba(200,244,90,0.15)', justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  addHabitTitle: { fontFamily: Typography.headingBold, fontSize: 13, color: Colors.tx2, marginBottom: 2 },
  addHabitDesc: { fontFamily: Typography.body, fontSize: 10, color: Colors.tx3 },
  addArrow: { fontFamily: Typography.heading, fontSize: 20, color: 'rgba(200,244,90,0.4)' },
  addHabitInput: { backgroundColor: Colors.bg2, borderWidth: 0.5, borderColor: 'rgba(200,244,90,0.2)', borderRadius: 16, padding: 14, marginBottom: 8 },
  addInputLabel: { fontFamily: Typography.headingBold, fontSize: 11, color: Colors.tx2, marginBottom: 8 },
  textInput: { backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 0.5, borderColor: Colors.border, borderRadius: 10, padding: 10, fontFamily: Typography.body, fontSize: 12, color: Colors.tx, minHeight: 60, marginBottom: 10 },
  addInputActions: { flexDirection: 'row', gap: 8 },
  addSaveBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, backgroundColor: 'rgba(200,244,90,0.12)', borderWidth: 0.5, borderColor: 'rgba(200,244,90,0.3)', alignItems: 'center' },
  addSaveTxt: { fontFamily: Typography.headingBold, fontSize: 12, color: Colors.lime },
  addCancelBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 0.5, borderColor: Colors.border, alignItems: 'center' },
  addCancelTxt: { fontFamily: Typography.headingBold, fontSize: 12, color: Colors.tx3 },
  emptyCard: { backgroundColor: Colors.bg2, borderWidth: 0.5, borderColor: Colors.border, borderRadius: 16, padding: 24, alignItems: 'center', gap: 8, marginBottom: 8 },
  emptyIcon: { fontSize: 32 },
  emptyTitle: { fontFamily: Typography.heading, fontSize: 15, color: Colors.tx, letterSpacing: -0.3 },
  emptyDesc: { fontFamily: Typography.body, fontSize: 12, color: Colors.tx3, textAlign: 'center', lineHeight: 18 },
});
