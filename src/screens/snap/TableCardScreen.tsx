// src/screens/snap/TableCardScreen.tsx
//
// Share as a card (claude/TABLE-CARD-DESIGN.md, locked 25 Sep 2026).
//   • Two formats, both offered: Story (1080×1920) and Carousel (3 × 1080×1350).
//   • Paint never carries words. All text sits on the dark ground, on one left
//     edge, labels in their own column. The only lime is the number.
//   • Carousel: slide 1 is the dish, the last slide carries every detail with a
//     sliver of the painting at its edge.
//   • Location: city by default, never Home or Work.
//   • The EcoKey on the card turns a shared card into a link in your chain.
//
// UI phase: the painting is a stand-in (the photo under a palette wash).
// Backend phase adds the Skia painter, subject lifting, and image export with
// react-native-view-shot + expo-sharing; until then Share sends text.

import React, { useState } from 'react';
import { View, Text, StyleSheet, Image, Share, ScrollView, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Typography } from '../../constants/theme';
import { Screen, Button, Chip, Body, SampleTag } from '../../components/kit';
import { SAMPLE_KEYS, SAMPLE_MODE } from '../../lib/sample';

// Cool-to-warm sweep, as the painter will pull from the photo.
const WASH = ['#2E4A5A', '#4E6B4A', '#A8743A', '#C9542E'] as const;

function Painting({ photo, height }: { photo?: string | null; height: number }) {
  return (
    <View style={{ height, overflow: 'hidden', backgroundColor: '#2a2320' }}>
      {photo ? <Image source={{ uri: photo }} style={StyleSheet.absoluteFill} resizeMode="cover" blurRadius={2} /> : null}
      <LinearGradient
        colors={WASH.map((c) => c + (photo ? '99' : 'ff')) as unknown as [string, string, ...string[]]}
        start={{ x: 0, y: 0.2 }}
        end={{ x: 1, y: 0.8 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={st.paintNote}>
        <Text style={st.paintNoteTxt}>painting renders here</Text>
      </View>
    </View>
  );
}

function Details({ p, keyCode, compact }: { p: any; keyCode: string; compact?: boolean }) {
  const rows: [string, string | null | undefined][] = [
    ['The good', p.good],
    ['The catch', p.catch],
    ['Few know', p.fewKnow],
    ['On the table', (p.items ?? []).join(', ')],
    ['Where', p.place],
  ];
  return (
    <View style={[st.details, compact && { padding: 16, gap: 8 }]}>
      <View style={st.numRow}>
        <Text style={[st.num, compact && { fontSize: 34 }]}>{Number(p.lb ?? 0).toFixed(1)}</Text>
        <Text style={st.numUnit}>lb CO₂e for the table</Text>
      </View>
      <Text style={st.opening}>{p.title}</Text>
      {rows
        .filter(([, v]) => !!v)
        .map(([l, v]) => (
          <View key={l} style={st.row}>
            <Text style={st.rowLbl}>{l}</Text>
            <Text style={st.rowTxt}>{v}</Text>
          </View>
        ))}
      <View style={[st.row, { marginTop: 4 }]}>
        <Text style={st.rowLbl}>Key</Text>
        <Text style={[st.rowTxt, { color: Colors.tx }]}>{keyCode} · tryecopulse.com</Text>
      </View>
    </View>
  );
}

export default function TableCardScreen({ navigation, route }: any) {
  const p = route?.params ?? {};
  const [format, setFormat] = useState<'story' | 'carousel'>('story');
  const { width } = useWindowDimensions();
  const key = SAMPLE_KEYS.find((k) => !k.used)?.code ?? 'ECO-KEY';
  const w = Math.min(width - 36, 360);

  const share = async () => {
    // Backend phase: capture the card as images and share them.
    try {
      await Share.share({
        message: `${p.title} · ${Number(p.lb ?? 0).toFixed(1)} lb CO₂e for the table. ${p.good ?? ''}\n\nMy key ${key} · tryecopulse.com`,
      });
    } catch {}
  };

  return (
    <Screen
      title="Share as a card"
      onClose={() => navigation.goBack()}
      footer={<Button label={format === 'story' ? 'Share story' : 'Share carousel'} onPress={share} />}
    >
      {SAMPLE_MODE && <SampleTag />}
      <View style={st.formats}>
        <Chip label="Story" on={format === 'story'} onPress={() => setFormat('story')} />
        <Chip label="Carousel" on={format === 'carousel'} onPress={() => setFormat('carousel')} />
      </View>
      <Body muted style={{ fontSize: 12.5, marginBottom: 14 }}>
        {format === 'story'
          ? 'One tall image. Works everywhere.'
          : 'Three slides. The painting runs across the first two; the last carries the details, so it still makes sense on its own.'}
      </Body>

      {format === 'story' ? (
        <View style={[st.card, { width: w, alignSelf: 'center' }]}>
          <Painting photo={p.photo} height={w * 0.9} />
          <Details p={p} keyCode={key} />
        </View>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }} style={{ marginHorizontal: -18, paddingHorizontal: 18 }}>
          <View style={[st.card, { width: w * 0.8, height: w }]}>
            <Painting photo={p.photo} height={w} />
          </View>
          <View style={[st.card, { width: w * 0.8, height: w }]}>
            <Painting height={w} />
          </View>
          <View style={[st.card, { width: w * 0.8, height: w, flexDirection: 'row' }]}>
            <View style={{ width: 10 }}>
              <Painting height={w} />
            </View>
            <View style={{ flex: 1 }}>
              <Details p={p} keyCode={key} compact />
            </View>
          </View>
        </ScrollView>
      )}
    </Screen>
  );
}

const st = StyleSheet.create({
  formats: { flexDirection: 'row', gap: 8, marginTop: 10, marginBottom: 8 },
  card: { backgroundColor: '#0B1411', borderRadius: 14, overflow: 'hidden', borderWidth: 1, borderColor: Colors.border },
  paintNote: { position: 'absolute', right: 8, bottom: 8, backgroundColor: 'rgba(0,0,0,0.35)', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  paintNoteTxt: { fontSize: 9, color: 'rgba(255,255,255,0.7)', fontFamily: Typography.body },
  details: { padding: 20, gap: 10 },
  numRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  num: { fontFamily: Typography.heading, fontSize: 44, fontWeight: '700', color: Colors.lime, letterSpacing: -1.5 },
  numUnit: { fontFamily: Typography.body, fontSize: 12, color: Colors.tx2 },
  opening: { fontFamily: Typography.heading, fontSize: 17, fontWeight: '600', color: Colors.tx, lineHeight: 22 },
  row: { flexDirection: 'row', gap: 10 },
  rowLbl: { width: 70, fontFamily: Typography.headingBold, fontSize: 8.5, fontWeight: '700', letterSpacing: 1.2, color: Colors.tx3, textTransform: 'uppercase', paddingTop: 3 },
  rowTxt: { flex: 1, fontFamily: Typography.body, fontSize: 12, color: Colors.tx2, lineHeight: 17 },
});
