// src/components/kit.tsx
//
// Small shared pieces for the v5 screens (onboarding, paywall, streak, chain,
// camera reads, Heads up). Older screens keep their own styles; new screens
// use these so they stay consistent with each other.

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  ViewStyle,
  TextStyle,
  StyleProp,
  Switch,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Typography } from '../constants/theme';

export function Screen({
  children,
  title,
  onBack,
  onClose,
  right,
  scroll = true,
  footer,
  contentStyle,
}: {
  children: React.ReactNode;
  title?: string;
  onBack?: () => void;
  onClose?: () => void;
  right?: React.ReactNode;
  scroll?: boolean;
  footer?: React.ReactNode;
  contentStyle?: ViewStyle;
}) {
  const insets = useSafeAreaInsets();
  const body = scroll ? (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={[{ paddingHorizontal: 18, paddingBottom: 32 }, contentStyle]}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[{ flex: 1, paddingHorizontal: 18 }, contentStyle]}>{children}</View>
  );
  return (
    <View style={[k.root, { paddingTop: insets.top || 12 }]}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.bg} />
      {(title || onBack || onClose || right) && (
        <View style={k.header}>
          {onBack ? (
            <TouchableOpacity onPress={onBack} style={k.hBtn} accessibilityLabel="Back">
              <Text style={k.hBtnTxt}>‹</Text>
            </TouchableOpacity>
          ) : onClose ? (
            <TouchableOpacity onPress={onClose} style={k.hBtn} accessibilityLabel="Close">
              <Text style={[k.hBtnTxt, { fontSize: 16 }]}>✕</Text>
            </TouchableOpacity>
          ) : (
            <View style={k.hBtn} />
          )}
          <Text style={k.hTitle} numberOfLines={1}>
            {title ?? ''}
          </Text>
          <View style={[k.hBtn, { alignItems: 'flex-end', width: 'auto', minWidth: 36 }]}>{right}</View>
        </View>
      )}
      {body}
      {footer && <View style={[k.footer, { paddingBottom: Math.max(insets.bottom, 14) }]}>{footer}</View>}
    </View>
  );
}

export function Eyebrow({ children, color, style }: { children: React.ReactNode; color?: string; style?: StyleProp<TextStyle> }) {
  return <Text style={[k.eyebrow, color ? { color } : null, style]}>{children}</Text>;
}

export function H1({ children, style }: { children: React.ReactNode; style?: StyleProp<TextStyle> }) {
  return <Text style={[k.h1, style]}>{children}</Text>;
}

export function Body({ children, style, muted }: { children: React.ReactNode; style?: StyleProp<TextStyle>; muted?: boolean }) {
  return <Text style={[k.body, muted && { color: Colors.tx3 }, style]}>{children}</Text>;
}

export function Button({
  label,
  onPress,
  kind = 'primary',
  disabled,
  loading,
  style,
}: {
  label: string;
  onPress: () => void;
  kind?: 'primary' | 'secondary' | 'ghost';
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.85}
      style={[
        k.btn,
        kind === 'primary' && k.btnPrimary,
        kind === 'secondary' && k.btnSecondary,
        kind === 'ghost' && k.btnGhost,
        (disabled || loading) && { opacity: 0.45 },
        style,
      ]}
      accessibilityRole="button"
    >
      {loading ? (
        <ActivityIndicator color={kind === 'primary' ? '#071810' : Colors.lime} />
      ) : (
        <Text
          style={[
            k.btnTxt,
            kind === 'primary' && { color: '#071810' },
            kind === 'secondary' && { color: Colors.tx },
            kind === 'ghost' && { color: Colors.tx2, fontSize: 13 },
          ]}
        >
          {label}
        </Text>
      )}
    </TouchableOpacity>
  );
}

export function Chip({
  label,
  on,
  onPress,
  sub,
  style,
}: {
  label: string;
  on?: boolean;
  onPress?: () => void;
  sub?: string;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={!onPress}
      activeOpacity={0.8}
      style={[k.chip, on && k.chipOn, style]}
      accessibilityState={{ selected: !!on }}
    >
      <Text style={[k.chipTxt, on && k.chipTxtOn]}>{label}</Text>
      {!!sub && <Text style={[k.chipSub, on && { color: Colors.lime2 }]}>{sub}</Text>}
    </TouchableOpacity>
  );
}

export function Card({ children, style, accent }: { children: React.ReactNode; style?: StyleProp<ViewStyle>; accent?: boolean }) {
  return <View style={[k.card, accent && k.cardAccent, style]}>{children}</View>;
}

export function ToggleRow({
  title,
  meta,
  value,
  onChange,
}: {
  title: string;
  meta?: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <View style={k.toggleRow}>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={k.toggleTitle}>{title}</Text>
        {!!meta && <Text style={k.toggleMeta}>{meta}</Text>}
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: Colors.sf2, true: 'rgba(200,244,90,0.45)' }}
        thumbColor={value ? Colors.lime : Colors.tx3}
        ios_backgroundColor={Colors.sf2}
      />
    </View>
  );
}

/** Label / value rows used by every camera read ("The good", "Few know"…). */
export function FactRow({ label, children, color }: { label: string; children: React.ReactNode; color?: string }) {
  return (
    <View style={k.fact}>
      <Text style={[k.factLbl, color ? { color } : null]}>{label}</Text>
      <Text style={k.factTxt}>{children}</Text>
    </View>
  );
}

/** Marks anything drawn from src/lib/sample.ts so nobody mistakes it for real data. */
export function SampleTag() {
  return (
    <View style={k.sample}>
      <Text style={k.sampleTxt}>SAMPLE DATA</Text>
    </View>
  );
}

export function Divider() {
  return <View style={k.divider} />;
}

export const k = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, gap: 6 },
  hBtn: { width: 36, height: 36, justifyContent: 'center' },
  hBtnTxt: { fontSize: 26, color: Colors.tx2, paddingLeft: 6 },
  hTitle: { flex: 1, textAlign: 'center', fontFamily: Typography.headingBold, fontSize: 15, fontWeight: '600', color: Colors.tx },
  footer: { paddingHorizontal: 18, paddingTop: 10, gap: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.border, backgroundColor: Colors.bg },

  eyebrow: { fontFamily: Typography.headingBold, fontSize: 10, fontWeight: '700', letterSpacing: 1.8, color: Colors.tx3, textTransform: 'uppercase' },
  h1: { fontFamily: Typography.heading, fontSize: 27, fontWeight: '700', color: Colors.tx, letterSpacing: -0.6, lineHeight: 32 },
  body: { fontFamily: Typography.body, fontSize: 14.5, color: Colors.tx2, lineHeight: 21 },

  btn: { minHeight: 50, borderRadius: 14, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18 },
  btnPrimary: { backgroundColor: Colors.lime },
  btnSecondary: { backgroundColor: Colors.sf, borderWidth: 1, borderColor: Colors.border2 },
  btnGhost: { minHeight: 40 },
  btnTxt: { fontFamily: Typography.headingBold, fontSize: 15, fontWeight: '700' },

  chip: { borderWidth: 1, borderColor: Colors.border2, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 9, backgroundColor: Colors.bg2 },
  chipOn: { backgroundColor: 'rgba(200,244,90,0.14)', borderColor: 'rgba(200,244,90,0.55)' },
  chipTxt: { fontFamily: Typography.bodyMedium, fontSize: 13.5, color: Colors.tx2, fontWeight: '500' },
  chipTxtOn: { color: Colors.lime },
  chipSub: { fontFamily: Typography.body, fontSize: 10.5, color: Colors.tx3, marginTop: 1 },

  card: { backgroundColor: Colors.bg2, borderWidth: 1, borderColor: Colors.border, borderRadius: 16, padding: 15 },
  cardAccent: { borderColor: Colors.border2, backgroundColor: Colors.bg3 },

  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.border },
  toggleTitle: { fontFamily: Typography.bodyMedium, fontSize: 14, color: Colors.tx, fontWeight: '500' },
  toggleMeta: { fontFamily: Typography.body, fontSize: 12, color: Colors.tx3, marginTop: 2 },

  fact: { flexDirection: 'row', gap: 12, paddingVertical: 9, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.border },
  factLbl: { width: 74, fontFamily: Typography.headingBold, fontSize: 9.5, fontWeight: '700', letterSpacing: 1.2, color: Colors.lime, textTransform: 'uppercase', paddingTop: 3 },
  factTxt: { flex: 1, fontFamily: Typography.body, fontSize: 13.5, color: Colors.tx2, lineHeight: 19 },

  sample: { alignSelf: 'flex-start', borderWidth: 1, borderColor: 'rgba(252,211,77,0.4)', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  sampleTxt: { fontFamily: Typography.headingBold, fontSize: 8.5, letterSpacing: 1.2, color: Colors.amber, fontWeight: '700' },

  divider: { height: StyleSheet.hairlineWidth, backgroundColor: Colors.border, marginVertical: 14 },
});
