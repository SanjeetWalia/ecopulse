// src/screens/auth/SignUpScreen.tsx
//
// Email + password account creation, reached from the post-invite-code flow.
// This is the path Apple Beta App Review needs: reviewers cannot receive an
// SMS OTP, so phone-only signup made external review impossible (OBS-012).
//
// The invite code is stashed locally rather than redeemed here, because
// Supabase may withhold the session until the email is confirmed. See
// src/lib/invite.ts.
import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  StatusBar,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Colors, Typography, Spacing, Radius } from '../../constants/theme';
import { signUpWithEmail } from '../../lib/supabase';
import { stashPendingInvite, redeemInvite } from '../../lib/invite';

type Props = {
  navigation: NativeStackNavigationProp<any>;
  route?: any;
};

export default function SignUpScreen({ navigation, route }: Props) {
  const inviteCode   = route?.params?.inviteCode;
  const inviteCodeId = route?.params?.inviteCodeId;
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const usernameRef = useRef<TextInput>(null);
  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);

  const validate = () => {
    const e: Record<string, string> = {};
    if (!fullName.trim()) e.fullName = 'Name is required';
    if (!username.trim()) e.username = 'Username is required';
    else if (username.length < 3) e.username = 'At least 3 characters';
    else if (!/^[a-z0-9_]+$/.test(username)) e.username = 'Letters, numbers, underscores only';
    if (!email.trim()) e.email = 'Email is required';
    else if (!/\S+@\S+\.\S+/.test(email)) e.email = 'Enter a valid email';
    if (!password) e.password = 'Password is required';
    else if (password.length < 8) e.password = 'At least 8 characters';
    return e;
  };

  const handleSignUp = async () => {
    const e = validate();
    if (Object.keys(e).length > 0) {
      setErrors(e);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    setErrors({});
    setLoading(true);

    // Stash before the network call: if the app is killed mid-confirmation,
    // the code is still redeemed on the next authenticated launch.
    if (inviteCodeId) {
      await stashPendingInvite({ id: inviteCodeId, code: inviteCode ?? '' });
    }

    const { data, error } = await signUpWithEmail(email, password, fullName, username.toLowerCase());

    setLoading(false);

    if (error) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Sign up failed', error.message);
      return;
    }

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    if (data?.session) {
      // Email confirmation is off — we already have a session. Redeem now;
      // the auth listener in authStore moves the user into the app.
      await redeemInvite(inviteCodeId);
      return;
    }

    Alert.alert(
      'Check your email',
      `We sent a confirmation link to ${email}. Open it, then sign in with this email and password.`,
      [{ text: 'Got it', onPress: () => navigation.navigate('SignIn') }]
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <StatusBar barStyle="light-content" backgroundColor={Colors.bg} />
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>

        <View style={styles.header}>
          <Text style={styles.title}>Join Eco Pulse</Text>
          <Text style={styles.subtitle}>
            Create your account with an email and password. You can sign in on
            any device with these.
          </Text>
          {inviteCode ? (
            <View style={styles.codeConfirm}>
              <Text style={styles.codeConfirmText}>
                🔑 EcoKey <Text style={styles.codeConfirmCode}>{inviteCode}</Text> ready
              </Text>
            </View>
          ) : null}
        </View>

        {/* Form */}
        <View style={styles.form}>
          <InputField
            label="Full name"
            placeholder="Jordan Park"
            value={fullName}
            onChangeText={setFullName}
            error={errors.fullName}
            returnKeyType="next"
            onSubmitEditing={() => usernameRef.current?.focus()}
            autoCapitalize="words"
          />
          <InputField
            ref={usernameRef}
            label="Username"
            placeholder="jordanpark"
            value={username}
            onChangeText={(t) => setUsername(t.toLowerCase().replace(/\s/g, ''))}
            error={errors.username}
            prefix="@"
            returnKeyType="next"
            onSubmitEditing={() => emailRef.current?.focus()}
            autoCapitalize="none"
          />
          <InputField
            ref={emailRef}
            label="Email"
            placeholder="you@example.com"
            value={email}
            onChangeText={setEmail}
            error={errors.email}
            keyboardType="email-address"
            returnKeyType="next"
            onSubmitEditing={() => passwordRef.current?.focus()}
            autoCapitalize="none"
          />
          <InputField
            ref={passwordRef}
            label="Password"
            placeholder="8+ characters"
            value={password}
            onChangeText={setPassword}
            error={errors.password}
            secureTextEntry
            returnKeyType="done"
            onSubmitEditing={handleSignUp}
          />
        </View>

        {/* Submit */}
        <TouchableOpacity
          style={styles.submitBtn}
          onPress={handleSignUp}
          disabled={loading}
          activeOpacity={0.85}
        >
          <LinearGradient
            colors={[Colors.lime, Colors.lime2]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.submitGradient}
          >
            {loading ? (
              <ActivityIndicator color="#071810" />
            ) : (
              <Text style={styles.submitText}>Create account →</Text>
            )}
          </LinearGradient>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => navigation.navigate('SignIn')} style={styles.signInLink}>
          <Text style={styles.signInText}>
            Already have an account?{' '}
            <Text style={styles.signInAccent}>Sign in</Text>
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ─── InputField component ─────────────────────────────────────────────────────
interface InputFieldProps {
  label: string;
  placeholder: string;
  value: string;
  onChangeText: (t: string) => void;
  error?: string;
  prefix?: string;
  secureTextEntry?: boolean;
  keyboardType?: any;
  returnKeyType?: any;
  onSubmitEditing?: () => void;
  autoCapitalize?: any;
  ref?: any;
}

const InputField = React.forwardRef<TextInput, InputFieldProps>(
  ({ label, placeholder, value, onChangeText, error, prefix, ...rest }, ref) => (
    <View style={inputStyles.wrap}>
      <Text style={inputStyles.label}>{label}</Text>
      <View style={[inputStyles.inputRow, error && inputStyles.inputError]}>
        {prefix && <Text style={inputStyles.prefix}>{prefix}</Text>}
        <TextInput
          ref={ref}
          style={inputStyles.input}
          placeholder={placeholder}
          placeholderTextColor={Colors.tx3}
          value={value}
          onChangeText={onChangeText}
          {...rest}
        />
      </View>
      {error && <Text style={inputStyles.errorText}>{error}</Text>}
    </View>
  )
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: Spacing.xxl,
    paddingTop: 60,
    paddingBottom: Spacing.xxxl,
  },
  backBtn: { marginBottom: Spacing.xxl },
  backIcon: { fontSize: 24, color: Colors.tx2 },
  header: { marginBottom: Spacing.xxxl, gap: Spacing.sm },
  codeConfirm: { alignSelf: 'flex-start', marginTop: Spacing.sm, backgroundColor: 'rgba(200,244,90,0.10)', borderWidth: 0.5, borderColor: 'rgba(200,244,90,0.25)', borderRadius: Radius.md, paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md },
  codeConfirmText: { fontFamily: Typography.body, fontSize: 13, color: Colors.tx2 },
  codeConfirmCode: { fontFamily: Typography.headingBold, color: Colors.lime, letterSpacing: 1 },
  title: { fontFamily: Typography.heading, fontSize: 28, color: Colors.tx, letterSpacing: -0.5 },
  subtitle: { fontFamily: Typography.body, fontSize: 14, color: Colors.tx2, lineHeight: 22 },
  form: { gap: Spacing.lg, marginBottom: Spacing.xxl },
  submitBtn: { borderRadius: Radius.xl, overflow: 'hidden', marginBottom: Spacing.lg },
  submitGradient: { paddingVertical: 16, alignItems: 'center' },
  submitText: { fontFamily: Typography.headingBold, fontSize: 16, color: '#071810' },
  signInLink: { alignItems: 'center', paddingVertical: Spacing.md },
  signInText: { fontFamily: Typography.body, fontSize: 14, color: Colors.tx3 },
  signInAccent: { color: Colors.lime, fontFamily: Typography.headingBold },
});

const inputStyles = StyleSheet.create({
  wrap: { gap: Spacing.xs },
  label: { fontFamily: Typography.headingMedium, fontSize: 11, color: Colors.tx3, textTransform: 'uppercase', letterSpacing: 0.8 },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.sf,
    borderWidth: 0.5,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
  },
  inputError: { borderColor: Colors.coral },
  prefix: { fontFamily: Typography.headingBold, fontSize: 15, color: Colors.tx3, marginRight: 4 },
  input: {
    flex: 1,
    paddingVertical: 13,
    fontSize: 15,
    color: Colors.tx,
    fontFamily: Typography.body,
  },
  errorText: { fontFamily: Typography.body, fontSize: 11, color: Colors.coral },
});
