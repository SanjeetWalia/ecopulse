// src/screens/air/EcoChatScreen.tsx — the "Ask your air anything" thread
//
// Presented as a modal from the Air screen's chat bar.
// History loads from eco_chat_messages (RLS: own rows only).
// Sending: optimistic append → eco-chat edge function → append reply.
// The server persists both sides; this screen only ever inserts nothing
// directly — it reads history and displays.

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  StatusBar,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Typography } from '../../constants/theme';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../lib/authStore';

interface ChatMsg {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  pending?: boolean;
}

const OPENERS = [
  'What was my biggest source this month?',
  'Is oat milk actually better?',
  'How bad is one short flight?',
];

export default function EcoChatScreen({ navigation }: any) {
  const { profile } = useAuthStore();
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);

  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  const loadHistory = useCallback(async () => {
    if (!profile?.id) return;
    setLoading(true);
    const { data } = await supabase
      .from('eco_chat_messages')
      .select('id, role, content')
      .eq('user_id', profile.id)
      .order('created_at', { ascending: true })
      .limit(100);
    setMessages((data as ChatMsg[]) ?? []);
    setLoading(false);
  }, [profile?.id]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  useEffect(() => {
    // Keep the newest message visible.
    const t = setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);
    return () => clearTimeout(t);
  }, [messages.length]);

  const send = async (text?: string) => {
    const msg = (text ?? input).trim();
    if (!msg || sending || !profile?.id) return;

    setInput('');
    setSending(true);

    const tempUser: ChatMsg = { id: `tmp-u-${Date.now()}`, role: 'user', content: msg };
    setMessages((prev) => [...prev, tempUser]);

    try {
      const { data, error } = await supabase.functions.invoke('eco-chat', {
        body: { userId: profile.id, message: msg },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const reply: ChatMsg = {
        id: `tmp-a-${Date.now()}`,
        role: 'assistant',
        content: data?.reply ?? '…',
      };
      setMessages((prev) => [...prev, reply]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: `tmp-e-${Date.now()}`,
          role: 'assistant',
          content: 'I lost my breath for a moment — try that again.',
        },
      ]);
    }
    setSending(false);
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: Colors.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={[s.root, { paddingTop: insets.top || 16 }]}>
        <StatusBar barStyle="light-content" backgroundColor={Colors.bg} />

        {/* Header */}
        <View style={s.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={s.closeBtn}>
            <Text style={s.closeTxt}>✕</Text>
          </TouchableOpacity>
          <View style={s.headerCenter}>
            <Text style={s.headerTitle}>🌱 Your air</Text>
            <Text style={s.headerSub}>ecological questions only · remembers you</Text>
          </View>
          <View style={{ width: 34 }} />
        </View>

        {/* Thread */}
        {loading ? (
          <View style={s.centered}>
            <ActivityIndicator color={Colors.lime} />
          </View>
        ) : (
          <ScrollView
            ref={scrollRef}
            style={{ flex: 1 }}
            contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 12, gap: 8 }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {messages.length === 0 && (
              <View style={s.emptyWrap}>
                <Text style={s.emptyTitle}>Ask your air anything</Text>
                <Text style={s.emptySub}>
                  Answers use your real numbers, and every exchange is remembered — it gets more yours over time.
                </Text>
                <View style={{ gap: 8, marginTop: 14, alignSelf: 'stretch' }}>
                  {OPENERS.map((o) => (
                    <TouchableOpacity key={o} style={s.opener} onPress={() => send(o)} activeOpacity={0.8}>
                      <Text style={s.openerTxt}>{o}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            {messages.map((m) => (
              <View
                key={m.id}
                style={[s.bubble, m.role === 'user' ? s.bubbleUser : s.bubbleAssistant]}
              >
                <Text style={[s.bubbleTxt, m.role === 'user' && { color: '#071810' }]}>
                  {m.content}
                </Text>
              </View>
            ))}

            {sending && (
              <View style={[s.bubble, s.bubbleAssistant, { flexDirection: 'row', gap: 8, alignItems: 'center' }]}>
                <ActivityIndicator size="small" color={Colors.teal} />
                <Text style={[s.bubbleTxt, { color: Colors.tx3 }]}>breathing in…</Text>
              </View>
            )}
          </ScrollView>
        )}

        {/* Input */}
        <View style={[s.inputBar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          <TextInput
            style={s.input}
            placeholder="Ask your air anything…"
            placeholderTextColor={Colors.tx3}
            value={input}
            onChangeText={setInput}
            multiline
            maxLength={2000}
            returnKeyType="send"
            onSubmitEditing={() => send()}
          />
          <TouchableOpacity
            style={[s.sendBtn, (!input.trim() || sending) && { opacity: 0.4 }]}
            onPress={() => send()}
            disabled={!input.trim() || sending}
            activeOpacity={0.85}
          >
            <Text style={s.sendTxt}>→</Text>
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.07)',
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: Colors.sf,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeTxt: { color: Colors.tx2, fontSize: 14 },
  headerCenter: { alignItems: 'center', gap: 2 },
  headerTitle: { fontFamily: Typography.headingBold, fontSize: 15, color: Colors.tx },
  headerSub: { fontFamily: Typography.body, fontSize: 9.5, color: Colors.tx3 },

  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  emptyWrap: { alignItems: 'center', paddingTop: 40, paddingHorizontal: 24 },
  emptyTitle: { fontFamily: Typography.heading, fontSize: 20, color: Colors.tx, letterSpacing: -0.4 },
  emptySub: {
    fontFamily: Typography.body,
    fontSize: 12.5,
    color: Colors.tx2,
    textAlign: 'center',
    lineHeight: 19,
    marginTop: 8,
  },
  opener: {
    backgroundColor: Colors.sf,
    borderWidth: 0.5,
    borderColor: Colors.border2,
    borderRadius: 14,
    paddingVertical: 11,
    paddingHorizontal: 14,
  },
  openerTxt: { fontFamily: Typography.body, fontSize: 13, color: Colors.tx2 },

  bubble: { maxWidth: '84%', borderRadius: 16, paddingHorizontal: 13, paddingVertical: 10 },
  bubbleUser: { alignSelf: 'flex-end', backgroundColor: Colors.lime, borderBottomRightRadius: 5 },
  bubbleAssistant: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(45,212,191,0.08)',
    borderWidth: 0.5,
    borderColor: 'rgba(45,212,191,0.2)',
    borderBottomLeftRadius: 5,
  },
  bubbleTxt: { fontFamily: Typography.body, fontSize: 13.5, color: Colors.tx, lineHeight: 20 },

  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    paddingHorizontal: 12,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.07)',
  },
  input: {
    flex: 1,
    backgroundColor: Colors.sf,
    borderWidth: 0.5,
    borderColor: Colors.border,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontFamily: Typography.body,
    fontSize: 14,
    color: Colors.tx,
    maxHeight: 110,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.lime,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendTxt: { fontSize: 17, color: '#071810', fontWeight: '700' },
});
