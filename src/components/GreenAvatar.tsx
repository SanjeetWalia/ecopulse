import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet } from 'react-native';
import Svg, {
  Circle, Ellipse, Path, Rect, G, Defs,
  RadialGradient, Stop, ClipPath
} from 'react-native-svg';

// ── Types ─────────────────────────────────────────────────────────────────────
export type AvatarLevel = 1 | 2 | 3 | 4 | 5 | 6;

interface Props {
  level: AvatarLevel;
  size?: number;
  animate?: boolean;
}

// ── Level metadata ─────────────────────────────────────────────────────────────
export const LEVEL_META = {
  1: { name: 'Seed',   emoji: '🌱', auraColor: 'rgba(200,244,90,0.3)',  auraColor2: 'rgba(200,244,90,0.1)'  },
  2: { name: 'Sprout', emoji: '🌿', auraColor: 'rgba(200,244,90,0.4)',  auraColor2: 'rgba(200,244,90,0.15)' },
  3: { name: 'Leaf',   emoji: '🍃', auraColor: 'rgba(200,244,90,0.5)',  auraColor2: 'rgba(45,212,191,0.2)'  },
  4: { name: 'Tree',   emoji: '🌳', auraColor: 'rgba(45,212,191,0.55)', auraColor2: 'rgba(200,244,90,0.25)' },
  5: { name: 'Forest', emoji: '🌲', auraColor: 'rgba(45,212,191,0.65)', auraColor2: 'rgba(45,212,191,0.3)'  },
  6: { name: 'Earth',  emoji: '🌍', auraColor: 'rgba(255,255,255,0.5)', auraColor2: 'rgba(45,212,191,0.4)'  },
};

// ── Face component (shared across all levels) ─────────────────────────────────
const Face = ({ cx, cy, r, skinTone = '#C8956A' }: { cx: number; cy: number; r: number; skinTone?: string }) => (
  <G>
    {/* Neck */}
    <Rect x={cx - 8} y={cy + r - 8} width={16} height={16} fill={skinTone} />
    {/* Face circle */}
    <Circle cx={cx} cy={cy} r={r} fill={skinTone} />
    {/* Hair */}
    <Path d={`M${cx - r} ${cy - 4} Q${cx} ${cy - r * 1.6} ${cx + r} ${cy - 4} Z`} fill="#2D1808" />
    {/* Eyes */}
    <Circle cx={cx - r * 0.32} cy={cy - 2} r={4} fill="#3D2010" />
    <Circle cx={cx + r * 0.32} cy={cy - 2} r={4} fill="#3D2010" />
    {/* Eye shine */}
    <Circle cx={cx - r * 0.32 + 1.5} cy={cy - 3} r={1.5} fill="white" />
    <Circle cx={cx + r * 0.32 + 1.5} cy={cy - 3} r={1.5} fill="white" />
    {/* Smile */}
    <Path d={`M${cx - 10} ${cy + 10} Q${cx} ${cy + 18} ${cx + 10} ${cy + 10}`} stroke="#3D2010" strokeWidth={2} fill="none" strokeLinecap="round" />
    {/* Shoulders / tunic */}
    <Path d={`M${cx - r * 1.4} ${cy + r + 20} Q${cx - r * 0.8} ${cy + r + 8} ${cx - r * 0.5} ${cy + r + 6} L${cx + r * 0.5} ${cy + r + 6} Q${cx + r * 0.8} ${cy + r + 8} ${cx + r * 1.4} ${cy + r + 20} Z`} fill="#3A7A47" />
  </G>
);

// ── Level 1: Seed ─────────────────────────────────────────────────────────────
const SeedAvatar = ({ s }: { s: number }) => {
  const cx = s / 2, cy = s / 2 - 5;
  return (
    <G>
      <Face cx={cx} cy={cy} r={32} />
      {/* Single tiny sprout above head */}
      <Path d={`M${cx} ${cy - 40} L${cx} ${cy - 56}`} stroke="#C8F45A" strokeWidth={2.5} strokeLinecap="round" />
      <Ellipse cx={cx} cy={cy - 60} rx={8} ry={10} fill="#C8F45A" />
      {/* Roots at feet */}
      <Path d={`M${cx - 8} ${cy + 54} Q${cx - 18} ${cy + 62} ${cx - 24} ${cy + 72}`} stroke="#8B6550" strokeWidth={2} fill="none" strokeLinecap="round" />
      <Path d={`M${cx} ${cy + 56} L${cx} ${cy + 72}`} stroke="#8B6550" strokeWidth={2} fill="none" strokeLinecap="round" />
      <Path d={`M${cx + 8} ${cy + 54} Q${cx + 18} ${cy + 62} ${cx + 24} ${cy + 72}`} stroke="#8B6550" strokeWidth={2} fill="none" strokeLinecap="round" />
    </G>
  );
};

// ── Level 2: Sprout ────────────────────────────────────────────────────────────
const SproutAvatar = ({ s }: { s: number }) => {
  const cx = s / 2, cy = s / 2 - 2;
  return (
    <G>
      <Face cx={cx} cy={cy} r={32} />
      {/* Leafy sprout crown */}
      <Path d={`M${cx} ${cy - 40} L${cx} ${cy - 58}`} stroke="#5DA832" strokeWidth={2.5} strokeLinecap="round" />
      <Ellipse cx={cx - 14} cy={cy - 54} rx={12} ry={8} fill="#C8F45A" transform={`rotate(-30 ${cx - 14} ${cy - 54})`} />
      <Ellipse cx={cx + 14} cy={cy - 54} rx={12} ry={8} fill="#A8E040" transform={`rotate(30 ${cx + 14} ${cy - 54})`} />
      <Ellipse cx={cx} cy={cy - 62} rx={10} ry={14} fill="#C8F45A" />
      {/* Side vine wisps */}
      <Path d={`M${cx - 32} ${cy + 10} Q${cx - 42} ${cy} ${cx - 38} ${cy - 12}`} stroke="#5DA832" strokeWidth={1.5} fill="none" />
      <Path d={`M${cx + 32} ${cy + 10} Q${cx + 42} ${cy} ${cx + 38} ${cy - 12}`} stroke="#5DA832" strokeWidth={1.5} fill="none" />
      {/* Roots */}
      <Path d={`M${cx - 10} ${cy + 54} Q${cx - 22} ${cy + 64} ${cx - 28} ${cy + 76}`} stroke="#8B6550" strokeWidth={2.5} fill="none" strokeLinecap="round" />
      <Path d={`M${cx} ${cy + 56} L${cx} ${cy + 76}`} stroke="#8B6550" strokeWidth={2.5} fill="none" strokeLinecap="round" />
      <Path d={`M${cx + 10} ${cy + 54} Q${cx + 22} ${cy + 64} ${cx + 28} ${cy + 76}`} stroke="#8B6550" strokeWidth={2.5} fill="none" strokeLinecap="round" />
    </G>
  );
};

// ── Level 3: Leaf ──────────────────────────────────────────────────────────────
const LeafAvatar = ({ s }: { s: number }) => {
  const cx = s / 2, cy = s / 2;
  return (
    <G>
      <Face cx={cx} cy={cy} r={32} />
      {/* Leaf crown - multiple large leaves */}
      <Path d={`M${cx} ${cy - 40} Q${cx - 30} ${cy - 65} ${cx - 40} ${cy - 80} Q${cx - 20} ${cy - 65} ${cx} ${cy - 40}`} fill="#C8F45A" />
      <Path d={`M${cx} ${cy - 40} Q${cx + 30} ${cy - 65} ${cx + 40} ${cy - 80} Q${cx + 20} ${cy - 65} ${cx} ${cy - 40}`} fill="#A8E040" />
      <Path d={`M${cx} ${cy - 42} Q${cx - 10} ${cy - 72} ${cx} ${cy - 88} Q${cx + 10} ${cy - 72} ${cx} ${cy - 42}`} fill="#C8F45A" />
      {/* Side leaves on shoulders */}
      <Path d={`M${cx - 32} ${cy + 8} Q${cx - 52} ${cy - 8} ${cx - 58} ${cy - 28} Q${cx - 42} ${cy - 12} ${cx - 32} ${cy + 8}`} fill="#5DA832" />
      <Path d={`M${cx + 32} ${cy + 8} Q${cx + 52} ${cy - 8} ${cx + 58} ${cy - 28} Q${cx + 42} ${cy - 12} ${cx + 32} ${cy + 8}`} fill="#5DA832" />
      {/* Roots */}
      <Path d={`M${cx - 12} ${cy + 54} Q${cx - 26} ${cy + 68} ${cx - 34} ${cy + 82}`} stroke="#6B4A30" strokeWidth={3} fill="none" strokeLinecap="round" />
      <Path d={`M${cx} ${cy + 56} L${cx} ${cy + 82}`} stroke="#6B4A30" strokeWidth={3} fill="none" strokeLinecap="round" />
      <Path d={`M${cx + 12} ${cy + 54} Q${cx + 26} ${cy + 68} ${cx + 34} ${cy + 82}`} stroke="#6B4A30" strokeWidth={3} fill="none" strokeLinecap="round" />
      {/* Small root branches */}
      <Path d={`M${cx - 28} ${cy + 74} Q${cx - 38} ${cy + 78} ${cx - 44} ${cy + 82}`} stroke="#6B4A30" strokeWidth={2} fill="none" strokeLinecap="round" />
      <Path d={`M${cx + 28} ${cy + 74} Q${cx + 38} ${cy + 78} ${cx + 44} ${cy + 82}`} stroke="#6B4A30" strokeWidth={2} fill="none" strokeLinecap="round" />
    </G>
  );
};

// ── Level 4: Tree ──────────────────────────────────────────────────────────────
const TreeAvatar = ({ s }: { s: number }) => {
  const cx = s / 2, cy = s / 2 + 4;
  return (
    <G>
      <Face cx={cx} cy={cy} r={30} />
      {/* Large canopy */}
      <Circle cx={cx} cy={cy - 62} r={38} fill="#3A8A20" />
      <Circle cx={cx - 22} cy={cy - 52} r={24} fill="#4A9E2A" />
      <Circle cx={cx + 22} cy={cy - 52} r={24} fill="#4A9E2A" />
      <Circle cx={cx} cy={cy - 78} r={26} fill="#5AB832" />
      {/* Fruits inside canopy - apples */}
      <Circle cx={cx - 16} cy={cy - 58} r={6} fill="#E84040" />
      <Circle cx={cx + 16} cy={cy - 58} r={6} fill="#E84040" />
      <Circle cx={cx} cy={cy - 72} r={5} fill="#E84040" />
      <Circle cx={cx - 8} cy={cy - 44} r={5} fill="#FFA030" />
      <Circle cx={cx + 10} cy={cy - 46} r={5} fill="#FFA030" />
      {/* Flowers inside canopy */}
      <Circle cx={cx - 26} cy={cy - 64} r={5} fill="#FFD700" />
      <Circle cx={cx + 28} cy={cy - 66} r={5} fill="#FFD700" />
      <Circle cx={cx + 6} cy={cy - 86} r={4} fill="#FFB6C1" />
      {/* Aura flowers on rings */}
      {[0, 60, 120, 180, 240, 300].map((deg, i) => {
        const rad = (deg * Math.PI) / 180;
        const fx = cx + 58 * Math.cos(rad);
        const fy = (cy - 20) + 58 * Math.sin(rad);
        return <Circle key={i} cx={fx} cy={fy} r={4} fill={i % 2 === 0 ? '#FCD34D' : '#FFB6C1'} opacity={0.8} />;
      })}
      {/* Thick roots */}
      <Path d={`M${cx - 14} ${cy + 50} Q${cx - 30} ${cy + 66} ${cx - 40} ${cy + 84}`} stroke="#5A3820" strokeWidth={4} fill="none" strokeLinecap="round" />
      <Path d={`M${cx} ${cy + 52} L${cx} ${cy + 84}`} stroke="#5A3820" strokeWidth={4} fill="none" strokeLinecap="round" />
      <Path d={`M${cx + 14} ${cy + 50} Q${cx + 30} ${cy + 66} ${cx + 40} ${cy + 84}`} stroke="#5A3820" strokeWidth={4} fill="none" strokeLinecap="round" />
      <Path d={`M${cx - 34} ${cy + 76} Q${cx - 46} ${cy + 80} ${cx - 54} ${cy + 84}`} stroke="#5A3820" strokeWidth={2.5} fill="none" strokeLinecap="round" />
      <Path d={`M${cx + 34} ${cy + 76} Q${cx + 46} ${cy + 80} ${cx + 54} ${cy + 84}`} stroke="#5A3820" strokeWidth={2.5} fill="none" strokeLinecap="round" />
    </G>
  );
};

// ── Level 5: Forest ────────────────────────────────────────────────────────────
const ForestAvatar = ({ s }: { s: number }) => {
  const cx = s / 2, cy = s / 2 + 6;
  return (
    <G>
      <Face cx={cx} cy={cy} r={28} skinTone="#B88060" />
      {/* Dense forest canopy */}
      <Circle cx={cx} cy={cy - 70} r={44} fill="#1A6A0A" />
      <Circle cx={cx - 28} cy={cy - 56} r={32} fill="#2A7A16" />
      <Circle cx={cx + 28} cy={cy - 56} r={32} fill="#2A7A16" />
      <Circle cx={cx} cy={cy - 90} r={30} fill="#3A8A22" />
      <Circle cx={cx - 14} cy={cy - 84} r={22} fill="#4A9A2E" />
      <Circle cx={cx + 14} cy={cy - 84} r={22} fill="#4A9A2E" />
      {/* Many fruits */}
      {[[-20,-62],[20,-62],[0,-76],[-12,-48],[12,-48],[-28,-70],[28,-70],[0,-92]].map(([ox, oy], i) => (
        <Circle key={i} cx={cx + ox} cy={cy + oy} r={5} fill={i % 3 === 0 ? '#E84040' : i % 3 === 1 ? '#FFA030' : '#FFD700'} />
      ))}
      {/* Flowers on aura rings */}
      {[0, 45, 90, 135, 180, 225, 270, 315].map((deg, i) => {
        const rad = (deg * Math.PI) / 180;
        const fx = cx + 66 * Math.cos(rad);
        const fy = (cy - 22) + 66 * Math.sin(rad);
        return <G key={i}>
          <Circle cx={fx} cy={fy} r={5} fill={i % 2 === 0 ? '#FCD34D' : '#FFB6C1'} opacity={0.9} />
          <Circle cx={fx} cy={fy} r={2} fill="white" opacity={0.8} />
        </G>;
      })}
      {/* Mossy roots */}
      {[-18, 0, 18].map((offset, i) => (
        <Path key={i} d={`M${cx + offset} ${cy + 48} Q${cx + offset * 2.2} ${cy + 64} ${cx + offset * 3} ${cy + 82}`} stroke="#3A5A20" strokeWidth={3.5} fill="none" strokeLinecap="round" />
      ))}
      {[-40, 40].map((offset, i) => (
        <Path key={i} d={`M${cx + offset * 0.7} ${cy + 68} Q${cx + offset} ${cy + 74} ${cx + offset * 1.3} ${cy + 82}`} stroke="#3A5A20" strokeWidth={2} fill="none" strokeLinecap="round" />
      ))}
    </G>
  );
};

// ── Level 6: Earth ─────────────────────────────────────────────────────────────
const EarthAvatar = ({ s }: { s: number }) => {
  const cx = s / 2, cy = s / 2 + 6;
  return (
    <G>
      <Face cx={cx} cy={cy} r={26} skinTone="#A07050" />
      {/* Globe canopy */}
      <Circle cx={cx} cy={cy - 74} r={48} fill="#0A4A8A" />
      {/* Continents */}
      <Path d={`M${cx - 24} ${cy - 90} Q${cx - 10} ${cy - 98} ${cx + 8} ${cy - 88} Q${cx + 18} ${cy - 76} ${cx + 4} ${cy - 68} Q${cx - 14} ${cy - 66} ${cx - 22} ${cy - 78} Z`} fill="#2A8A3A" />
      <Path d={`M${cx - 38} ${cy - 70} Q${cx - 44} ${cy - 82} ${cx - 32} ${cy - 84} Q${cx - 24} ${cy - 76} ${cx - 30} ${cy - 66} Z`} fill="#2A8A3A" />
      <Path d={`M${cx + 18} ${cy - 60} Q${cx + 32} ${cy - 72} ${cx + 42} ${cy - 62} Q${cx + 36} ${cy - 50} ${cx + 22} ${cy - 52} Z`} fill="#3A9A4A" />
      <Path d={`M${cx - 10} ${cy - 54} Q${cx + 6} ${cy - 62} ${cx + 14} ${cy - 52} Q${cx + 6} ${cy - 44} ${cx - 8} ${cy - 46} Z`} fill="#2A8A3A" />
      {/* Clouds */}
      <Circle cx={cx - 18} cy={cy - 112} r={10} fill="white" opacity={0.7} />
      <Circle cx={cx - 8} cy={cy - 116} r={12} fill="white" opacity={0.7} />
      <Circle cx={cx + 4} cy={cy - 112} r={9} fill="white" opacity={0.7} />
      {/* White aura + many flowers */}
      {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map((deg, i) => {
        const rad = (deg * Math.PI) / 180;
        const r1 = i % 2 === 0 ? 72 : 80;
        const fx = cx + r1 * Math.cos(rad);
        const fy = (cy - 24) + r1 * Math.sin(rad);
        return <G key={i}>
          <Circle cx={fx} cy={fy} r={i % 3 === 0 ? 6 : 4} fill={i % 3 === 0 ? '#FCD34D' : i % 3 === 1 ? '#FFB6C1' : 'white'} opacity={0.9} />
          <Circle cx={fx} cy={fy} r={2} fill="white" opacity={0.6} />
        </G>;
      })}
      {/* Thick ancient roots */}
      {[-20, -6, 8, 22].map((offset, i) => (
        <Path key={i} d={`M${cx + offset} ${cy + 46} Q${cx + offset * 1.8 + (i % 2 === 0 ? -4 : 4)} ${cy + 64} ${cx + offset * 2.8} ${cy + 82}`} stroke="#2A3A18" strokeWidth={i % 2 === 0 ? 4 : 3} fill="none" strokeLinecap="round" />
      ))}
    </G>
  );
};

// ── Aura rings ─────────────────────────────────────────────────────────────────
const AuraRings = ({ level, s, pulse }: { level: AvatarLevel; s: number; pulse: Animated.Value }) => {
  const cx = s / 2;
  const cy = s / 2 - (level >= 4 ? 10 : 0);
  const meta = LEVEL_META[level];

  if (level === 1) return null; // No aura for seed

  return (
    <G>
      {/* Ring 1 */}
      <Circle cx={cx} cy={cy} r={s * 0.42} stroke={meta.auraColor} strokeWidth={1.5} fill="none" opacity={0.7} />
      {/* Ring 2 */}
      {level >= 3 && <Circle cx={cx} cy={cy} r={s * 0.48} stroke={meta.auraColor2} strokeWidth={1} fill="none" opacity={0.5} />}
      {/* Ring 3 */}
      {level >= 5 && <Circle cx={cx} cy={cy} r={s * 0.54} stroke={meta.auraColor} strokeWidth={0.5} fill="none" opacity={0.3} />}
    </G>
  );
};

// ── Main component ─────────────────────────────────────────────────────────────
export default function GreenAvatar({ level, size = 160, animate = true }: Props) {
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!animate) return;
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.04, duration: 2000, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1.0, duration: 2000, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [animate]);

  const AvatarBody = [SeedAvatar, SproutAvatar, LeafAvatar, TreeAvatar, ForestAvatar, EarthAvatar][level - 1];

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View style={{ transform: [{ scale: level >= 3 ? pulse : 1 }] }}>
        <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <Defs>
            <RadialGradient id="auraGrad" cx="50%" cy="50%" r="50%">
              <Stop offset="40%" stopColor="transparent" stopOpacity={0} />
              <Stop offset="100%" stopColor={LEVEL_META[level].auraColor} stopOpacity={0.4} />
            </RadialGradient>
          </Defs>
          {/* Background aura glow */}
          {level >= 2 && <Circle cx={size / 2} cy={size / 2} r={size / 2} fill="url(#auraGrad)" />}
          {/* Aura rings */}
          <AuraRings level={level} s={size} pulse={pulse} />
          {/* Avatar body */}
          <AvatarBody s={size} />
        </Svg>
      </Animated.View>
    </View>
  );
}
