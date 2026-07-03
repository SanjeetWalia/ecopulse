import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors, Typography } from '../../constants/theme';

export default function AirScreen() {
  return (
    <View style={s.c}>
      <Text style={s.title}>Air</Text>
      <Text style={s.sub}>Where your number comes from — B4</Text>
    </View>
  );
}
const s = StyleSheet.create({
  c: { flex: 1, backgroundColor: Colors.bg, justifyContent: 'center', alignItems: 'center', gap: 8 },
  title: { fontFamily: Typography.heading, fontSize: 22, color: Colors.tx },
  sub: { fontFamily: Typography.body, fontSize: 13, color: Colors.tx2 },
});
