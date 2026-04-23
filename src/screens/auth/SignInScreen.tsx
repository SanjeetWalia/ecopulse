import React, { useState, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  KeyboardAvoidingView, Platform, ActivityIndicator, Alert, StatusBar,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Colors, Typography, Spacing, Radius } from '../../constants/theme';
import { supabase } from '../../lib/supabase';

type Props = { navigation: NativeStackNavigationProp<any> };

export default function SignInScreen({ navigation }: Props) {
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [loading, setLoading] = useState(false);
  const otpRef = useRef<TextInput>(null);

  const formatPhone = (raw: string) => {
    const digits = raw.replace(/\D/g, '');
    return digits.startsWith('1') ? `+${digits}` : `+1${digits}`;
  };

  const handleSendOTP = async () => {
    if (!phone.trim()) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Enter your phone number');
      return;
    }
    setLoading(true);
    const formatted = formatPhone(phone.trim());
    const { error } = await supabase.auth.signInWithOtp({ phone: formatted });
    setLoading(false);
    if (error) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Error', error.message);
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setStep('otp');
      setTimeout(() => otpRef.current?.focus(), 300);
    }
  };

  const handleVerifyOTP = async () => {
    if (!otp.trim()) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Enter the code from your SMS');
      return;
    }
    setLoading(true);
    const formatted = formatPhone(phone.trim());
    const { error } = await supabase.auth.verifyOtp({ phone: formatted, token: otp.trim(), type: 'sms' });
    setLoading(false);
    if (error) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Invalid code', 'Please check the code and try again.');
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      // Auth state listener handles navigation
    }
  };

  return (
    <KeyboardAvoidingView style={s.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.bg} />
      <View style={s.content}>
        <TouchableOpacity style={s.backBtn} onPress={() => step === 'otp' ? setStep('phone') : navigation.goBack()}>
          <Text style={s.backIcon}>←</Text>
        </TouchableOpacity>

        <View style={s.header}>
          <Text style={s.emoji}>🌿</Text>
          <Text style={s.title}>Welcome back</Text>
          <Text style={s.subtitle}>
            {step === 'phone' ? 'Sign in to continue your green journey' : `We sent a code to ${formatPhone(phone)}`}
          </Text>
        </View>

        {step === 'phone' ? (
          <View style={s.form}>
            <View style={s.fieldWrap}>
              <Text style={s.fieldLabel}>Phone number</Text>
              <View style={s.phoneRow}>
                <View style={s.flagBox}>
                  <Text style={s.flagTxt}>🇺🇸 +1</Text>
                </View>
                <TextInput
                  style={[s.input, s.phoneInput]}
                  placeholder="(555) 000-0000"
                  placeholderTextColor={Colors.tx3}
                  value={phone}
                  onChangeText={setPhone}
                  keyboardType="phone-pad"
                  returnKeyType="done"
                  onSubmitEditing={handleSendOTP}
                  autoFocus
                />
              </View>
            </View>

            <TouchableOpacity style={s.submitBtn} onPress={handleSendOTP} disabled={loading} activeOpacity={0.85}>
              <LinearGradient colors={[Colors.lime, Colors.lime2 || Colors.lime]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.submitGradient}>
                {loading ? <ActivityIndicator color="#071810" /> : <Text style={s.submitText}>Send code →</Text>}
              </LinearGradient>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={s.form}>
            <View style={s.fieldWrap}>
              <Text style={s.fieldLabel}>Verification code</Text>
              <TextInput
                ref={otpRef}
                style={[s.input, s.otpInput]}
                placeholder="------"
                placeholderTextColor={Colors.tx3}
                value={otp}
                onChangeText={setOtp}
                keyboardType="number-pad"
                maxLength={6}
                returnKeyType="done"
                onSubmitEditing={handleVerifyOTP}
              />
              <TouchableOpacity onPress={handleSendOTP} style={{ marginTop: 8 }}>
                <Text style={s.resendTxt}>Resend code</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={s.submitBtn} onPress={handleVerifyOTP} disabled={loading} activeOpacity={0.85}>
              <LinearGradient colors={[Colors.lime, Colors.lime2 || Colors.lime]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.submitGradient}>
                {loading ? <ActivityIndicator color="#071810" /> : <Text style={s.submitText}>Verify & sign in</Text>}
              </LinearGradient>
            </TouchableOpacity>
          </View>
        )}

        <TouchableOpacity onPress={() => navigation.navigate('Phone')} style={s.signUpLink}>
          <Text style={s.signUpText}>
            Don't have an account?{' '}
            <Text style={s.signUpAccent}>Sign up free</Text>
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  content: { flex: 1, paddingHorizontal: Spacing.xxl, paddingTop: 60, gap: Spacing.xxl },
  backBtn: { marginBottom: Spacing.md },
  backIcon: { fontSize: 24, color: Colors.tx2 },
  header: { alignItems: 'center', gap: Spacing.sm },
  emoji: { fontSize: 40, marginBottom: Spacing.xs },
  title: { fontFamily: Typography.heading, fontSize: 28, color: Colors.tx, letterSpacing: -0.5 },
  subtitle: { fontFamily: Typography.body, fontSize: 14, color: Colors.tx2, textAlign: 'center' },
  form: { gap: Spacing.lg },
  fieldWrap: { gap: Spacing.xs },
  fieldLabel: { fontFamily: Typography.headingBold, fontSize: 11, color: Colors.tx3, textTransform: 'uppercase', letterSpacing: 0.8 },
  phoneRow: { flexDirection: 'row', gap: 8 },
  flagBox: { backgroundColor: Colors.sf, borderWidth: 0.5, borderColor: Colors.border, borderRadius: Radius.md, paddingHorizontal: 12, paddingVertical: 13, justifyContent: 'center' },
  flagTxt: { fontFamily: Typography.headingBold, fontSize: 13, color: Colors.tx2 },
  input: { backgroundColor: Colors.sf, borderWidth: 0.5, borderColor: Colors.border, borderRadius: Radius.md, paddingVertical: 13, paddingHorizontal: Spacing.md, fontSize: 15, color: Colors.tx, fontFamily: Typography.body },
  phoneInput: { flex: 1 },
  otpInput: { letterSpacing: 8, fontSize: 22, textAlign: 'center', fontFamily: Typography.heading },
  resendTxt: { fontFamily: Typography.headingBold, fontSize: 12, color: Colors.lime, textAlign: 'center' },
  submitBtn: { borderRadius: Radius.xl, overflow: 'hidden' },
  submitGradient: { paddingVertical: 16, alignItems: 'center' },
  submitText: { fontFamily: Typography.headingBold, fontSize: 16, color: '#071810' },
  signUpLink: { alignItems: 'center', paddingVertical: Spacing.md },
  signUpText: { fontFamily: Typography.body, fontSize: 14, color: Colors.tx3 },
  signUpAccent: { color: Colors.lime, fontFamily: Typography.headingBold },
});
