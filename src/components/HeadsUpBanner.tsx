// src/components/HeadsUpBanner.tsx
//
// Heads up on Today: shown only when an item matches something this person
// scanned, snapped or bought, and they haven't opened it yet. Calm wording,
// always an action. Everything unmatched waits in the weekly digest.

import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Colors, Typography } from '../constants/theme';
import { getHeadsUp, HeadsUpItem } from '../lib/growth';
import { useGrowthStore } from '../lib/growthStore';

export default function HeadsUpBanner({ navigation }: { navigation: any }) {
  const [items, setItems] = useState<HeadsUpItem[]>([]);
  const seen = useGrowthStore((s) => s.seenHeadsUp);

  useFocusEffect(
    useCallback(() => {
      getHeadsUp().then(setItems).catch(() => setItems([]));
    }, [])
  );

  // Recalls first: they're the only urgent kind.
  const match = items
    .filter((i) => i.matched && !seen.includes(i.id))
    .sort((a, b) => (a.kind === 'recall' ? -1 : 0) - (b.kind === 'recall' ? -1 : 0))[0];
  if (!match) return null;

  const isRecall = match.kind === 'recall';
  return (
    <TouchableOpacity
      style={[st.wrap, isRecall && st.wrapRecall]}
      onPress={() => navigation.navigate('HeadsUp', { focus: match.id })}
      activeOpacity={0.85}
    >
      <View style={[st.dot, isRecall && { backgroundColor: Colors.amber }]} />
      <View style={{ flex: 1 }}>
        <Text style={st.kicker}>{isRecall ? 'HEADS UP · RECALL' : 'HEADS UP'}</Text>
        <Text style={st.title}>{match.title}</Text>
        <Text style={st.sub}>
          {match.sourceName} · tap for what to do
        </Text>
      </View>
      <Text style={st.chev}>›</Text>
    </TouchableOpacity>
  );
}

const st = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', gap: 11, marginHorizontal: 18, marginTop: 14, backgroundColor: Colors.bg2, borderWidth: 1, borderColor: Colors.border2, borderRadius: 16, padding: 13 },
  wrapRecall: { borderColor: 'rgba(252,211,77,0.35)', backgroundColor: 'rgba(252,211,77,0.05)' },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.teal },
  kicker: { fontFamily: Typography.headingBold, fontSize: 9, fontWeight: '700', letterSpacing: 1.4, color: Colors.amber },
  title: { fontFamily: Typography.headingBold, fontSize: 14, fontWeight: '600', color: Colors.tx, marginTop: 3, lineHeight: 19 },
  sub: { fontFamily: Typography.body, fontSize: 11.5, color: Colors.tx3, marginTop: 3 },
  chev: { fontSize: 20, color: Colors.tx3 },
});
