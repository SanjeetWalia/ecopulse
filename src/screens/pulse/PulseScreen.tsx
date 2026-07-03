import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors, Typography } from '../../constants/theme';

export default function PulseScreen() {
  return (
    <View style={s.c}>
      <Text style={s.title}>Pulse</Text>
      <Text style={s.sub}>Your number through time — B5</Text>
    </View>
  );
}
const s = StyleSheet.create({
  c: { flex: 1, backgroundColor: Colors.bg, justifyContent: 'center', alignItems: 'center', gap: 8 },
  title: { fontFamily: Typography.heading, fontSize: 22, color: Colors.tx },
  sub: { fontFamily: Typography.body, fontSize: 13, color: Colors.tx2 },
});
