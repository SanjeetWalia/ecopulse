import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Dimensions, Animated, StatusBar, TextInput,
  ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Typography, Spacing, Radius } from '../../constants/theme';
import { supabase } from '../../lib/supabase';

const { width } = Dimensions.get('window');

export default function WelcomeScreen({ navigation }: any) {
  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(40)).current;

  // Code entry state
  const [showCodeEntry, setShowCodeEntry] = useState(false);
  const [code,          setCode]          = useState('');
  const [error,         setError]         = useState('');
  const [loading,       setLoading]       = useState(false);

  // Modal animation
  const modalFade  = useRef(new Animated.Value(0)).current;
  const modalSlide = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 1, duration: 900, useNativeDriver: false }),
      Animated.timing(slideAnim, { toValue: 0, duration: 700, useNativeDriver: false }),
    ]).start();
  }, []);

  function openCodeEntry() {
    setShowCodeEntry(true);
    setError('');
    setCode('');
    Animated.parallel([
      Animated.timing(modalFade,  { toValue: 1, duration: 280, useNativeDriver: false }),
      Animated.timing(modalSlide, { toValue: 0, duration: 280, useNativeDriver: false }),
    ]).start();
  }

  function closeCodeEntry() {
    Animated.parallel([
      Animated.timing(modalFade,  { toValue: 0, duration: 200, useNativeDriver: false }),
      Animated.timing(modalSlide, { toValue: 30, duration: 200, useNativeDriver: false }),
    ]).start(() => {
      setShowCodeEntry(false);
      setCode('');
      setError('');
    });
  }

  async function validateAndProceed() {
    const trimmed = code.trim().toUpperCase();

    if (!trimmed) {
      setError('Enter your invite code to continue.');
      return;
    }
    if (trimmed.length < 6) {
      setError('Invite codes are at least 6 characters.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const { data, error: fetchError } = await supabase
        .from('invite_codes')
        .select('id, code, status, uses')
        .eq('code', trimmed)
        .single();

      if (fetchError || !data) {
        setError("That code doesn't exist. Check your invite and try again.");
        setLoading(false);
        return;
      }

      if (data.status === 'used') {
        setError('This code has already been used. Each code is single-use.');
        setLoading(false);
        return;
      }

      // Valid — pass code forward to Phone screen
      navigation.navigate('Phone', { inviteCode: trimmed, inviteCodeId: data.id });

    } catch (e) {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor={Colors.bg} />
        <View style={styles.glowTop} />
        <View style={styles.glowBottom} />

        <Animated.View style={[styles.content, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>

          {/* Logo */}
          <View style={styles.logoWrap}>
            <View style={styles.logoIcon}>
              <Text style={styles.logoEmoji}>🌿</Text>
            </View>
            <Text style={styles.wordmark}>eco<Text style={styles.wordmarkAccent}>pulse</Text></Text>
            <Text style={styles.tagline}>Track your carbon. Challenge friends.</Text>
          </View>

          {/* Feature pills */}
          <View style={styles.features}>
            {[
              { icon: '📊', label: 'Auto-track your daily CO₂e' },
              { icon: '👥', label: 'Compete on a green leaderboard' },
              { icon: '🌱', label: 'Gift plants for hitting goals' },
              { icon: '🔑', label: 'Private beta — invite only' },
            ].map((f, i) => (
              <View key={i} style={styles.featurePill}>
                <Text style={styles.featureIcon}>{f.icon}</Text>
                <Text style={styles.featureLabel}>{f.label}</Text>
              </View>
            ))}
          </View>

          {/* ── CODE ENTRY ── */}
          {showCodeEntry ? (
            <Animated.View style={[
              styles.codeBox,
              { opacity: modalFade, transform: [{ translateY: modalSlide }] }
            ]}>
              <Text style={styles.codeBoxTitle}>Enter your EcoKey</Text>
              <Text style={styles.codeBoxSub}>
                Eco Pulse is invite-only. Enter the code from your invite email.
              </Text>

              <TextInput
                style={[styles.codeInput, error ? styles.codeInputError : null]}
                value={code}
                onChangeText={t => { setCode(t.toUpperCase()); setError(''); }}
                placeholder="e.g. A9E5E1E1"
                placeholderTextColor={Colors.tx3}
                autoCapitalize="characters"
                autoCorrect={false}
                autoFocus
                maxLength={16}
                returnKeyType="go"
                onSubmitEditing={validateAndProceed}
              />

              {!!error && <Text style={styles.codeError}>{error}</Text>}

              <TouchableOpacity
                onPress={validateAndProceed}
                activeOpacity={0.85}
                style={styles.primaryBtn}
                disabled={loading}
              >
                <LinearGradient
                  colors={[Colors.lime, Colors.lime2]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.primaryBtnGradient}
                  pointerEvents="none"
                >
                  {loading
                    ? <ActivityIndicator color="#071810" size="small" />
                    : <Text style={styles.primaryBtnText}>Validate code →</Text>
                  }
                </LinearGradient>
              </TouchableOpacity>

              <TouchableOpacity onPress={closeCodeEntry} style={styles.cancelBtn}>
                <Text style={styles.cancelBtnText}>← Back</Text>
              </TouchableOpacity>

              <Text style={styles.codeHint}>
                {"Don't have a code? "}
                <Text style={styles.codeHintLink}>
                  Join the waitlist at tryecopulse.com/quiz
                </Text>
              </Text>
            </Animated.View>

          ) : (
            <View style={styles.buttons}>
              <TouchableOpacity
                onPress={openCodeEntry}
                activeOpacity={0.85}
                style={styles.primaryBtn}
              >
                <LinearGradient
                  colors={[Colors.lime, Colors.lime2]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.primaryBtnGradient}
                  pointerEvents="none"
                >
                  <Text style={styles.primaryBtnText}>Enter invite code →</Text>
                </LinearGradient>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => navigation.navigate('SignIn')}
                activeOpacity={0.75}
                style={styles.secondaryBtn}
              >
                <Text style={styles.secondaryBtnText}>
                  Already have an account?{' '}
                  <Text style={styles.secondaryBtnAccent}>Sign in</Text>
                </Text>
              </TouchableOpacity>
            </View>
          )}

          <Text style={styles.legal}>By continuing you agree to our Terms & Privacy Policy</Text>
        </Animated.View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container:          { flex: 1, backgroundColor: Colors.bg, justifyContent: 'center', alignItems: 'center' },
  glowTop:            { position: 'absolute', top: -100, left: width / 2 - 150, width: 300, height: 300, borderRadius: 150, backgroundColor: 'rgba(200,244,90,0.06)' },
  glowBottom:         { position: 'absolute', bottom: -80, right: -60, width: 200, height: 200, borderRadius: 100, backgroundColor: 'rgba(45,212,191,0.05)' },
  content:            { flex: 1, width: '100%', paddingHorizontal: Spacing.xxl, justifyContent: 'center', gap: Spacing.xxxl },
  logoWrap:           { alignItems: 'center', gap: Spacing.md },
  logoIcon:           { width: 72, height: 72, borderRadius: 22, backgroundColor: Colors.bg3, borderWidth: 1, borderColor: Colors.border2, justifyContent: 'center', alignItems: 'center', marginBottom: Spacing.sm },
  logoEmoji:          { fontSize: 36 },
  wordmark:           { fontFamily: Typography.heading, fontSize: 36, color: Colors.tx, letterSpacing: -1 },
  wordmarkAccent:     { color: Colors.lime },
  tagline:            { fontFamily: Typography.body, fontSize: 15, color: Colors.tx2, textAlign: 'center' },
  features:           { gap: Spacing.sm },
  featurePill:        { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, backgroundColor: Colors.bg2, borderWidth: 0.5, borderColor: Colors.border, borderRadius: Radius.lg, paddingVertical: Spacing.md, paddingHorizontal: Spacing.lg },
  featureIcon:        { fontSize: 18 },
  featureLabel:       { fontFamily: Typography.bodyMedium, fontSize: 14, color: Colors.tx2 },

  // Code box
  codeBox:            { gap: Spacing.md, backgroundColor: Colors.bg2, borderWidth: 1, borderColor: 'rgba(200,244,90,0.15)', borderRadius: Radius.xl, padding: Spacing.xl },
  codeBoxTitle:       { fontFamily: Typography.heading, fontSize: 22, color: Colors.tx, letterSpacing: -0.5 },
  codeBoxSub:         { fontFamily: Typography.body, fontSize: 14, color: Colors.tx2, lineHeight: 20 },
  codeInput:          { fontFamily: Typography.headingBold, fontSize: 22, color: Colors.lime, letterSpacing: 6, borderBottomWidth: 1, borderBottomColor: 'rgba(200,244,90,0.3)', paddingVertical: Spacing.md, textAlign: 'center' },
  codeInputError:     { borderBottomColor: 'rgba(251,113,133,0.6)' },
  codeError:          { fontFamily: Typography.body, fontSize: 12, color: '#FB7185', textAlign: 'center' },
  cancelBtn:          { paddingVertical: Spacing.sm, alignItems: 'center' },
  cancelBtnText:      { fontFamily: Typography.body, fontSize: 13, color: Colors.tx3 },
  codeHint:           { fontFamily: Typography.body, fontSize: 12, color: Colors.tx3, textAlign: 'center' },
  codeHintLink:       { color: Colors.lime, fontFamily: Typography.bodyMedium },

  // Buttons
  buttons:            { gap: Spacing.md },
  primaryBtn:         { borderRadius: Radius.xl, overflow: 'hidden' },
  primaryBtnGradient: { paddingVertical: 16, alignItems: 'center', borderRadius: Radius.xl },
  primaryBtnText:     { fontFamily: Typography.headingBold, fontSize: 16, color: '#071810' },
  secondaryBtn:       { paddingVertical: Spacing.md, alignItems: 'center' },
  secondaryBtnText:   { fontFamily: Typography.body, fontSize: 14, color: Colors.tx3 },
  secondaryBtnAccent: { color: Colors.lime, fontFamily: Typography.headingBold },
  legal:              { fontFamily: Typography.body, fontSize: 11, color: Colors.tx3, textAlign: 'center' },
});
