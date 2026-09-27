// src/components/PulseTimeline.tsx
//
// Past → present → future, for air given back and money saved
// (artifact "Pulse Timeline", decided Sept 2026).
//   • Solid line: what happened, week by week.
//   • Today marker.
//   • Two dashed projections: as you are, and with your plan.
//   • A band that widens with distance, because the future is less certain.
//   • Two charts on one shared timeline, never a dual axis.
//   • A tip moves only the line it can prove: a money tip never lifts the
//     air line unless it saves air too.

import React from 'react';
import { View, Text, StyleSheet, useWindowDimensions } from 'react-native';
import Svg, { Path, Line, Circle, Text as SvgText } from 'react-native-svg';
import { Colors, Typography } from '../constants/theme';

interface Series {
  past: number[];
  asYouAre: number;
  withPlan: number;
  unit: string;
  totalPast: number;
}

function Chart({
  s,
  color,
  label,
  weeksFuture,
  width,
  showAxis,
}: {
  s: Series;
  color: string;
  label: string;
  weeksFuture: number;
  width: number;
  showAxis: boolean;
}) {
  const H = 118;
  const top = 14;
  const bottom = showAxis ? 22 : 8;
  const left = 4;
  const right = 86; // room for end labels
  const n = s.past.length + weeksFuture;
  const plotW = width - left - right;
  const x = (i: number) => left + (i / (n - 1)) * plotW;
  const maxV = Math.max(...s.past, s.withPlan * 1.25) * 1.05;
  const y = (v: number) => top + (1 - v / maxV) * (H - top - bottom);

  const t0 = s.past.length - 1;
  const last = s.past[t0];
  const pastPath = s.past.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(' ');
  const proj = (target: number) => {
    const pts: string[] = [];
    for (let k = 0; k <= weeksFuture; k++) {
      const v = last + ((target - last) * k) / weeksFuture;
      pts.push(`${k ? 'L' : 'M'}${x(t0 + k).toFixed(1)} ${y(v).toFixed(1)}`);
    }
    return pts.join(' ');
  };
  // Band around the plan line, widening to ±25% at the far end.
  const band = (() => {
    const up: string[] = [];
    const dn: string[] = [];
    for (let k = 0; k <= weeksFuture; k++) {
      const v = last + ((s.withPlan - last) * k) / weeksFuture;
      const spread = v * 0.25 * (k / weeksFuture);
      up.push(`${x(t0 + k).toFixed(1)} ${y(v + spread).toFixed(1)}`);
      dn.unshift(`${x(t0 + k).toFixed(1)} ${y(Math.max(0, v - spread)).toFixed(1)}`);
    }
    return `M${up.join(' L')} L${dn.join(' L')} Z`;
  })();

  const fmt = (v: number) => (s.unit === '$' ? `$${v.toFixed(0)}` : `${v.toFixed(0)} lb`);
  let yPlan = y(s.withPlan);
  let yAs = y(s.asYouAre);
  if (Math.abs(yPlan - yAs) < 22) {
    const mid = (yPlan + yAs) / 2;
    yPlan = mid - 11;
    yAs = mid + 11;
  }

  return (
    <View>
      <View style={st.chartHead}>
        <View style={[st.key, { backgroundColor: color }]} />
        <Text style={st.chartLabel}>{label}</Text>
        <Text style={st.chartTotal}>
          {s.unit === '$' ? `$${s.totalPast}` : `${s.totalPast} lb`} so far
        </Text>
      </View>
      <Svg width={width} height={H}>
        <Line x1={left} x2={width - right} y1={H - bottom} y2={H - bottom} stroke="rgba(240,250,244,0.12)" strokeWidth={1} />
        <Path d={band} fill={color} fillOpacity={0.1} />
        <Path d={pastPath} stroke={color} strokeWidth={2} fill="none" strokeLinejoin="round" strokeLinecap="round" />
        <Path d={proj(s.asYouAre)} stroke={color} strokeOpacity={0.5} strokeWidth={1.5} strokeDasharray="3 4" fill="none" />
        <Path d={proj(s.withPlan)} stroke={color} strokeWidth={2} strokeDasharray="6 4" fill="none" />
        <Line x1={x(t0)} x2={x(t0)} y1={top - 6} y2={H - bottom} stroke="rgba(240,250,244,0.35)" strokeWidth={1} />
        <Circle cx={x(t0)} cy={y(last)} r={4} fill={color} stroke={Colors.bg} strokeWidth={2} />
        <SvgText x={width - right + 6} y={yPlan + 4} fontSize={10.5} fill={Colors.tx}>
          {`${fmt(s.withPlan)}/wk`}
        </SvgText>
        <SvgText x={width - right + 6} y={yPlan + 16} fontSize={9} fill={Colors.tx3}>
          with your plan
        </SvgText>
        <SvgText x={width - right + 6} y={yAs + 4} fontSize={10.5} fill={Colors.tx2}>
          {`${fmt(s.asYouAre)}/wk`}
        </SvgText>
        <SvgText x={width - right + 6} y={yAs + 16} fontSize={9} fill={Colors.tx3}>
          as you are
        </SvgText>
        {showAxis && (
          <>
            <SvgText x={x(0)} y={H - 6} fontSize={9} fill={Colors.tx3}>
              12 wks ago
            </SvgText>
            <SvgText x={x(t0)} y={H - 6} fontSize={9} fill={Colors.tx2} textAnchor="middle">
              today
            </SvgText>
            <SvgText x={x(n - 1)} y={H - 6} fontSize={9} fill={Colors.tx3} textAnchor="end">
              in 12 wks
            </SvgText>
          </>
        )}
      </Svg>
    </View>
  );
}

export default function PulseTimeline({
  air,
  money,
  weeksFuture,
}: {
  air: Series;
  money: Series;
  weeksFuture: number;
}) {
  const { width } = useWindowDimensions();
  const w = Math.min(width - 36, 420);
  return (
    <View style={st.wrap}>
      <Text style={st.title}>PAST · TODAY · AHEAD</Text>
      <Chart s={air} color={Colors.lime} label="Air given back" weeksFuture={weeksFuture} width={w - 28} showAxis={false} />
      <View style={{ height: 10 }} />
      <Chart s={money} color={Colors.sky} label="Money saved" weeksFuture={weeksFuture} width={w - 28} showAxis />
      <Text style={st.note}>
        Solid is what happened. Dashed is where you’re heading, as you are and with your plan. A tip only moves the line it
        can prove.
      </Text>
    </View>
  );
}

const st = StyleSheet.create({
  wrap: { backgroundColor: Colors.bg2, borderWidth: 1, borderColor: Colors.border, borderRadius: 16, padding: 14, marginTop: 16 },
  title: { fontFamily: Typography.headingBold, fontSize: 9.5, fontWeight: '700', letterSpacing: 1.8, color: Colors.tx3, marginBottom: 10 },
  chartHead: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 2 },
  key: { width: 12, height: 3, borderRadius: 2 },
  chartLabel: { flex: 1, fontFamily: Typography.bodyMedium, fontSize: 13, fontWeight: '500', color: Colors.tx },
  chartTotal: { fontFamily: Typography.body, fontSize: 12, color: Colors.tx2 },
  note: { fontFamily: Typography.body, fontSize: 11.5, color: Colors.tx3, marginTop: 10, lineHeight: 16 },
});
