// src/screens/auth/SignInScreen.tsx
import React, { useState, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  KeyboardAvoidingView, Platform, ActivityIndicator, Alert, StatusBar,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Colors, Typography, Spacing, Radius } from '../../constants/theme';
import { signInWithEmail } from '../../lib/supabase';

type Props = { navigation: NativeStackNavigationProp<any> };

export default function SignInScreen({ navigation }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const passwordRef = useRef<TextInput>(null);

  const handleSignIn = async () => {
    if (!email || !password) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Missing fields', 'Please enter your email and password.');
      return;
    }
    setLoading(true);
    const { error } = await signInWithEmail(email.trim(), password);
    setLoading(false);

    if (error) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Sign in failed', error.message === 'Invalid login credentials'
        ? 'Incorrect email or password. Try again.'
        : error.message
      );
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      // Navigation handled by auth state listener in App.tsx
    }
  };

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
          <Text style={styles.emoji}>🌿</Text>
          <Text style={styles.title}>Welcome back</Text>
          <Text style={styles.subtitle}>Sign in to continue your green journey</Text>
        </View>

        <View style={styles.form}>
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
              returnKeyType="next"
              onSubmitEditing={() => passwordRef.current?.focus()}
            />
          </View>

          <View style={styles.fieldWrap}>
            <View style={styles.fieldLabelRow}>
              <Text style={styles.fieldLabel}>Password</Text>
              <TouchableOpacity onPress={() => navigation.navigate('ForgotPassword')}>
                <Text style={styles.forgotText}>Forgot?</Text>
              </TouchableOpacity>
            </View>
            <TextInput
              ref={passwordRef}
              style={styles.input}
              placeholder="Your password"
              placeholderTextColor={Colors.tx3}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              returnKeyType="done"
              onSubmitEditing={handleSignIn}
            />
          </View>
        </View>

        <TouchableOpacity
          style={styles.submitBtn}
          onPress={handleSignIn}
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
              : <Text style={styles.submitText}>Sign in</Text>
            }
          </LinearGradient>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => navigation.navigate('SignUp')} style={styles.signUpLink}>
          <Text style={styles.signUpText}>
            Don't have an account?{' '}
            <Text style={styles.signUpAccent}>Sign up free</Text>
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
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
  fieldLabelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  fieldLabel: { fontFamily: Typography.headingMedium, fontSize: 11, color: Colors.tx3, textTransform: 'uppercase', letterSpacing: 0.8 },
  forgotText: { fontFamily: Typography.headingBold, fontSize: 12, color: Colors.lime },
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
  signUpLink: { alignItems: 'center', paddingVertical: Spacing.md },
  signUpText: { fontFamily: Typography.body, fontSize: 14, color: Colors.tx3 },
  signUpAccent: { color: Colors.lime, fontFamily: Typography.headingBold },
});
