// src/screens/snap/Reads.tsx
//
// One component per camera read (claude/CAMERA-READS.md). The AI decides what
// the snap is; each read opens on the green number, then does what the
// single-purpose apps do, then asks only what it couldn't read or what only
// the user can choose, pre-filled with its best guess.
//
// Rules carried by every read:
//   • One unit: lb. Estimates are ranges; guesses are marked.
//   • Facts come from the sourced library. When there's no sourced fact, the
//     row is left out rather than written by the model.
//   • No health advice, no "toxic", no allergen safety calls.

import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity } from 'react-native';
import { Colors, Typography } from '../../constants/theme';
import { Card, Chip, Eyebrow, FactRow, ToggleRow, Body } from '../../components/kit';
import { MealItem, SnapKind, KIND_LABEL, SAMPLE_GENERIC } from '../../lib/sample';
import { mpgFor } from '../../lib/plan';
import { useGrowthStore } from '../../lib/growthStore';

const LB_PER_KG = 2.20462;
const TYPICAL_DAY_LB = 28.6 * LB_PER_KG;

// ---- shared -----------------------------------------------------------------

export function KindBanner({ kind, onChange }: { kind: SnapKind; onChange: (k: SnapKind) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <View style={st.kind}>
      <View style={st.kindRow}>
        <View style={st.kindDot} />
        <Text style={st.kindTxt}>
          Looks like <Text style={{ color: Colors.tx }}>{KIND_LABEL[kind]}</Text>
        </Text>
        <TouchableOpacity onPress={() => setOpen((o) => !o)} accessibilityRole="button">
          <Text style={st.kindChange}>{open ? 'Done' : 'Change'}</Text>
        </TouchableOpacity>
      </View>
      {open && (
        <View style={st.kindOpts}>
          {(Object.keys(KIND_LABEL) as SnapKind[]).map((k) => (
            <Chip
              key={k}
              label={KIND_LABEL[k].replace(/^(a|an|your|two) /, '')}
              on={k === kind}
              style={{ paddingVertical: 6, paddingHorizontal: 11 }}
              onPress={() => {
                onChange(k);
                setOpen(false);
              }}
            />
          ))}
        </View>
      )}
    </View>
  );
}

function BigNumber({ value, unit, line }: { value: string; unit: string; line?: string }) {
  return (
    <View style={{ marginTop: 4 }}>
      <View style={st.bigRow}>
        <Text style={st.big}>{value}</Text>
        <Text style={st.bigUnit}>{unit}</Text>
      </View>
      {!!line && <Text style={st.bigLine}>{line}</Text>}
    </View>
  );
}

function Bar({ frac, color = Colors.lime }: { frac: number; color?: string }) {
  return (
    <View style={st.barTrack}>
      <View style={[st.barFill, { width: `${Math.max(4, Math.min(100, frac * 100))}%`, backgroundColor: color }]} />
    </View>
  );
}

// ---- meal -------------------------------------------------------------------

export interface MealReadData {
  title: string;
  place?: string;
  items: MealItem[];
  good?: string | null;
  fewKnow?: string | null;
  catch?: string | null;
  tip?: { title: string; lb: number; usd: number | null; showFor: string[] } | null;
  source?: string;
}

export function mealTotals(d: MealReadData, picks: Record<string, string>) {
  let lb = 0;
  let kcalLo = 0;
  let kcalHi = 0;
  let protein = 0;
  let known = true;
  for (const it of d.items) {
    const opt = it.options?.find((o) => o.id === (picks[it.id] ?? it.optionId));
    lb += opt ? opt.lb : it.lb;
    if (it.kcal[1] > 0) {
      kcalLo += it.kcal[0];
      kcalHi += it.kcal[1];
    } else known = false;
    protein += it.proteinG;
  }
  return { lb, kcalLo, kcalHi, protein, kcalKnown: known && kcalHi > 0 };
}

export function MealRead({
  data,
  picks,
  onPick,
  tipOn,
  onTip,
}: {
  data: MealReadData;
  picks: Record<string, string>;
  onPick: (itemId: string, optionId: string) => void;
  tipOn: boolean;
  onTip: (v: boolean) => void;
}) {
  const car = useGrowthStore((s) => s.answers.car);
  const t = mealTotals(data, picks);
  const lbPerMile = (8.887 / mpgFor(car)) * LB_PER_KG;
  const miles = t.lb / lbPerMile;
  const pctDay = (t.lb / TYPICAL_DAY_LB) * 100;
  const maxItem = Math.max(...data.items.map((it) => it.options?.find((o) => o.id === (picks[it.id] ?? it.optionId))?.lb ?? it.lb), 0.1);
  const pickedPack = data.items.map((it) => picks[it.id] ?? it.optionId).filter(Boolean) as string[];
  const showTip = !!data.tip && pickedPack.some((p) => data.tip!.showFor.includes(p));

  return (
    <View>
      <Text style={st.title}>{data.title}</Text>
      <BigNumber
        value={t.lb.toFixed(1)}
        unit="lb CO₂e"
        line={`About ${miles.toFixed(1)} miles in your ${car ? car.split(' ').slice(-1)[0] : 'car'}, and about ${pctDay.toFixed(0)}% of a typical day.`}
      />

      <Eyebrow style={{ marginTop: 18, marginBottom: 8 }}>On the table</Eyebrow>
      {data.items.map((it) => {
        const chosen = picks[it.id] ?? it.optionId;
        const lb = it.options?.find((o) => o.id === chosen)?.lb ?? it.lb;
        return (
          <View key={it.id} style={st.item}>
            <View style={st.itemTop}>
              <Text style={st.itemName}>
                {it.name}
                {it.guess ? <Text style={st.guess}>  best guess</Text> : null}
              </Text>
              <Text style={st.itemLb}>{lb.toFixed(1)} lb</Text>
            </View>
            <Bar frac={lb / maxItem} />
            {it.options && (
              <View style={st.optRow}>
                {it.options.map((o) => (
                  <Chip
                    key={o.id}
                    label={o.label}
                    on={chosen === o.id}
                    onPress={() => onPick(it.id, o.id)}
                    style={{ paddingVertical: 6, paddingHorizontal: 12 }}
                  />
                ))}
              </View>
            )}
          </View>
        );
      })}

      {t.kcalKnown && (
        <View style={st.nutri}>
          <Text style={st.nutriTxt}>
            {t.kcalLo}–{t.kcalHi} kcal · {t.protein} g protein
            {t.protein > 0 ? ` · ${(t.protein / Math.max(t.lb, 0.1)).toFixed(0)} g protein per lb of CO₂e` : ''}
          </Text>
        </View>
      )}

      {(data.good || data.fewKnow || data.catch) && (
        <View style={{ marginTop: 14 }}>
          {!!data.good && <FactRow label="The good">{data.good}</FactRow>}
          {!!data.fewKnow && <FactRow label="Few know" color={Colors.teal}>{data.fewKnow}</FactRow>}
          {!!data.catch && <FactRow label="The catch" color={Colors.amber}>{data.catch}</FactRow>}
          {!!data.source && <Text style={st.source}>Source: {data.source}</Text>}
        </View>
      )}

      {showTip && data.tip && (
        <Card accent style={{ marginTop: 14, paddingVertical: 6 }}>
          <Eyebrow color={Colors.lime} style={{ marginTop: 6 }}>
            Next time
          </Eyebrow>
          <ToggleRow
            title={data.tip.title}
            meta={`−${data.tip.lb.toFixed(1)} lb a pint · add to your plan`}
            value={tipOn}
            onChange={onTip}
          />
        </Card>
      )}
    </View>
  );
}

// ---- menu -------------------------------------------------------------------

export interface MenuReadData {
  restaurant: string;
  dishes: { id: string; name: string; lb: number; kcal: [number, number]; price?: number; lighter?: boolean }[];
  usualLb: number;
}

export function MenuRead({
  data,
  chosen,
  onChoose,
  restaurant,
  onRestaurant,
}: {
  data: MenuReadData;
  chosen: string | null;
  onChoose: (id: string) => void;
  restaurant: string;
  onRestaurant: (t: string) => void;
}) {
  const max = Math.max(...data.dishes.map((d) => d.lb));
  const lighter = data.dishes.filter((d) => d.lighter).length;
  return (
    <View>
      <Text style={st.title}>{lighter} lighter picks on this menu</Text>
      <Body style={{ marginTop: 4 }}>Compared with what you usually order ({data.usualLb.toFixed(1)} lb).</Body>

      <Eyebrow style={{ marginTop: 18, marginBottom: 8 }}>Which are you thinking of?</Eyebrow>
      {data.dishes.map((d) => {
        const on = chosen === d.id;
        const diff = d.lb - data.usualLb;
        return (
          <TouchableOpacity key={d.id} onPress={() => onChoose(d.id)} activeOpacity={0.8} style={[st.dish, on && st.dishOn]}>
            <View style={st.itemTop}>
              <Text style={st.itemName}>
                {d.name}
                {d.lighter ? <Text style={st.lighter}>  lighter</Text> : null}
              </Text>
              <Text style={st.itemLb}>{d.lb.toFixed(1)} lb</Text>
            </View>
            <Bar frac={d.lb / max} color={d.lighter ? Colors.lime : Colors.tx3} />
            <Text style={st.dishMeta}>
              {d.kcal[0]}–{d.kcal[1]} kcal{d.price ? ` · $${d.price}` : ''} ·{' '}
              {diff <= 0 ? `${Math.abs(diff).toFixed(1)} lb under your usual` : `${diff.toFixed(1)} lb over your usual`}
            </Text>
          </TouchableOpacity>
        );
      })}

      <Eyebrow style={{ marginTop: 16, marginBottom: 8 }}>Where are you?</Eyebrow>
      <TextInput style={st.input} value={restaurant} onChangeText={onRestaurant} placeholderTextColor={Colors.tx3} placeholder="Restaurant" />
    </View>
  );
}

// ---- label ------------------------------------------------------------------

export interface LabelReadData {
  brand: string;
  product: string;
  size: string;
  lb: number;
  packaging: string;
  facts: { label: string; text: string }[];
  nutrition: { kcal: number; proteinG: number; sugarG: number; per: string };
  source: string;
}

export function LabelRead({
  data,
  fields,
  onField,
  bought,
  onBought,
}: {
  data: LabelReadData;
  fields: { brand: string; product: string; size: string };
  onField: (k: 'brand' | 'product' | 'size', v: string) => void;
  bought: boolean | null;
  onBought: (v: boolean) => void;
}) {
  return (
    <View>
      <Text style={st.title}>{fields.product}</Text>
      <BigNumber value={data.lb.toFixed(1)} unit="lb CO₂e" line={`Including the pack. ${data.packaging}.`} />

      <Eyebrow style={{ marginTop: 16, marginBottom: 6 }}>We read this from the pack</Eyebrow>
      <View style={st.fields}>
        {(['brand', 'product', 'size'] as const).map((k) => (
          <View key={k} style={st.field}>
            <Text style={st.fieldLbl}>{k}</Text>
            <TextInput style={st.fieldInput} value={fields[k]} onChangeText={(v) => onField(k, v)} placeholderTextColor={Colors.tx3} />
          </View>
        ))}
      </View>

      <View style={{ marginTop: 12 }}>
        {data.facts.map((f) => (
          <FactRow key={f.label} label={f.label} color={Colors.teal}>
            {f.text}
          </FactRow>
        ))}
        <FactRow label="Nutrition">
          {data.nutrition.kcal} kcal, {data.nutrition.proteinG} g protein, {data.nutrition.sugarG} g sugar {data.nutrition.per}
        </FactRow>
        <Text style={st.source}>Source: {data.source}</Text>
      </View>

      <Eyebrow style={{ marginTop: 16, marginBottom: 8 }}>Did you buy it?</Eyebrow>
      <View style={st.optRow}>
        <Chip label="Yes" on={bought === true} onPress={() => onBought(true)} />
        <Chip label="Just looking" on={bought === false} onPress={() => onBought(false)} />
      </View>
      {bought === true && <Text style={st.note}>Added to Heads up. If it’s ever recalled, you’ll hear first.</Text>}
    </View>
  );
}

// ---- shelf ------------------------------------------------------------------

export interface ShelfReadData {
  a: { name: string; lb: number; usdPerUnit: number; unit: string; kcal: number; proteinG: number };
  b: { name: string; lb: number; usdPerUnit: number; unit: string; kcal: number; proteinG: number };
}

export function ShelfRead({ data, pick, onPick }: { data: ShelfReadData; pick: 'a' | 'b' | null; onPick: (p: 'a' | 'b') => void }) {
  const lighter = data.a.lb <= data.b.lb ? 'a' : 'b';
  const diff = Math.abs(data.a.lb - data.b.lb);
  const col = (k: 'a' | 'b') => {
    const p = data[k];
    return (
      <TouchableOpacity key={k} onPress={() => onPick(k)} activeOpacity={0.85} style={[st.shelfCol, pick === k && st.dishOn]}>
        {lighter === k && <Text style={st.lighter}>gives back more</Text>}
        <Text style={[st.itemName, { marginTop: 4 }]}>{p.name}</Text>
        <Text style={[st.big, { fontSize: 30 }, lighter !== k && { color: Colors.tx2 }]}>{p.lb.toFixed(1)}</Text>
        <Text style={st.bigUnit}>lb CO₂e</Text>
        <Text style={st.dishMeta}>${p.usdPerUnit.toFixed(2)} per {p.unit}</Text>
        <Text style={st.dishMeta}>
          {p.kcal} kcal · {p.proteinG} g protein
        </Text>
      </TouchableOpacity>
    );
  };
  return (
    <View>
      <Text style={st.title}>
        {data[lighter].name} gives back {diff.toFixed(1)} lb more
      </Text>
      <Body style={{ marginTop: 4 }}>Per carton. Price and nutrition underneath, so you can weigh it your way.</Body>
      <View style={st.shelf}>{[col('a'), col('b')]}</View>
      <Eyebrow style={{ marginTop: 16, marginBottom: 8 }}>Which one did you pick?</Eyebrow>
      <View style={st.optRow}>
        <Chip label={data.a.name} on={pick === 'a'} onPress={() => onPick('a')} />
        <Chip label={data.b.name} on={pick === 'b'} onPress={() => onPick('b')} />
      </View>
      {pick && <Text style={st.note}>Noted. Eco Pulse learns what you trade off, and stops suggesting swaps you don’t want.</Text>}
    </View>
  );
}

// ---- receipt ----------------------------------------------------------------

export interface ReceiptReadData {
  store: string;
  totalUsd: number;
  lines: { cat: string; lb: number; usd: number }[];
  swap: { text: string; lb: number; usd: number };
}

export function ReceiptRead({ data, swapOn, onSwap }: { data: ReceiptReadData; swapOn: boolean; onSwap: (v: boolean) => void }) {
  const total = data.lines.reduce((t, l) => t + l.lb, 0);
  const max = Math.max(...data.lines.map((l) => l.lb));
  const sorted = [...data.lines].sort((a, b) => b.lb - a.lb);
  return (
    <View>
      <Text style={st.title}>{data.store} basket</Text>
      <BigNumber value={total.toFixed(0)} unit="lb CO₂e" line={`$${data.totalUsd.toFixed(2)} spent. ${sorted[0].cat} is ${Math.round((sorted[0].lb / total) * 100)}% of the footprint and ${Math.round((sorted[0].usd / data.totalUsd) * 100)}% of the bill.`} />
      <Eyebrow style={{ marginTop: 16, marginBottom: 8 }}>By category</Eyebrow>
      {sorted.map((l) => (
        <View key={l.cat} style={st.item}>
          <View style={st.itemTop}>
            <Text style={st.itemName}>{l.cat}</Text>
            <Text style={st.itemLb}>
              {l.lb.toFixed(1)} lb · ${l.usd.toFixed(0)}
            </Text>
          </View>
          <Bar frac={l.lb / max} />
        </View>
      ))}
      <Card accent style={{ marginTop: 14, paddingVertical: 6 }}>
        <Eyebrow color={Colors.lime} style={{ marginTop: 6 }}>
          Next shop
        </Eyebrow>
        <ToggleRow title={data.swap.text} meta={`−${data.swap.lb} lb · ${data.swap.usd < 0 ? `−$${Math.abs(data.swap.usd)}` : 'about even'} · add to your plan`} value={swapOn} onChange={onSwap} />
      </Card>
      <Text style={st.note}>The products on this receipt join what Heads up watches for recalls.</Text>
    </View>
  );
}

// ---- bill, fuel, fridge, tag, bin -----------------------------------------------

export function GenericRead({ kind }: { kind: 'bill' | 'fuel' | 'fridge' | 'tag' | 'bin' }) {
  const d = SAMPLE_GENERIC[kind];
  return (
    <View>
      <Text style={st.title}>{d.title}</Text>
      <BigNumber value={d.value} unit={d.unit} line={d.line} />
      <View style={{ marginTop: 14 }}>
        {d.rows.map((r) => (
          <FactRow key={r.label} label={r.label}>
            {r.text}
          </FactRow>
        ))}
      </View>
      {!!d.asks && <Text style={[st.note, { color: Colors.tx2 }]}>{d.asks}</Text>}
    </View>
  );
}

export function useMealPicks(initial: MealReadData | null) {
  const [picks, setPicks] = useState<Record<string, string>>({});
  const total = useMemo(() => (initial ? mealTotals(initial, picks).lb : 0), [initial, picks]);
  return { picks, setPick: (id: string, o: string) => setPicks((p) => ({ ...p, [id]: o })), total, reset: () => setPicks({}) };
}

const st = StyleSheet.create({
  kind: { backgroundColor: Colors.bg2, borderWidth: 1, borderColor: Colors.border, borderRadius: 14, padding: 11, marginTop: 12, gap: 10 },
  kindRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  kindDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: Colors.teal },
  kindTxt: { flex: 1, fontFamily: Typography.body, fontSize: 13.5, color: Colors.tx2 },
  kindChange: { fontFamily: Typography.headingBold, fontSize: 12.5, fontWeight: '700', color: Colors.teal },
  kindOpts: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },

  title: { fontFamily: Typography.heading, fontSize: 21, fontWeight: '700', color: Colors.tx, letterSpacing: -0.4, marginTop: 16, lineHeight: 26 },
  bigRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  big: { fontFamily: Typography.heading, fontSize: 46, fontWeight: '700', color: Colors.lime, letterSpacing: -1.5 },
  bigUnit: { fontFamily: Typography.body, fontSize: 14, color: Colors.tx2 },
  bigLine: { fontFamily: Typography.body, fontSize: 13.5, color: Colors.tx2, lineHeight: 19, marginTop: 2 },

  item: { paddingVertical: 9, gap: 6, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.border },
  itemTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 10 },
  itemName: { flexShrink: 1, fontFamily: Typography.bodyMedium, fontSize: 14.5, fontWeight: '500', color: Colors.tx },
  itemLb: { fontFamily: Typography.headingBold, fontSize: 13, fontWeight: '600', color: Colors.tx2 },
  guess: { fontFamily: Typography.body, fontSize: 11, color: Colors.amber, fontWeight: '400' },
  lighter: { fontFamily: Typography.headingBold, fontSize: 10, color: Colors.lime, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase' },
  optRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  barTrack: { height: 6, borderRadius: 3, backgroundColor: Colors.sf },
  barFill: { height: 6, borderRadius: 3 },

  nutri: { marginTop: 12, backgroundColor: Colors.bg2, borderRadius: 10, paddingHorizontal: 11, paddingVertical: 9 },
  nutriTxt: { fontFamily: Typography.body, fontSize: 12.5, color: Colors.tx2 },
  source: { fontFamily: Typography.body, fontSize: 11, color: Colors.tx3, marginTop: 6 },
  note: { fontFamily: Typography.body, fontSize: 12.5, color: Colors.tx3, marginTop: 10, lineHeight: 18 },

  dish: { padding: 11, borderRadius: 12, borderWidth: 1, borderColor: Colors.border, marginBottom: 7, gap: 6, backgroundColor: Colors.bg2 },
  dishOn: { borderColor: 'rgba(200,244,90,0.6)', backgroundColor: 'rgba(200,244,90,0.06)' },
  dishMeta: { fontFamily: Typography.body, fontSize: 11.5, color: Colors.tx3 },
  input: { backgroundColor: Colors.bg2, borderWidth: 1, borderColor: Colors.border2, borderRadius: 12, paddingHorizontal: 13, paddingVertical: 11, fontFamily: Typography.body, fontSize: 14.5, color: Colors.tx },

  fields: { borderWidth: 1, borderColor: Colors.border, borderRadius: 12, overflow: 'hidden' },
  field: { flexDirection: 'row', alignItems: 'center', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.border, paddingHorizontal: 12 },
  fieldLbl: { width: 64, fontFamily: Typography.headingBold, fontSize: 10, fontWeight: '700', letterSpacing: 1, color: Colors.tx3, textTransform: 'uppercase' },
  fieldInput: { flex: 1, paddingVertical: 10, fontFamily: Typography.body, fontSize: 14.5, color: Colors.tx },

  shelf: { flexDirection: 'row', gap: 10, marginTop: 14 },
  shelfCol: { flex: 1, padding: 12, borderRadius: 14, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.bg2, gap: 2 },
});
