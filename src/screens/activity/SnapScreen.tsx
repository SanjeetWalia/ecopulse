import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, StatusBar,
  ActivityIndicator, ScrollView, Image, TextInput, KeyboardAvoidingView, Platform
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { Colors, Typography } from '../../constants/theme';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../lib/authStore';


interface SnapResult {
  label: string;
  co2_kg: number;
  category: string;
  activity_type: string;
  explanation: string;
  confidence: 'high' | 'medium' | 'low';
  suggestions: string[];
}

// Context modifiers — each adds/subtracts CO₂ and explains why
const CONTEXT_CHIPS = [
  { id: 'delivery',  label: '🛵 Delivery',      delta: +0.8,  note: '+0.8 kg for rider trip' },
  { id: 'oatmilk',  label: '🌾 Oat milk',       delta: -0.08, note: '−0.08 kg vs dairy' },
  { id: 'reusable', label: '♻️ Reusable cup',    delta: -0.11, note: '−0.11 kg vs disposable' },
  { id: 'chain',    label: '🏪 Chain café',      delta: +0.05, note: '+0.05 kg supply chain' },
  { id: 'local',    label: '🌱 Local café',      delta: -0.04, note: '−0.04 kg vs chain' },
  { id: 'organic',  label: '🌿 Organic',         delta: -0.03, note: '−0.03 kg certified' },
  { id: 'flight',   label: '✈️ Long haul',       delta: +180,  note: '+180 kg return flight' },
  { id: 'electric', label: '⚡ Electric car',    delta: -0.25, note: '−0.25 kg/mile vs petrol' },
];

const getImpact = (co2: number) => {
  if (co2 <= 0) return { label: '🌿 Carbon saving', color: Colors.lime,   bg: 'rgba(200,244,90,0.1)',  border: 'rgba(200,244,90,0.3)'  };
  if (co2 < 1)  return { label: '🟢 Low impact',    color: Colors.lime,   bg: 'rgba(200,244,90,0.06)', border: 'rgba(200,244,90,0.15)' };
  if (co2 < 3)  return { label: '🟡 Moderate',      color: Colors.amber,  bg: 'rgba(252,211,77,0.06)', border: 'rgba(252,211,77,0.2)'  };
  return               { label: '🔴 High impact',   color: '#FB7185',     bg: 'rgba(251,113,133,0.06)',border: 'rgba(251,113,133,0.2)' };
};

const SNAP_TIPS = [
  { icon: '🍽️', text: 'Snap your meal to estimate food carbon' },
  { icon: '🚗', text: 'Photo of your car or fuel receipt' },
  { icon: '🧾', text: 'Energy bill or shopping receipt' },
  { icon: '✈️', text: 'Boarding pass for flight emissions' },
  { icon: '🛍️', text: 'Product or packaging for lifecycle CO₂' },
];

export default function SnapScreen({ navigation }: any) {
  const { profile } = useAuthStore();
  const insets = useSafeAreaInsets();
  const [image, setImage] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<SnapResult | null>(null);
  const [logged, setLogged] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Feedback loop
  const [showCorrect, setShowCorrect] = useState(false);
  const [correctionText, setCorrectionText] = useState('');
  const [correcting, setCorrecting] = useState(false);

  // Context chips
  const [activeChips, setActiveChips] = useState<string[]>([]);
  const [contextDelta, setContextDelta] = useState(0);
  const [contextNotes, setContextNotes] = useState<string[]>([]);

  useFocusEffect(useCallback(() => {
    setImage(null); setImageBase64(null); setResult(null);
    setLogged(false); setError(null); setShowCorrect(false);
    setCorrectionText(''); setActiveChips([]); setContextDelta(0); setContextNotes([]);
  }, []));

  const pickImage = async (source: 'camera' | 'gallery') => {
    setError(null);
    let res;
    if (source === 'camera') {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') { setError('Camera permission needed.'); return; }
      res = await ImagePicker.launchCameraAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.8, allowsEditing: true });
    } else {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') { setError('Gallery permission needed.'); return; }
      res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.8, allowsEditing: true });
    }
    if (!res.canceled && res.assets[0]) {
      const asset = res.assets[0];
      // Resize to max 1024px wide, re-encode at 60% quality, get base64
      const resized = await ImageManipulator.manipulateAsync(
        asset.uri,
        [{ resize: { width: 1024 } }],
        { compress: 0.6, format: ImageManipulator.SaveFormat.JPEG, base64: true }
      );
      setImage(resized.uri);
      setImageBase64(resized.base64 || null);
      setResult(null); setLogged(false);
      setActiveChips([]); setContextDelta(0); setContextNotes([]);
      if (resized.base64) analyzeImage(resized.base64);
    }
  };
const analyzeImage = async (base64: string, correction?: string) => {
    setAnalyzing(true); setError(null);
    try {
      const { data, error: fnError } = await supabase.functions.invoke('analyze-food-photo', {
        body: correction
          ? { correction }
          : { imageBase64: base64 },
      });

      if (fnError) throw new Error(fnError.message);
      if (data?.error) throw new Error(data.error);
      if (!data?.result) throw new Error('No result returned');

      setResult(data.result);
      setActiveChips([]);
      setContextDelta(0);
      setContextNotes([]);
      setShowCorrect(false);
      setCorrectionText('');
    } catch (e: any) {
      setError('Could not analyze image. Please try again.');
    }
    setAnalyzing(false);
  };

  const submitCorrection = async () => {
    if (!correctionText.trim()) return;
    setCorrecting(true);
    await analyzeImage(imageBase64 || '', correctionText.trim());
    setCorrecting(false);
  };

  const toggleChip = (chip: typeof CONTEXT_CHIPS[0]) => {
    const isActive = activeChips.includes(chip.id);
    if (isActive) {
      setActiveChips(prev => prev.filter(c => c !== chip.id));
      setContextDelta(prev => prev - chip.delta);
      setContextNotes(prev => prev.filter(n => n !== chip.note));
    } else {
      setActiveChips(prev => [...prev, chip.id]);
      setContextDelta(prev => prev + chip.delta);
      setContextNotes(prev => [...prev, chip.note]);
    }
  };

  const logActivity = async () => {
    if (!result || !profile?.id) return;
    const finalCo2 = Math.max(0, result.co2_kg + contextDelta);
    const contextLabel = contextNotes.length > 0 ? ` (${contextNotes.join(', ')})` : '';
    await supabase.from('activities').insert({
      user_id: profile.id,
      category: result.category,
      activity_type: result.activity_type,
      label: result.label + contextLabel,
      amount: finalCo2,
      unit: 'kg',
      co2_kg: finalCo2,
      source: 'snap',
      logged_at: new Date().toISOString(),
    });
    setLogged(true);
  };

  const reset = () => {
    setImage(null); setImageBase64(null); setResult(null);
    setLogged(false); setError(null); setShowCorrect(false);
    setCorrectionText(''); setActiveChips([]); setContextDelta(0); setContextNotes([]);
  };

  const finalCo2 = result ? Math.max(0, result.co2_kg + contextDelta) : 0;
  const impact = result ? getImpact(finalCo2) : null;

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: '#000', alignItems: 'center' } as any} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={[s.phone, { paddingTop: insets.top || 12 }]}>
        <StatusBar barStyle="light-content" backgroundColor={Colors.bg} />

        <View style={s.header}>
          <View>
            <Text style={s.title}>Snap</Text>
            <Text style={s.subtitle}>Photo carbon assessment</Text>
          </View>
          {image && <TouchableOpacity style={s.resetBtn} onPress={reset}><Text style={s.resetTxt}>New snap</Text></TouchableOpacity>}
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 14, paddingBottom: 80 }} keyboardShouldPersistTaps="handled">

          {/* Empty state */}
          {!image && (
            <>
              <View style={s.captureRow}>
                <TouchableOpacity style={s.captureBtn} onPress={() => pickImage('camera')} activeOpacity={0.85}>
                  <Text style={s.captureBtnIcon}>📷</Text>
                  <Text style={s.captureBtnTxt}>Take photo</Text>
                  <Text style={s.captureBtnSub}>Use your camera</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[s.captureBtn, s.galleryBtn]} onPress={() => pickImage('gallery')} activeOpacity={0.85}>
                  <Text style={s.captureBtnIcon}>🖼️</Text>
                  <Text style={s.captureBtnTxt}>From gallery</Text>
                  <Text style={s.captureBtnSub}>Pick existing photo</Text>
                </TouchableOpacity>
              </View>
              <View style={s.tipsSection}>
                <Text style={s.tipsTitle}>What can I snap?</Text>
                {SNAP_TIPS.map((tip, i) => (
                  <View key={i} style={s.tipRow}>
                    <Text style={s.tipIcon}>{tip.icon}</Text>
                    <Text style={s.tipText}>{tip.text}</Text>
                  </View>
                ))}
              </View>
              {error && <View style={s.errorBox}><Text style={s.errorTxt}>{error}</Text></View>}
            </>
          )}

          {/* Image preview */}
          {image && (
            <View style={s.imageWrap}>
              <Image source={{ uri: image }} style={s.previewImage} resizeMode="cover" />
              {analyzing && (
                <View style={s.analyzingOverlay}>
                  <ActivityIndicator color={Colors.lime} size="large" />
                  <Text style={s.analyzingTxt}>{correcting ? 'Recalculating...' : 'Analysing carbon footprint...'}</Text>
                </View>
              )}
            </View>
          )}

          {/* Result card */}
          {result && !analyzing && impact && (
            <View style={[s.resultCard, { backgroundColor: impact.bg, borderColor: impact.border }]}>

              {/* Header */}
              <View style={s.resultHeader}>
                <Text style={s.resultLabel}>{result.label}</Text>
                <View style={[s.confidenceBadge, { borderColor: impact.border }]}>
                  <Text style={[s.confidenceTxt, { color: impact.color }]}>{result.confidence} confidence</Text>
                </View>
              </View>

              {/* CO₂ number */}
              <View style={s.co2Row}>
                <Text style={[s.co2Number, { color: impact.color }]}>
                  {finalCo2 === 0 ? '0' : finalCo2 < 0 ? `-${Math.abs(finalCo2).toFixed(2)}` : finalCo2.toFixed(2)}
                </Text>
                <Text style={s.co2Unit}>kg CO₂e</Text>
                <View style={[s.impactBadge, { backgroundColor: impact.bg, borderColor: impact.border }]}>
                  <Text style={[s.impactLabel, { color: impact.color }]}>{impact.label}</Text>
                </View>
              </View>

              {/* Context delta display */}
              {contextDelta !== 0 && (
                <View style={s.deltaRow}>
                  <Text style={s.deltaBase}>Base: {result.co2_kg.toFixed(2)} kg</Text>
                  <Text style={[s.deltaAmt, { color: contextDelta > 0 ? '#FB7185' : Colors.lime }]}>
                    {contextDelta > 0 ? '+' : ''}{contextDelta.toFixed(2)} kg context
                  </Text>
                  <Text style={[s.deltaTotal, { color: impact.color }]}>= {finalCo2.toFixed(2)} kg</Text>
                </View>
              )}

              <Text style={s.explanation}>{result.explanation}</Text>

              {/* ── Context chips ──────────────────────────────────── */}
              <View style={s.contextSection}>
                <Text style={s.contextTitle}>Add context — how was this ordered?</Text>
                <View style={s.chipsWrap}>
                  {CONTEXT_CHIPS.map(chip => {
                    const active = activeChips.includes(chip.id);
                    return (
                      <TouchableOpacity
                        key={chip.id}
                        style={[s.chip, active && { backgroundColor: 'rgba(200,244,90,0.15)', borderColor: 'rgba(200,244,90,0.4)' }]}
                        onPress={() => toggleChip(chip)}
                        activeOpacity={0.7}
                      >
                        <Text style={[s.chipTxt, active && { color: Colors.lime }]}>{chip.label}</Text>
                        {active && <Text style={s.chipNote}>{chip.note}</Text>}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* ── Greener alternatives ───────────────────────────── */}
              {result.suggestions?.length > 0 && (
                <View style={s.suggestionsBox}>
                  <Text style={s.suggestionsTitle}>Greener alternatives</Text>
                  {result.suggestions.map((sug, i) => (
                    <View key={i} style={s.suggestionRow}>
                      <Text style={s.suggestionDot}>🌿</Text>
                      <Text style={s.suggestionText}>{sug}</Text>
                    </View>
                  ))}
                </View>
              )}

              {/* ── Feedback / correction loop ─────────────────────── */}
              {!showCorrect ? (
                <TouchableOpacity style={s.correctBtn} onPress={() => setShowCorrect(true)}>
                  <Text style={s.correctBtnTxt}>✏️ Not quite right? Correct this</Text>
                </TouchableOpacity>
              ) : (
                <View style={s.correctForm}>
                  <Text style={s.correctFormLabel}>What is it actually?</Text>
                  <TextInput
                    style={s.correctInput}
                    placeholder="e.g. chai latte with oat milk, large size"
                    placeholderTextColor={Colors.tx3}
                    value={correctionText}
                    onChangeText={setCorrectionText}
                    autoFocus
                    returnKeyType="done"
                    onSubmitEditing={submitCorrection}
                  />
                  <View style={s.correctActions}>
                    <TouchableOpacity style={s.correctCancelBtn} onPress={() => { setShowCorrect(false); setCorrectionText(''); }}>
                      <Text style={s.correctCancelTxt}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[s.correctSubmitBtn, !correctionText.trim() && { opacity: 0.4 }]}
                      onPress={submitCorrection}
                      disabled={!correctionText.trim() || correcting}
                    >
                      {correcting
                        ? <ActivityIndicator color="#071810" size="small" />
                        : <Text style={s.correctSubmitTxt}>Recalculate →</Text>
                      }
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {/* ── Log button ─────────────────────────────────────── */}
              {!logged ? (
                <TouchableOpacity style={s.logBtn} onPress={logActivity} activeOpacity={0.85}>
                  <Text style={s.logBtnTxt}>Log {finalCo2.toFixed(2)} kg CO₂e ✓</Text>
                </TouchableOpacity>
              ) : (
                <View style={s.loggedBadge}>
                  <Text style={s.loggedTxt}>✓ Logged to Green Steps</Text>
                  <TouchableOpacity onPress={reset}>
                    <Text style={s.snapAnotherTxt}>Snap another →</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}

          {error && image && (
            <View style={s.errorBox}>
              <Text style={s.errorTxt}>{error}</Text>
              <TouchableOpacity onPress={() => imageBase64 && analyzeImage(imageBase64)} style={s.retryBtn}>
                <Text style={s.retryTxt}>Try again</Text>
              </TouchableOpacity>
            </View>
          )}

        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  phone: { width: 390, maxWidth: '100%', flex: 1, backgroundColor: Colors.bg, overflow: 'hidden' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12 },
  title: { fontFamily: Typography.heading, fontSize: 22, color: Colors.tx, letterSpacing: -0.5 },
  subtitle: { fontFamily: Typography.body, fontSize: 11, color: Colors.tx3, marginTop: 1 },
  resetBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, backgroundColor: 'rgba(200,244,90,0.08)', borderWidth: 0.5, borderColor: 'rgba(200,244,90,0.2)' },
  resetTxt: { fontFamily: Typography.headingBold, fontSize: 11, color: Colors.lime },
  captureRow: { flexDirection: 'row', gap: 10, marginBottom: 16, marginTop: 8 },
  captureBtn: { flex: 1, backgroundColor: 'rgba(200,244,90,0.06)', borderWidth: 0.5, borderColor: 'rgba(200,244,90,0.2)', borderRadius: 18, padding: 20, alignItems: 'center', gap: 6 },
  galleryBtn: { backgroundColor: 'rgba(45,212,191,0.06)', borderColor: 'rgba(45,212,191,0.2)' },
  captureBtnIcon: { fontSize: 28 },
  captureBtnTxt: { fontFamily: Typography.headingBold, fontSize: 13, color: Colors.tx },
  captureBtnSub: { fontFamily: Typography.body, fontSize: 10, color: Colors.tx3 },
  tipsSection: { backgroundColor: Colors.bg2, borderRadius: 16, borderWidth: 0.5, borderColor: Colors.border, padding: 14, gap: 10 },
  tipsTitle: { fontFamily: Typography.headingBold, fontSize: 9, color: Colors.tx3, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 },
  tipRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  tipIcon: { fontSize: 16, width: 24 },
  tipText: { fontFamily: Typography.body, fontSize: 12, color: Colors.tx2, flex: 1 },
  imageWrap: { borderRadius: 18, overflow: 'hidden', marginBottom: 14, position: 'relative' },
  previewImage: { width: '100%', height: 240, borderRadius: 18 },
  analyzingOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(7,24,16,0.85)', justifyContent: 'center', alignItems: 'center', gap: 12 },
  analyzingTxt: { fontFamily: Typography.headingBold, fontSize: 13, color: Colors.lime },
  resultCard: { borderRadius: 18, borderWidth: 0.5, padding: 16, gap: 12 },
  resultHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 },
  resultLabel: { fontFamily: Typography.heading, fontSize: 16, color: Colors.tx, flex: 1, letterSpacing: -0.3 },
  confidenceBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, borderWidth: 0.5, backgroundColor: 'rgba(255,255,255,0.03)' },
  confidenceTxt: { fontFamily: Typography.headingBold, fontSize: 9, textTransform: 'uppercase', letterSpacing: 0.5 },
  co2Row: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  co2Number: { fontFamily: Typography.heading, fontSize: 36, letterSpacing: -1 },
  co2Unit: { fontFamily: Typography.body, fontSize: 14, color: Colors.tx3 },
  impactBadge: { marginLeft: 'auto', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, borderWidth: 0.5 },
  impactLabel: { fontFamily: Typography.headingBold, fontSize: 10 },
  deltaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 10, padding: 8 },
  deltaBase: { fontFamily: Typography.body, fontSize: 10, color: Colors.tx3, flex: 1 },
  deltaAmt: { fontFamily: Typography.headingBold, fontSize: 10 },
  deltaTotal: { fontFamily: Typography.headingBold, fontSize: 12 },
  explanation: { fontFamily: Typography.body, fontSize: 13, color: Colors.tx2, lineHeight: 20 },
  contextSection: { gap: 8 },
  contextTitle: { fontFamily: Typography.headingBold, fontSize: 9, color: Colors.tx3, textTransform: 'uppercase', letterSpacing: 0.8 },
  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.1)' },
  chipTxt: { fontFamily: Typography.headingBold, fontSize: 11, color: Colors.tx3 },
  chipNote: { fontFamily: Typography.body, fontSize: 8, color: Colors.lime, marginTop: 2 },
  suggestionsBox: { backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 12, padding: 12, gap: 8 },
  suggestionsTitle: { fontFamily: Typography.headingBold, fontSize: 9, color: Colors.tx3, textTransform: 'uppercase', letterSpacing: 0.8 },
  suggestionRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  suggestionDot: { fontSize: 12, marginTop: 1 },
  suggestionText: { fontFamily: Typography.body, fontSize: 12, color: Colors.tx2, flex: 1, lineHeight: 18 },
  correctBtn: { paddingVertical: 10, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.1)', alignItems: 'center' },
  correctBtnTxt: { fontFamily: Typography.headingBold, fontSize: 12, color: Colors.tx3 },
  correctForm: { backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 14, padding: 12, gap: 8 },
  correctFormLabel: { fontFamily: Typography.headingBold, fontSize: 11, color: Colors.tx2 },
  correctInput: { backgroundColor: Colors.sf, borderWidth: 0.5, borderColor: Colors.border, borderRadius: 10, padding: 10, fontSize: 13, color: Colors.tx, fontFamily: Typography.body },
  correctActions: { flexDirection: 'row', gap: 8 },
  correctCancelBtn: { flex: 1, paddingVertical: 9, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 0.5, borderColor: Colors.border, alignItems: 'center' },
  correctCancelTxt: { fontFamily: Typography.headingBold, fontSize: 11, color: Colors.tx3 },
  correctSubmitBtn: { flex: 2, paddingVertical: 9, borderRadius: 10, backgroundColor: Colors.lime, alignItems: 'center' },
  correctSubmitTxt: { fontFamily: Typography.headingBold, fontSize: 11, color: '#071810' },
  logBtn: { backgroundColor: Colors.lime, borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  logBtnTxt: { fontFamily: Typography.headingBold, fontSize: 14, color: '#071810' },
  loggedBadge: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'rgba(200,244,90,0.08)', borderRadius: 12, padding: 12 },
  loggedTxt: { fontFamily: Typography.headingBold, fontSize: 12, color: Colors.lime },
  snapAnotherTxt: { fontFamily: Typography.headingBold, fontSize: 12, color: Colors.teal },
  errorBox: { backgroundColor: 'rgba(251,113,133,0.08)', borderRadius: 14, borderWidth: 0.5, borderColor: 'rgba(251,113,133,0.2)', padding: 14, gap: 10, marginTop: 10 },
  errorTxt: { fontFamily: Typography.body, fontSize: 13, color: '#FB7185', lineHeight: 20 },
  retryBtn: { alignSelf: 'flex-start', paddingHorizontal: 14, paddingVertical: 7, borderRadius: 10, backgroundColor: 'rgba(251,113,133,0.1)', borderWidth: 0.5, borderColor: 'rgba(251,113,133,0.2)' },
  retryTxt: { fontFamily: Typography.headingBold, fontSize: 11, color: '#FB7185' },
});
