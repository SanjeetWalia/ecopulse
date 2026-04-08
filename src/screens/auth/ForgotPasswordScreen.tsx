// src/screens/auth/ForgotPasswordScreen.tsx
import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  TextInput, ActivityIndicator, Alert, StatusBar,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Colors, Typography, Spacing, Radius } from '../../constants/theme';
import { resetPassword } from '../../lib/supabase';

type Props = { navigation: NativeStackNavigationProp<any> };

export default function ForgotPasswordScreen({ navigation }: Props) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleReset = async () => {
    if (!email.trim()) {
      Alert.alert('Enter your email', 'We need your email to send a reset link.');
      return;
    }
    setLoading(true);
    const { error } = await resetPassword(email.trim());
    setLoading(false);

    if (error) {
      Alert.alert('Error', error.message);
    } else {
      setSent(true);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.bg} />
      <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
        <Text style={styles.backIcon}>←</Text>
      </TouchableOpacity>

      {sent ? (
        <View style={styles.sentWrap}>
          <Text style={styles.sentEmoji}>📬</Text>
          <Text style={styles.sentTitle}>Check your inbox</Text>
          <Text style={styles.sentSub}>
            We sent a password reset link to{'\n'}
            <Text style={styles.sentEmail}>{email}</Text>
          </Text>
          <TouchableOpacity
            style={styles.backToSignIn}
            onPress={() => navigation.navigate('SignIn')}
          >
            <Text style={styles.backToSignInText}>Back to sign in</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.content}>
          <View style={styles.header}>
            <Text style={styles.emoji}>🔑</Text>
            <Text style={styles.title}>Reset password</Text>
            <Text style={styles.subtitle}>
              Enter your email and we'll send you a link to create a new password
            </Text>
          </View>

          <View style={styles.fieldWrap}>
            <Text style={styles.fieldLabel}>Email</Text>
            <TextInput
              style={styles.input}
              placeholder="you@example.com"
              placeholderTextColor={Colors.tx3}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              returnKeyType="done"
              onSubmitEditing={handleReset}
            />
          </View>

          <TouchableOpacity
            style={styles.submitBtn}
            onPress={handleReset}
            disabled={loading}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={[Colors.lime, Colors.lime2]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.submitGradient}
            >
              {loading
                ? <ActivityIndicator color="#071810" />
                : <Text style={styles.submitText}>Send reset link</Text>
              }
            </LinearGradient>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg, paddingHorizontal: Spacing.xxl, paddingTop: 60 },
  backBtn: { marginBottom: Spacing.xxl },
  backIcon: { fontSize: 24, color: Colors.tx2 },
  content: { gap: Spacing.xxl },
  header: { alignItems: 'center', gap: Spacing.sm },
  emoji: { fontSize: 40, marginBottom: Spacing.xs },
  title: { fontFamily: Typography.heading, fontSize: 26, color: Colors.tx, letterSpacing: -0.5 },
  subtitle: { fontFamily: Typography.body, fontSize: 14, color: Colors.tx2, textAlign: 'center', lineHeight: 22 },
  fieldWrap: { gap: Spacing.xs },
  fieldLabel: { fontFamily: Typography.headingMedium, fontSize: 11, color: Colors.tx3, textTransform: 'uppercase', letterSpacing: 0.8 },
  input: {
    backgroundColor: Colors.sf,
    borderWidth: 0.5,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingVertical: 13,
    paddingHorizontal: Spacing.md,
    fontSize: 15,
    color: Colors.tx,
    fontFamily: Typography.body,
  },
  submitBtn: { borderRadius: Radius.xl, overflow: 'hidden' },
  submitGradient: { paddingVertical: 16, alignItems: 'center' },
  submitText: { fontFamily: Typography.headingBold, fontSize: 16, color: '#071810' },
  sentWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: Spacing.lg },
  sentEmoji: { fontSize: 56 },
  sentTitle: { fontFamily: Typography.heading, fontSize: 26, color: Colors.tx },
  sentSub: { fontFamily: Typography.body, fontSize: 14, color: Colors.tx2, textAlign: 'center', lineHeight: 24 },
  sentEmail: { color: Colors.lime, fontFamily: Typography.headingBold },
  backToSignIn: { marginTop: Spacing.lg, paddingVertical: Spacing.md, paddingHorizontal: Spacing.xxl, backgroundColor: Colors.sf, borderRadius: Radius.full, borderWidth: 0.5, borderColor: Colors.border },
  backToSignInText: { fontFamily: Typography.headingBold, fontSize: 14, color: Colors.tx2 },
});
