import React, { useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Animated, Share, Dimensions
} from 'react-native';
import { Colors, Typography } from '../constants/theme';
import GreenAvatar, { LEVEL_META, AvatarLevel } from './GreenAvatar';
import { PAST_LEVELS } from '../lib/levelEngine';

const { width } = Dimensions.get('window');

interface Props {
  newLevel: AvatarLevel;
  userName: string;
  cleanAirStat: string;
  onClose: () => void;
}

export default function LevelUpCard({ newLevel, userName, cleanAirStat, onClose }: Props) {
  const scale = useRef(new Animated.Value(0.7)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const particleY = useRef(new Animated.Value(0)).current;

  const meta = LEVEL_META[newLevel];
  const pastInfo = PAST_LEVELS[newLevel];

  useEffect(() => {
    // Entrance animation
    Animated.parallel([
      Animated.spring(scale, {
        toValue: 1,
        tension: 60,
        friction: 8,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
    ]).start();

    // Floating particles
    Animated.loop(
      Animated.sequence([
        Animated.timing(particleY, { toValue: -20, duration: 2000, useNativeDriver: true }),
        Animated.timing(particleY, { toValue: 0, duration: 2000, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  const handleShare = async () => {
    try {
      await Share.share({
        message: `I just became a ${meta.name} ${meta.emoji} on Eco Pulse!\n\n"${pastInfo.label}" — ${cleanAirStat}\n\necopulse.app`,
        title: `I leveled up on Eco Pulse!`,
      });
    } catch (e) {
      console.log('Share error', e);
    }
  };

  // Floating particles
  const PARTICLES = ['🌿', '✨', '🍃', '🌱', '⭐', '🌸'];

  return (
    <Animated.View style={[s.overlay, { opacity }]}>
      <Animated.View style={[s.card, { transform: [{ scale }] }]}>

        {/* Floating particles */}
        {PARTICLES.map((p, i) => (
          <Animated.Text
            key={i}
            style={[
              s.particle,
              {
                left: 20 + (i * 44),
                top: 12 + (i % 2 === 0 ? 0 : 20),
                transform: [{ translateY: i % 2 === 0 ? particleY : Animated.multiply(particleY, new Animated.Value(-1)) }],
                opacity: 0.6,
              }
            ]}
          >
            {p}
          </Animated.Text>
        ))}

        {/* Level label */}
        <View style={s.levelLabel}>
          <Text style={s.levelLabelTxt}>Level {newLevel} unlocked</Text>
        </View>

        {/* Avatar */}
        <View style={s.avatarWrap}>
          <GreenAvatar level={newLevel} size={160} animate />
        </View>

        {/* Title */}
        <Text style={s.levelName}>You just became</Text>
        <Text style={[s.levelTitle, { color: newLevel >= 5 ? '#2DD4BF' : Colors.lime }]}>
          {meta.name} {meta.emoji}
        </Text>

        {/* Story desc */}
        <Text style={s.storyLabel}>{pastInfo.label}</Text>
        <Text style={s.storyDesc}>{pastInfo.desc}</Text>

        {/* Clean air stat */}
        <View style={s.statCard}>
          <Text style={s.statVal}>{cleanAirStat}</Text>
          <Text style={s.statLbl}>you've given Earth</Text>
        </View>

        {/* Actions */}
        <TouchableOpacity style={s.shareBtn} onPress={handleShare} activeOpacity={0.8}>
          <Text style={s.shareTxt}>Share this moment 🌿</Text>
        </TouchableOpacity>

        <TouchableOpacity style={s.closeBtn} onPress={onClose} activeOpacity={0.7}>
          <Text style={s.closeTxt}>Continue growing</Text>
        </TouchableOpacity>

      </Animated.View>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(5,14,10,0.95)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
    paddingHorizontal: 20,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#0E1A16',
    borderRadius: 28,
    borderWidth: 0.5,
    borderColor: 'rgba(200,244,90,0.25)',
    padding: 28,
    alignItems: 'center',
    overflow: 'hidden',
  },
  particle: {
    position: 'absolute',
    fontSize: 18,
  },
  levelLabel: {
    backgroundColor: 'rgba(200,244,90,0.1)',
    borderWidth: 0.5,
    borderColor: 'rgba(200,244,90,0.3)',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 5,
    marginBottom: 20,
  },
  levelLabelTxt: {
    fontFamily: Typography.headingBold,
    fontSize: 10,
    color: Colors.lime,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  avatarWrap: {
    marginBottom: 20,
  },
  levelName: {
    fontFamily: Typography.body,
    fontSize: 14,
    color: 'rgba(255,255,255,0.5)',
    marginBottom: 4,
  },
  levelTitle: {
    fontFamily: Typography.heading,
    fontSize: 32,
    letterSpacing: -1,
    marginBottom: 16,
  },
  storyLabel: {
    fontFamily: Typography.headingBold,
    fontSize: 13,
    color: 'rgba(255,255,255,0.7)',
    marginBottom: 6,
  },
  storyDesc: {
    fontFamily: Typography.body,
    fontSize: 13,
    color: 'rgba(255,255,255,0.4)',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
    paddingHorizontal: 8,
  },
  statCard: {
    backgroundColor: 'rgba(200,244,90,0.06)',
    borderWidth: 0.5,
    borderColor: 'rgba(200,244,90,0.2)',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 24,
    alignItems: 'center',
    marginBottom: 24,
    width: '100%',
  },
  statVal: {
    fontFamily: Typography.heading,
    fontSize: 18,
    color: Colors.lime,
    letterSpacing: -0.5,
    marginBottom: 2,
  },
  statLbl: {
    fontFamily: Typography.body,
    fontSize: 10,
    color: 'rgba(255,255,255,0.3)',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  shareBtn: {
    width: '100%',
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: Colors.lime,
    alignItems: 'center',
    marginBottom: 10,
  },
  shareTxt: {
    fontFamily: Typography.headingBold,
    fontSize: 14,
    color: '#071810',
  },
  closeBtn: {
    width: '100%',
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
  },
  closeTxt: {
    fontFamily: Typography.headingBold,
    fontSize: 13,
    color: 'rgba(255,255,255,0.4)',
  },
});
