// src/screens/auth/WelcomeScreen.tsx
import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Animated,
  StatusBar,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Colors, Typography, Spacing, Radius } from '../../constants/theme';

const { width, height } = Dimensions.get('window');

type Props = {
  navigation: NativeStackNavigationProp<any>;
};

export default function WelcomeScreen({ navigation }: Props) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(40)).current;
  const scaleAnim = useRef(new Animated.Value(0.85)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 900,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        tension: 60,
        friction: 10,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 60,
        friction: 10,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.bg} />

      {/* Background radial glow */}
      <View style={styles.glowTop} />
      <View style={styles.glowBottom} />

      <Animated.View
        style={[
          styles.content,
          {
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }, { scale: scaleAnim }],
          },
        ]}
      >
        {/* Logo */}
        <View style={styles.logoWrap}>
          <View style={styles.logoIcon}>
            <Text style={styles.logoEmoji}>🌿</Text>
          </View>
          <Text style={styles.wordmark}>
            eco<Text style={styles.wordmarkAccent}>pulse</Text>
          </Text>
          <Text style={styles.tagline}>Track your carbon. Challenge friends.</Text>
        </View>

        {/* Feature pills */}
        <View style={styles.features}>
          {[
            { icon: '📊', label: 'Auto-track your daily CO₂' },
            { icon: '👥', label: 'Compete on a green leaderboard' },
            { icon: '🌱', label: 'Gift plants for hitting goals' },
            { icon: '🎬', label: 'Discover eco reels' },
          ].map((f, i) => (
            <Animated.View
              key={i}
              style={[
                styles.featurePill,
                {
                  opacity: fadeAnim,
                  transform: [
                    {
                      translateX: fadeAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [i % 2 === 0 ? -20 : 20, 0],
                      }),
                    },
                  ],
                },
              ]}
            >
              <Text style={styles.featureIcon}>{f.icon}</Text>
              <Text style={styles.featureLabel}>{f.label}</Text>
            </Animated.View>
          ))}
        </View>

        {/* CTA Buttons */}
        <View style={styles.buttons}>
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={() => navigation.navigate('SignUp')}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={[Colors.lime, Colors.lime2]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.primaryBtnGradient}
            >
              <Text style={styles.primaryBtnText}>Get started — it's free</Text>
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryBtn}
            onPress={() => navigation.navigate('SignIn')}
            activeOpacity={0.75}
          >
            <Text style={styles.secondaryBtnText}>
              Already have an account?{' '}
              <Text style={styles.secondaryBtnAccent}>Sign in</Text>
            </Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.legal}>
          By continuing you agree to our Terms & Privacy Policy
        </Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  glowTop: {
    position: 'absolute',
    top: -100,
    left: width / 2 - 150,
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: 'rgba(200,244,90,0.06)',
  },
  glowBottom: {
    position: 'absolute',
    bottom: -80,
    right: -60,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(45,212,191,0.05)',
  },
  content: {
    flex: 1,
    width: '100%',
    paddingHorizontal: Spacing.xxl,
    justifyContent: 'center',
    gap: Spacing.xxxl,
  },
  logoWrap: {
    alignItems: 'center',
    gap: Spacing.md,
  },
  logoIcon: {
    width: 72,
    height: 72,
    borderRadius: 22,
    backgroundColor: Colors.bg3,
    borderWidth: 1,
    borderColor: Colors.border2,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  logoEmoji: {
    fontSize: 36,
  },
  wordmark: {
    fontFamily: Typography.heading,
    fontSize: 36,
    color: Colors.tx,
    letterSpacing: -1,
  },
  wordmarkAccent: {
    color: Colors.lime,
  },
  tagline: {
    fontFamily: Typography.body,
    fontSize: 15,
    color: Colors.tx2,
    textAlign: 'center',
  },
  features: {
    gap: Spacing.sm,
  },
  featurePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.bg2,
    borderWidth: 0.5,
    borderColor: Colors.border,
    borderRadius: Radius.lg,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
  },
  featureIcon: {
    fontSize: 18,
  },
  featureLabel: {
    fontFamily: Typography.bodyMedium,
    fontSize: 14,
    color: Colors.tx2,
  },
  buttons: {
    gap: Spacing.md,
  },
  primaryBtn: {
    borderRadius: Radius.xl,
    overflow: 'hidden',
  },
  primaryBtnGradient: {
    paddingVertical: 16,
    alignItems: 'center',
    borderRadius: Radius.xl,
  },
  primaryBtnText: {
    fontFamily: Typography.headingBold,
    fontSize: 16,
    color: '#071810',
  },
  secondaryBtn: {
    paddingVertical: Spacing.md,
    alignItems: 'center',
  },
  secondaryBtnText: {
    fontFamily: Typography.body,
    fontSize: 14,
    color: Colors.tx3,
  },
  secondaryBtnAccent: {
    color: Colors.lime,
    fontFamily: Typography.headingBold,
  },
  legal: {
    fontFamily: Typography.body,
    fontSize: 11,
    color: Colors.tx3,
    textAlign: 'center',
  },
});
