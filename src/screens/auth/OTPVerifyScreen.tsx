import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  KeyboardAvoidingView, Platform, ActivityIndicator, Alert, StatusBar
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Typography, Spacing, Radius } from '../../constants/theme';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../lib/authStore';

export default function OTPVerifyScreen({ navigation, route }: any) {
  const { phone, displayPhone, inviteCode, inviteCodeId } = route.params;
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [resendTimer, setResendTimer] = useState(30);
  const inputRefs = useRef<(TextInput | null)[]>([]);
  const { setProfile } = useAuthStore();

  useEffect(() => {
    if (resendTimer > 0) {
      const t = setTimeout(() => setResendTimer(n => n - 1), 1000);
      return () => clearTimeout(t);
    }
  }, [resendTimer]);

  const handleCodeChange = (text: string, index: number) => {
    const digit = text.replace(/\D/g, '').slice(-1);
    const newCode = [...code];
    newCode[index] = digit;
    setCode(newCode);
    if (digit && index < 5) inputRefs.current[index + 1]?.focus();
    if (digit && index === 5) {
      const full = newCode.join('');
      if (full.length === 6) verifyOTP(full);
    }
  };

  const handleKeyPress = (e: any, index: number) => {
    if (e.nativeEvent.key === 'Backspace' && !code[index] && index > 0)
      inputRefs.current[index - 1]?.focus();
  };

  // Mark the invite code as used after successful auth
  async function redeemInviteCode(userId: string) {
    if (!inviteCodeId) return; // existing users re-signing in have no code

    try {
      await supabase
        .from('invite_codes')
        .update({
          status:  'used',
          used_by: userId,
          uses:    1,
        })
        .eq('id', inviteCodeId)
        .eq('status', 'unused'); // safety: only update if still unused
    } catch (e) {
      // Non-fatal — user is already in, don't block them
      console.warn('Could not mark invite code as used:', e);
    }
  }

  const verifyOTP = async (otpCode: string) => {
    setLoading(true);
    const { data, error } = await supabase.auth.verifyOtp({
      phone,
      token: otpCode,
      type: 'sms',
    });
    setLoading(false);

    if (error) {
      Alert.alert('Invalid code', 'The code is incorrect or expired. Try again.');
      setCode(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
      return;
    }

    if (data.user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('username, full_name')
        .eq('id', data.user.id)
        .single();

      if (!profile?.username) {
        // New user — redeem the invite code, then go to profile setup
        await redeemInviteCode(data.user.id);

        setProfile({
          id: data.user.id,
          username: '',
          full_name: '',
          avatar_url: null,
          location: 'Frisco, TX',
          streak_count: 0,
          total_co2_saved: 0,
        });
        navigation.navigate('ProfileSetup');
      }
      // Existing user — auth state listener handles navigation to main app
      // No code redemption needed for returning users
    }
  };

  const fullCode = code.join('');

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <StatusBar barStyle="light-content" backgroundColor={Colors.bg} />
      <View style={styles.content}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>

        <View style={styles.header}>
          <Text style={styles.emoji}>💬</Text>
          <Text style={styles.title}>Check your texts</Text>
          <Text style={styles.subtitle}>
            We sent a 6-digit code to{'\n'}
            <Text style={styles.phoneHighlight}>{displayPhone}</Text>
          </Text>
          {/* Show invite code confirmation so user knows their key was accepted */}
          {inviteCode ? (
            <View style={styles.codeConfirm}>
              <Text style={styles.codeConfirmText}>
                🔑 EcoKey <Text style={styles.codeConfirmCode}>{inviteCode}</Text> accepted
              </Text>
            </View>
          ) : null}
        </View>

        <View style={styles.otpRow}>
          {code.map((digit, i) => (
            <TextInput
              key={i}
              ref={ref => { inputRefs.current[i] = ref; }}
              style={[styles.otpBox, digit ? styles.otpBoxFilled : null]}
              value={digit}
              onChangeText={(t) => handleCodeChange(t, i)}
              onKeyPress={(e) => handleKeyPress(e, i)}
              keyboardType="number-pad"
              maxLength={1}
              autoFocus={i === 0}
              selectTextOnFocus
            />
          ))}
        </View>

        <View style={styles.resendRow}>
          {resendTimer > 0
            ? <Text style={styles.resendTimer}>
                Resend in <Text style={styles.resendAccent}>{resendTimer}s</Text>
              </Text>
            : <TouchableOpacity onPress={async () => {
                await supabase.auth.signInWithOtp({ phone });
                setResendTimer(30);
                setCode(['', '', '', '', '', '']);
              }}>
                <Text style={styles.resendBtn}>Resend code</Text>
              </TouchableOpacity>
          }
        </View>

        <TouchableOpacity
          style={[styles.verifyBtn, fullCode.length < 6 && styles.verifyBtnDisabled]}
          onPress={() => verifyOTP(fullCode)}
          disabled={loading || fullCode.length < 6}
          activeOpacity={0.85}
        >
          <LinearGradient
            colors={fullCode.length === 6 ? [Colors.lime, Colors.lime2] : [Colors.sf, Colors.sf]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.verifyGradient}
          >
            {loading
              ? <ActivityIndicator color={fullCode.length === 6 ? '#071810' : Colors.tx3} />
              : <Text style={[styles.verifyText, fullCode.length < 6 && styles.verifyTextDisabled]}>
                  Verify ✓
                </Text>
            }
          </LinearGradient>
        </TouchableOpacity>

        <Text style={styles.hint}>
          Wrong number?{' '}
          <Text style={styles.changeNumber} onPress={() => navigation.goBack()}>
            Change it
          </Text>
        </Text>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container:           { flex: 1, backgroundColor: Colors.bg },
  content:             { flex: 1, paddingHorizontal: Spacing.xxl, paddingTop: 60 },
  backBtn:             { marginBottom: Spacing.xxl },
  backIcon:            { fontSize: 24, color: Colors.tx2 },
  header:              { alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.xxxl },
  emoji:               { fontSize: 48, marginBottom: Spacing.sm },
  title:               { fontFamily: Typography.heading, fontSize: 28, color: Colors.tx, letterSpacing: -0.5 },
  subtitle:            { fontFamily: Typography.body, fontSize: 15, color: Colors.tx2, textAlign: 'center', lineHeight: 24 },
  phoneHighlight:      { color: Colors.lime, fontFamily: Typography.headingBold },

  // EcoKey confirmation badge
  codeConfirm:         { marginTop: Spacing.sm, backgroundColor: 'rgba(200,244,90,0.08)', borderWidth: 1, borderColor: 'rgba(200,244,90,0.2)', borderRadius: Radius.md, paddingVertical: 6, paddingHorizontal: 14 },
  codeConfirmText:     { fontFamily: Typography.body, fontSize: 12, color: Colors.tx2 },
  codeConfirmCode:     { fontFamily: Typography.headingBold, color: Colors.lime, letterSpacing: 2 },

  otpRow:              { flexDirection: 'row', justifyContent: 'center', gap: Spacing.sm, marginBottom: Spacing.xxl },
  otpBox:              { width: 48, height: 58, backgroundColor: Colors.sf, borderWidth: 1.5, borderColor: Colors.border, borderRadius: Radius.md, fontSize: 24, color: Colors.tx, textAlign: 'center', fontFamily: Typography.heading },
  otpBoxFilled:        { borderColor: Colors.lime, backgroundColor: 'rgba(200,244,90,0.08)' },
  resendRow:           { alignItems: 'center', marginBottom: Spacing.xxxl },
  resendTimer:         { fontFamily: Typography.body, fontSize: 14, color: Colors.tx3 },
  resendAccent:        { color: Colors.lime, fontFamily: Typography.headingBold },
  resendBtn:           { fontFamily: Typography.headingBold, fontSize: 14, color: Colors.lime, textDecorationLine: 'underline' },
  verifyBtn:           { borderRadius: Radius.xl, overflow: 'hidden', marginBottom: Spacing.lg },
  verifyBtnDisabled:   { opacity: 0.6 },
  verifyGradient:      { paddingVertical: 16, alignItems: 'center' },
  verifyText:          { fontFamily: Typography.headingBold, fontSize: 16, color: '#071810' },
  verifyTextDisabled:  { color: Colors.tx3 },
  hint:                { fontFamily: Typography.body, fontSize: 13, color: Colors.tx3, textAlign: 'center' },
  changeNumber:        { color: Colors.lime, fontFamily: Typography.headingBold, textDecorationLine: 'underline' },
});
