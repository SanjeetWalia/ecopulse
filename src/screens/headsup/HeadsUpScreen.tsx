// src/screens/headsup/HeadsUpScreen.tsx
//
// Heads up (claude/CAMERA-READS.md): news about what's in your food, matched
// to what you actually bought.
//   • For you: items that match your watch list. Recalls reach you right away.
//   • This week: the opt-in digest of rule changes and test results.
//   • What we watch: the products the matching runs against, each deletable.
//
// Every item names and links its source, says how strong the evidence is, and
// ends in something to do. Never "toxic", never allergen safety calls.

import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Colors, Typography } from '../../constants/theme';
import { Screen, Card, Eyebrow, Body, SampleTag, ToggleRow } from '../../components/kit';
import { getHeadsUp, HeadsUpItem } from '../../lib/growth';
import { useGrowthStore } from '../../lib/growthStore';
import { SAMPLE_MODE } from '../../lib/sample';

const EVIDENCE_LABEL: Record<NonNullable<HeadsUpItem['evidence']>, string> = {
  'official recall': 'Official recall',
  'binding rule': 'Binding rule',
  voluntary: 'Voluntary, not a ban',
  'one study': 'One study',
  'several studies': 'Several studies',
  'settled finding': 'Settled finding',
};

function Item({ item, open, onToggle }: { item: HeadsUpItem; open: boolean; onToggle: () => void }) {
  const isRecall = item.kind === 'recall';
  return (
    <Card accent={open} style={[st.item, isRecall && item.matched ? st.itemRecall : null]}>
      <TouchableOpacity onPress={onToggle} activeOpacity={0.8}>
        <View style={st.itemTop}>
          <Text style={[st.kind, isRecall && { color: Colors.amber }]}>
            {isRecall ? 'RECALL' : item.kind === 'regulation' ? 'RULE CHANGE' : 'TESTING'}
          </Text>
          {!!item.evidence && <Text style={st.evidence}>{EVIDENCE_LABEL[item.evidence]}</Text>}
        </View>
        <Text style={st.title}>{item.title}</Text>
        {item.matchedItem && (
          <Text style={st.match}>
            Matches {item.matchedItem.name}, from your {item.matchedItem.how} on {item.matchedItem.when}
          </Text>
        )}
      </TouchableOpacity>

      {open && (
        <View style={{ marginTop: 10, gap: 10 }}>
          <Body style={{ fontSize: 13.5 }}>{item.body}</Body>
          {item.lotCodes && (
            <View style={st.lots}>
              <Text style={st.lotsLbl}>Affected lot codes</Text>
              <Text style={st.lotsTxt}>{item.lotCodes.join('   ')}</Text>
            </View>
          )}
          <View style={st.action}>
            <Text style={st.actionLbl}>What to do</Text>
            <Text style={st.actionTxt}>{item.action}</Text>
          </View>
          <TouchableOpacity onPress={() => Linking.openURL(item.sourceUrl)}>
            <Text style={st.src}>
              Source: {item.sourceName} · {item.published} ↗
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </Card>
  );
}

export default function HeadsUpScreen({ navigation, route }: any) {
  const [items, setItems] = useState<HeadsUpItem[]>([]);
  const [openId, setOpenId] = useState<string | null>(route?.params?.focus ?? null);
  const [digest, setDigest] = useState(true);
  const watchList = useGrowthStore((s) => s.watchList);
  const removeWatch = useGrowthStore((s) => s.removeWatch);
  const markSeen = useGrowthStore((s) => s.markHeadsUpSeen);

  useFocusEffect(
    useCallback(() => {
      getHeadsUp().then(setItems).catch(() => setItems([]));
    }, [])
  );

  useEffect(() => {
    if (openId) markSeen(openId);
  }, [openId, markSeen]);

  const mine = items.filter((i) => i.matched);
  const week = items.filter((i) => !i.matched);

  return (
    <Screen title="Heads up" onBack={() => navigation.goBack()}>
      {SAMPLE_MODE && <SampleTag />}
      <Body style={{ marginTop: 10 }}>
        Recalls, rule changes and test results, checked against what you’ve scanned and bought. Only matches reach Today.
      </Body>

      <Eyebrow style={{ marginTop: 22, marginBottom: 10 }}>For you</Eyebrow>
      {mine.length === 0 ? (
        <Card>
          <Body style={{ fontSize: 13.5 }}>Nothing touches what you’ve bought right now.</Body>
        </Card>
      ) : (
        mine.map((i) => (
          <Item key={i.id} item={i} open={openId === i.id} onToggle={() => setOpenId(openId === i.id ? null : i.id)} />
        ))
      )}

      <Eyebrow style={{ marginTop: 22, marginBottom: 4 }}>This week</Eyebrow>
      <ToggleRow title="Weekly digest" meta="Rule changes and test results that don’t match anything you bought" value={digest} onChange={setDigest} />
      {digest &&
        week.map((i) => (
          <Item key={i.id} item={i} open={openId === i.id} onToggle={() => setOpenId(openId === i.id ? null : i.id)} />
        ))}

      <Eyebrow style={{ marginTop: 22, marginBottom: 10 }}>What we watch for you</Eyebrow>
      <Card style={{ paddingVertical: 4 }}>
        {watchList.length === 0 ? (
          <Body style={{ fontSize: 13.5, paddingVertical: 10 }}>
            Scan a label and say you bought it, or snap a receipt. Those products get checked against every recall.
          </Body>
        ) : (
          watchList.map((w, i) => (
            <View key={w.id} style={[st.watch, i === 0 && { borderTopWidth: 0 }]}>
              <View style={{ flex: 1 }}>
                <Text style={st.watchName}>{w.name}</Text>
                <Text style={st.watchMeta}>
                  {w.brand} · {w.addedFrom}
                </Text>
              </View>
              <TouchableOpacity onPress={() => removeWatch(w.id)} accessibilityLabel={`Stop watching ${w.name}`}>
                <Text style={st.remove}>Remove</Text>
              </TouchableOpacity>
            </View>
          ))
        )}
      </Card>
    </Screen>
  );
}

const st = StyleSheet.create({
  item: { marginBottom: 9 },
  itemRecall: { borderColor: 'rgba(252,211,77,0.35)' },
  itemTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  kind: { fontFamily: Typography.headingBold, fontSize: 9.5, fontWeight: '700', letterSpacing: 1.4, color: Colors.teal },
  evidence: { fontFamily: Typography.body, fontSize: 11, color: Colors.tx3 },
  title: { fontFamily: Typography.headingBold, fontSize: 15, fontWeight: '600', color: Colors.tx, marginTop: 6, lineHeight: 20 },
  match: { fontFamily: Typography.body, fontSize: 12, color: Colors.amber, marginTop: 5 },
  lots: { backgroundColor: Colors.bg, borderRadius: 10, padding: 10 },
  lotsLbl: { fontFamily: Typography.headingBold, fontSize: 9.5, fontWeight: '700', letterSpacing: 1.2, color: Colors.tx3 },
  lotsTxt: { fontFamily: Typography.body, fontSize: 14, color: Colors.tx, marginTop: 4, letterSpacing: 0.5 },
  action: { borderLeftWidth: 2, borderLeftColor: Colors.lime, paddingLeft: 10 },
  actionLbl: { fontFamily: Typography.headingBold, fontSize: 9.5, fontWeight: '700', letterSpacing: 1.2, color: Colors.lime },
  actionTxt: { fontFamily: Typography.body, fontSize: 13.5, color: Colors.tx, marginTop: 3, lineHeight: 19 },
  src: { fontFamily: Typography.body, fontSize: 12, color: Colors.tx3 },
  watch: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 11, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.border },
  watchName: { fontFamily: Typography.bodyMedium, fontSize: 14, fontWeight: '500', color: Colors.tx },
  watchMeta: { fontFamily: Typography.body, fontSize: 11.5, color: Colors.tx3, marginTop: 2 },
  remove: { fontFamily: Typography.body, fontSize: 12.5, color: Colors.coral },
});
