import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, KeyboardAvoidingView, Platform, ActivityIndicator, Alert, StatusBar, ScrollView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Typography, Spacing, Radius } from '../../constants/theme';
import { supabase } from '../../lib/supabase';

export default function PhoneScreen({ navigation, route }: any) {
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);

  // Pass-through from WelcomeScreen via EcoKey validation
  const inviteCode   = route.params?.inviteCode;
  const inviteCodeId = route.params?.inviteCodeId;

  const formatPhone = (text: string) => {
    const digits = text.replace(/\D/g, '');
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return `(${digits.slice(0,3)}) ${digits.slice(3)}`;
    return `(${digits.slice(0,3)}) ${digits.slice(3,6)}-${digits.slice(6,10)}`;
  };

  const handleSendOTP = async () => {
    const digits = phone.replace(/\D/g, '');
    if (digits.length < 10) {
      Alert.alert('Invalid number', 'Please enter a valid 10-digit phone number.');
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signInWithOtp({ phone: `+1${digits}` });
    setLoading(false);
    if (error) {
      Alert.alert('Error', error.message);
    } else {
      navigation.navigate('OTPVerify', {
        phone:        `+1${digits}`,
        displayPhone: `+1 ${phone}`,
        inviteCode,    // ← pass through from WelcomeScreen
        inviteCodeId,  // ← pass through from WelcomeScreen
      });
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.bg} />
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>

        <View style={styles.header}>
          <Text style={styles.emoji}>📱</Text>
          <Text style={styles.title}>What's your number?</Text>
          <Text style={styles.subtitle}>We'll send a 6-digit code to verify it's you. No password needed.</Text>
          {/* Show invite code badge so user knows their key is still active */}
          {inviteCode ? (
            <View style={styles.codeConfirm}>
              <Text style={styles.codeConfirmText}>
                🔑 EcoKey <Text style={styles.codeConfirmCode}>{inviteCode}</Text> ready
              </Text>
            </View>
          ) : null}
        </View>

        <View style={styles.inputWrap}>
          <Text style={styles.countryCode}>🇺🇸 +1</Text>
          <TextInput
            style={styles.phoneInput}
            placeholder="(555) 000-0000"
            placeholderTextColor={Colors.tx3}
            value={phone}
            onChangeText={(t) => setPhone(formatPhone(t))}
            keyboardType="phone-pad"
            maxLength={14}
            autoFocus
            returnKeyType="done"
            onSubmitEditing={handleSendOTP}
          />
        </View>

        <Text style={styles.hint}>Standard message rates may apply.</Text>

        <TouchableOpacity
          style={styles.sendBtn}
          onPress={handleSendOTP}
          disabled={loading}
          activeOpacity={0.85}
        >
          <LinearGradient
            colors={[Colors.lime, Colors.lime2]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.sendGradient}
          >
            {loading
              ? <ActivityIndicator color="#071810" />
              : <Text style={styles.sendText}>Send code →</Text>
            }
          </LinearGradient>
        </TouchableOpacity>

        <TouchableOpacity style={styles.emailFallback} onPress={() => navigation.navigate('SignIn')}>
          <Text style={styles.emailFallbackText}>Use email instead</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container:        { flex: 1, backgroundColor: Colors.bg },
  scroll:           { flexGrow: 1, paddingHorizontal: Spacing.xxl, paddingTop: 60, paddingBottom: Spacing.xxxl },
  backBtn:          { marginBottom: Spacing.xxl },
  backIcon:         { fontSize: 24, color: Colors.tx2 },
  header:           { alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.xxxl },
  emoji:            { fontSize: 48, marginBottom: Spacing.sm },
  title:            { fontFamily: Typography.heading, fontSize: 28, color: Colors.tx, letterSpacing: -0.5, textAlign: 'center' },
  subtitle:         { fontFamily: Typography.body, fontSize: 15, color: Colors.tx2, textAlign: 'center', lineHeight: 24 },
  codeConfirm:      { marginTop: Spacing.sm, backgroundColor: 'rgba(200,244,90,0.08)', borderWidth: 1, borderColor: 'rgba(200,244,90,0.2)', borderRadius: Radius.md, paddingVertical: 6, paddingHorizontal: 14 },
  codeConfirmText:  { fontFamily: Typography.body, fontSize: 12, color: Colors.tx2 },
  codeConfirmCode:  { fontFamily: Typography.headingBold, color: Colors.lime, letterSpacing: 2 },
  inputWrap:        { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.sf, borderWidth: 0.5, borderColor: Colors.border2, borderRadius: Radius.lg, marginBottom: Spacing.md, paddingHorizontal: Spacing.md },
  countryCode:      { fontFamily: Typography.headingBold, fontSize: 15, color: Colors.tx2, marginRight: Spacing.sm, paddingVertical: 14 },
  phoneInput:       { flex: 1, paddingVertical: 14, fontSize: 18, color: Colors.tx, fontFamily: Typography.body, letterSpacing: 1 },
  hint:             { fontFamily: Typography.body, fontSize: 12, color: Colors.tx3, textAlign: 'center', marginBottom: Spacing.xxxl },
  sendBtn:          { borderRadius: Radius.xl, overflow: 'hidden', marginBottom: Spacing.lg },
  sendGradient:     { paddingVertical: 16, alignItems: 'center' },
  sendText:         { fontFamily: Typography.headingBold, fontSize: 16, color: '#071810' },
  emailFallback:    { alignItems: 'center', paddingVertical: Spacing.md },
  emailFallbackText:{ fontFamily: Typography.body, fontSize: 14, color: Colors.tx3, textDecorationLine: 'underline' },
});
