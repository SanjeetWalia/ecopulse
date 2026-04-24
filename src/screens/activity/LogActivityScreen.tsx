import { invalidateMokoAviCache } from '../../lib/mokoAvi';
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, StatusBar, ActivityIndicator, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Colors, Typography, Radius } from '../../constants/theme';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../lib/authStore';

const QUICK_FACTORS: Record<string, { icon: string; co2: number; category: string; unit: string }> = {
  car:        { icon: '🚗', co2: 0.404,  category: 'transport', unit: 'miles' },
  cycling:    { icon: '🚴', co2: 0.0,    category: 'transport', unit: 'miles' },
  walking:    { icon: '🚶', co2: 0.0,    category: 'transport', unit: 'miles' },
  bus:        { icon: '🚌', co2: 0.089,  category: 'transport', unit: 'miles' },
  train:      { icon: '🚆', co2: 0.041,  category: 'transport', unit: 'miles' },
  flight:     { icon: '✈️', co2: 0.255,  category: 'transport', unit: 'miles' },
  meatmeal:   { icon: '🥩', co2: 3.6,    category: 'food',      unit: 'servings' },
  vegmeal:    { icon: '🥗', co2: 0.8,    category: 'food',      unit: 'servings' },
  coffee:     { icon: '☕', co2: 0.21,   category: 'food',      unit: 'cups' },
  heating:    { icon: '🌡️', co2: 2.1,    category: 'energy',    unit: 'hours' },
  ac:         { icon: '❄️', co2: 1.8,    category: 'energy',    unit: 'hours' },
  solar:      { icon: '☀️', co2: -0.23,  category: 'energy',    unit: 'kWh' },
  streaming:  { icon: '📺', co2: 0.036,  category: 'digital',   unit: 'hours' },
  recycling:  { icon: '♻️', co2: -0.1,   category: 'other',     unit: 'sessions' },
  composting: { icon: '🌱', co2: -0.5,   category: 'other',     unit: 'sessions' },
};

interface Message {
  role: 'user' | 'assistant';
  text: string;
  quickReplies?: string[];
  logResult?: { label: string; co2_kg: number; category: string; activity_type: string };
  pending?: boolean;
}

// ── System prompt ─────────────────────────────────────────────────────────────
const SYSTEM_PROMPT = `You are Eco, a friendly carbon footprint assistant in the Eco Pulse app. Help users log activities conversationally.

CRITICAL RULES:
- NEVER show or mention [DISTANCE DATA] tags to the user — these are invisible system data for your calculations only
- NEVER say you need to "look up" distance — just use what you know or estimate confidently
- NEVER ask for distance — always estimate using your knowledge of real-world locations

Steps:
1. If [DISTANCE DATA] is present → use that exact mileage, never ask for distance
2. If no [DISTANCE DATA] → estimate distance confidently using your knowledge (e.g. Frisco TX is in Dallas suburbs, typical gym trip 3-5 miles, typical commute 10-20 miles)
3. Once you have distance + vehicle type → output JSON immediately
4. Only ask ONE question maximum per turn, and only if truly needed (e.g. vehicle type)

Output JSON (one line, no markdown):
{"ready":true,"label":"short description","co2_kg":0.0,"category":"transport|food|energy|digital|other","activity_type":"car|bus|cycling|walking|flight|train|meatmeal|vegmeal|coffee|heating|ac|solar|streaming|recycling|composting|custom","message":"friendly 1-line confirmation","quickReplies":["Log another","Done"]}

CO2 per mile: petrol car 0.404, diesel 0.35, hybrid 0.21, EV 0.079, bus 0.089, cycling 0, walking 0, flight 0.255, train 0.041.
Other: meat meal 3.6/serving, veg meal 0.8/serving, coffee 0.21/cup, heating 2.1/hr, AC 1.8/hr, streaming 0.036/hr.

Mercedes GLC 63 AMG = petrol. BMW M cars = petrol. Tesla = EV. Use common sense for car types.
Be warm, brief. Max 1 sentence when asking questions.`;

const getImpact = (co2: number) => {
  if (co2 <= 0) return { label: '🌿 Carbon saving', sublabel: "You're helping the planet!", color: Colors.lime, bg: 'rgba(200,244,90,0.1)', border: 'rgba(200,244,90,0.3)' };
  if (co2 < 1)  return { label: '🟢 Low impact',     sublabel: co2 < 0.1 ? 'Barely a footprint' : 'Well within a green day', color: Colors.lime, bg: 'rgba(200,244,90,0.06)', border: 'rgba(200,244,90,0.15)' };
  if (co2 < 3)  return { label: '🟡 Moderate impact',sublabel: 'Worth being mindful of', color: Colors.amber, bg: 'rgba(252,211,77,0.06)', border: 'rgba(252,211,77,0.2)' };
  return               { label: '🔴 High impact',    sublabel: 'Consider alternatives next time', color: Colors.coral, bg: 'rgba(251,113,133,0.06)', border: 'rgba(251,113,133,0.2)' };
};

export default function LogActivityScreen({ navigation }: any) {
  const { profile } = useAuthStore();
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [thinking, setThinking] = useState(false);
  const [history, setHistory] = useState<{ role: string; content: string }[]>([]);
  const [recentActivities, setRecentActivities] = useState<any[]>([]);
  const [pendingCount, setPendingCount] = useState(0);

  useFocusEffect(useCallback(() => { loadRecentActivities(); initChat(); }, [profile?.id]));
  useEffect(() => { setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 150); }, [messages, thinking]);

  const loadRecentActivities = async () => {
    if (!profile?.id) return;
    const { data } = await supabase.from('activities').select('id, label, activity_type, category, co2_kg, unit').eq('user_id', profile.id).order('logged_at', { ascending: false }).limit(20);
    if (data) {
      const seen = new Set<string>(); const unique: any[] = [];
      data.forEach((a: any) => { if (!seen.has(a.activity_type) && unique.length < 6) { seen.add(a.activity_type); unique.push({ ...a, icon: QUICK_FACTORS[a.activity_type]?.icon || '✏️' }); } });
      setRecentActivities(unique);
    }
  };

  const initChat = () => {
    const firstName = profile?.full_name?.split(' ')[0] || 'there';
    setMessages([{ role: 'assistant', text: `Hey ${firstName}! 🌿 What did you do today? Just tell me naturally — I'll handle the rest.`, quickReplies: ['🚗 Drove somewhere', '🚴 Cycled', '🥗 Had a meal', '⚡ Used energy'] }]);
    setHistory([]);
  };

  const saveActivity = async (result: any, pending = false) => {
    if (!profile?.id) return;
    await supabase.from('activities').insert({ user_id: profile.id, category: result.category, activity_type: result.activity_type, label: result.label, amount: Math.abs(result.co2_kg), unit: 'kg', co2_kg: Math.abs(result.co2_kg), source: pending ? 'pending' : 'ai', logged_at: new Date().toISOString() });
    if (pending) setPendingCount(p => p + 1);
    loadRecentActivities();
    invalidateMokoAviCache(profile.id);
  };

  const savePendingFromText = (text: string) => {
    const lower = text.toLowerCase();
    const checks: [string[], string][] = [
      [['cycl', 'bike'], 'cycling'], [['drove', 'driving', 'uber', 'lyft'], 'car'], [['bus'], 'bus'],
      [['train', 'metro'], 'train'], [['flew', 'flight'], 'flight'], [['meat', 'burger', 'chicken', 'steak'], 'meatmeal'],
      [['veg', 'salad', 'plant'], 'vegmeal'], [['coffee'], 'coffee'], [['heat', 'furnace'], 'heating'],
      [['stream', 'netflix', 'watch'], 'streaming'], [['recycl'], 'recycling'], [['compost'], 'composting'],
    ];
    for (const [keywords, key] of checks) { if (keywords.some(k => lower.includes(k))) { const f = QUICK_FACTORS[key]; return { label: text.slice(0, 60), co2_kg: f.co2, category: f.category, activity_type: key }; } }
    return { label: text.slice(0, 60), co2_kg: 0, category: 'other', activity_type: 'custom' };
  };

  const sendMessage = async (text?: string) => {
    const userText = (text || input).trim();
    if (!userText || thinking) return;
    setInput('');

    const newMessages = [...messages, { role: 'user' as const, text: userText }];
    setMessages(newMessages);
    setThinking(true);

    const newHistory = [...history, { role: 'user', content: userText }];

    try {
      const { data, error: fnError } = await supabase.functions.invoke('analyze-activity', {
        body: { messages: newHistory },
      });
      if (fnError) throw new Error(fnError.message);
      if (data?.error) throw new Error(data.error);
      const responseText = data?.responseText || '';

      try {
        // Find the JSON object by locating the first { and matching closing }
        const start = responseText.indexOf('{"ready":true');
        if (start !== -1) {
          // Find the matching closing brace
          let depth = 0, end = -1;
          for (let i = start; i < responseText.length; i++) {
            if (responseText[i] === '{') depth++;
            else if (responseText[i] === '}') { depth--; if (depth === 0) { end = i; break; } }
          }
          if (end !== -1) {
            const parsed = JSON.parse(responseText.slice(start, end + 1));
            await saveActivity(parsed);
            setMessages([...newMessages, { role: 'assistant', text: parsed.message || 'Logged!', logResult: parsed, quickReplies: parsed.quickReplies || ['Log another', 'Done'] }]);
            setHistory([...newHistory, { role: 'assistant', content: responseText }]);
            setThinking(false); return;
          }
        }
      } catch { }
      setMessages([...newMessages, { role: 'assistant', text: responseText }]);
      setHistory([...newHistory, { role: 'assistant', content: responseText }]);
    } catch {
      const pending = savePendingFromText(userText);
      await saveActivity(pending, true);
      setMessages([...newMessages, { role: 'assistant', text: `Saved to your feed 📋 — I'll calculate the exact CO₂ when I'm back online.`, pending: true, logResult: pending, quickReplies: ['Log another', 'Done'] }]);
    }
    setThinking(false);
  };

  const handleQuickReply = (r: string) => {
    if (r === 'Done' || r === 'View today') { navigation.goBack(); return; }
    if (r === 'Log another') { initChat(); return; }
    sendMessage(r);
  };

  const handleRecentTap = (act: any) => {
  const labelShort = act.label.split('·')[0].trim();
  Alert.alert(
    'Log this again?',
    `${act.icon} ${labelShort} (${act.co2_kg.toFixed(1)} kg CO₂e)`,
    [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log it',
        onPress: async () => {
          const result = { label: act.label, co2_kg: act.co2_kg, category: act.category, activity_type: act.activity_type };
          await saveActivity(result);
          setMessages(prev => [
            ...prev,
            { role: 'user' as const, text: `Log ${labelShort} again` },
            { role: 'assistant' as const, text: `${act.icon} Done! Logged again.`, logResult: result, quickReplies: ['Log another', 'Done'] }
          ]);
        },
      },
    ]
  );
};

  return (
    <View style={s.root}>
      <View style={[s.phone, { paddingTop: insets.top || 12 }]}>
        <StatusBar barStyle="light-content" backgroundColor={Colors.bg} />
        <View style={s.header}>
          <TouchableOpacity style={s.closeBtn} onPress={() => navigation.goBack()}><Text style={s.closeTxt}>✕</Text></TouchableOpacity>
          <View style={s.headerCenter}>
            <Text style={s.headerTitle}>Log activity</Text>
            {pendingCount > 0 && <View style={s.pendingBadge}><Text style={s.pendingBadgeTxt}>{pendingCount} pending sync</Text></View>}
          </View>
          <View style={{ width: 32 }} />
        </View>

        {recentActivities.length > 0 && (
          <View style={s.recentWrap}>
            <Text style={s.recentLabel}>Recent</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 12 }}>
              {recentActivities.map((act, i) => {
                const impact = getImpact(act.co2_kg);
                return (
                  <TouchableOpacity key={i} style={[s.recentChip, { borderColor: impact.border }]} onPress={() => handleRecentTap(act)} activeOpacity={0.7}>
                    <Text style={s.recentChipIcon}>{act.icon}</Text>
                    <Text style={s.recentChipTxt} numberOfLines={1}>{act.label.split('·')[0].trim()}</Text>
                    <View style={[s.recentDot, { backgroundColor: impact.color }]} />
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        )}

        <ScrollView ref={scrollRef} style={{ flex: 1 }} contentContainerStyle={{ padding: 12, gap: 10 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {messages.map((m, i) => (
            <View key={i} style={{ gap: 6 }}>
              <View style={[s.bubble, m.role === 'user' ? s.userBubble : s.aiBubble]}>
                {m.role === 'assistant' && (
                  <View style={s.aiHeader}>
                    <Text style={s.aiAvatar}>🌿</Text>
                    <Text style={s.aiName}>Eco</Text>
                    {m.pending && <View style={s.pendingTag}><Text style={s.pendingTagTxt}>saved offline</Text></View>}
                  </View>
                )}
                <Text style={[s.bubbleTxt, m.role === 'user' && s.userTxt]}>{m.text}</Text>
                {m.logResult && (() => {
                  const impact = getImpact(m.logResult.co2_kg);
                  return (
                    <View style={[s.resultCard, { backgroundColor: impact.bg, borderColor: impact.border }]}>
                      <View style={s.resultRow}>
                        <Text style={s.resultLabel} numberOfLines={2}>{m.logResult.label}</Text>
                        <Text style={[s.resultCo2, { color: impact.color }]}>
                          {m.logResult.co2_kg === 0 ? '0 kg 🌿' : m.logResult.co2_kg < 0 ? `${Math.abs(m.logResult.co2_kg).toFixed(2)} kg saved` : `${m.logResult.co2_kg.toFixed(2)} kg`}
                        </Text>
                      </View>
                      <View style={[s.impactBadge, { backgroundColor: impact.bg, borderColor: impact.border }]}>
                        <Text style={[s.impactLabel, { color: impact.color }]}>{impact.label}</Text>
                        <Text style={s.impactSub}>{impact.sublabel}</Text>
                      </View>
                      <Text style={s.loggedTxt}>✓ Logged to Green Steps</Text>
                    </View>
                  );
                })()}
              </View>
              {m.quickReplies && i === messages.length - 1 && (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingLeft: 36 }}>
                  {m.quickReplies.map((qr, j) => (
                    <TouchableOpacity key={j} style={s.quickReply} onPress={() => handleQuickReply(qr)} activeOpacity={0.7}>
                      <Text style={s.quickReplyTxt}>{qr}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              )}
            </View>
          ))}
          {thinking && (
            <View style={s.aiBubble}>
              <View style={s.aiHeader}><Text style={s.aiAvatar}>🌿</Text><Text style={s.aiName}>Eco</Text></View>
              <View style={{ flexDirection: 'row', gap: 4, paddingVertical: 4 }}>
                {[0.3, 0.6, 1].map((op, i) => <View key={i} style={[s.dot, { opacity: op }]} />)}
              </View>
            </View>
          )}
        </ScrollView>

        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={s.inputWrap}>
            <TextInput style={s.input} placeholder="What did you do? e.g. drove to work, had a salad..." placeholderTextColor={Colors.tx3} value={input} onChangeText={setInput} onSubmitEditing={() => sendMessage()} returnKeyType="send" multiline />
            <TouchableOpacity style={[s.sendBtn, (!input.trim() || thinking) && s.sendBtnOff]} onPress={() => sendMessage()} disabled={!input.trim() || thinking} activeOpacity={0.8}>
              {thinking ? <ActivityIndicator color="#071810" size="small" /> : <Text style={[s.sendTxt, !input.trim() && { color: Colors.tx3 }]}>↑</Text>}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg },
  phone: { flex: 1, backgroundColor: Colors.bg, overflow: 'hidden' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 0.5, borderBottomColor: Colors.border },
  closeBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: Colors.sf, justifyContent: 'center', alignItems: 'center' },
  closeTxt: { color: Colors.tx2, fontSize: 14 },
  headerCenter: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerTitle: { fontFamily: Typography.heading, fontSize: 16, color: Colors.tx, letterSpacing: -0.3 },
  pendingBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8, backgroundColor: 'rgba(252,211,77,0.15)', borderWidth: 0.5, borderColor: 'rgba(252,211,77,0.3)' },
  pendingBadgeTxt: { fontFamily: Typography.headingBold, fontSize: 8, color: Colors.amber },
  recentWrap: { borderBottomWidth: 0.5, borderBottomColor: Colors.border, paddingVertical: 8 },
  recentLabel: { fontFamily: Typography.headingBold, fontSize: 8, color: Colors.tx3, textTransform: 'uppercase', letterSpacing: 0.8, paddingHorizontal: 14, marginBottom: 6 },
  recentChip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20, backgroundColor: Colors.bg2, borderWidth: 0.5 },
  recentChipIcon: { fontSize: 12 },
  recentChipTxt: { fontFamily: Typography.headingBold, fontSize: 10, color: Colors.tx2, maxWidth: 80 },
  recentDot: { width: 5, height: 5, borderRadius: 3 },
  bubble: { borderRadius: 18, padding: 12, maxWidth: '88%' },
  aiBubble: { alignSelf: 'flex-start', backgroundColor: Colors.bg2, borderWidth: 0.5, borderColor: Colors.border },
  userBubble: { alignSelf: 'flex-end', backgroundColor: 'rgba(200,244,90,0.1)', borderWidth: 0.5, borderColor: 'rgba(200,244,90,0.2)' },
  aiHeader: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 5 },
  aiAvatar: { fontSize: 12 },
  aiName: { fontFamily: Typography.headingBold, fontSize: 9, color: Colors.lime, textTransform: 'uppercase', letterSpacing: 0.5 },
  pendingTag: { paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4, backgroundColor: 'rgba(252,211,77,0.15)', borderWidth: 0.5, borderColor: 'rgba(252,211,77,0.3)' },
  pendingTagTxt: { fontFamily: Typography.headingBold, fontSize: 7, color: Colors.amber },
  bubbleTxt: { fontFamily: Typography.body, fontSize: 14, color: Colors.tx, lineHeight: 20 },
  userTxt: { color: Colors.tx },
  resultCard: { marginTop: 8, borderRadius: 12, padding: 10, borderWidth: 0.5 },
  resultRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6, gap: 8 },
  resultLabel: { fontFamily: Typography.headingBold, fontSize: 12, color: Colors.tx, flex: 1 },
  resultCo2: { fontFamily: Typography.heading, fontSize: 15, letterSpacing: -0.3 },
  impactBadge: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 5, borderRadius: 8, borderWidth: 0.5, marginBottom: 6 },
  impactLabel: { fontFamily: Typography.headingBold, fontSize: 10 },
  impactSub: { fontFamily: Typography.body, fontSize: 9, color: Colors.tx3 },
  loggedTxt: { fontFamily: Typography.headingBold, fontSize: 9, color: Colors.lime },
  quickReply: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 16, backgroundColor: Colors.bg2, borderWidth: 0.5, borderColor: Colors.border2 },
  quickReplyTxt: { fontFamily: Typography.headingBold, fontSize: 11, color: Colors.tx2 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: Colors.tx3 },
  inputWrap: { flexDirection: 'row', gap: 8, padding: 12, borderTopWidth: 0.5, borderTopColor: Colors.border, backgroundColor: Colors.bg, alignItems: 'flex-end' },
  input: { flex: 1, backgroundColor: Colors.sf, borderWidth: 0.5, borderColor: Colors.border2, borderRadius: 22, paddingHorizontal: 16, paddingVertical: 10, fontSize: 14, color: Colors.tx, maxHeight: 100 },
  sendBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.lime, justifyContent: 'center', alignItems: 'center' },
  sendBtnOff: { backgroundColor: Colors.sf, borderWidth: 0.5, borderColor: Colors.border },
  sendTxt: { fontSize: 18, color: '#071810', fontWeight: '900' },
});
