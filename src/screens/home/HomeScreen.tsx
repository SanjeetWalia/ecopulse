// src/screens/home/HomeScreen.tsx
// Full implementation coming in the next build phase
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors, Typography } from '../../constants/theme';
import { useAuthStore } from '../../lib/authStore';

export default function HomeScreen({ navigation }: any) {
  const { profile } = useAuthStore();
  return (
    <View style={s.c}>
      <Text style={s.wm}>eco<Text style={s.acc}>pulse</Text></Text>
      <Text style={s.hi}>Hey {profile?.full_name?.split(' ')[0] ?? 'there'} 👋</Text>
      <Text style={s.sub}>Home screen coming next build phase.</Text>
      <Text style={s.hint}>Auth is fully wired — you're signed in! ✓</Text>
    </View>
  );
}
const s = StyleSheet.create({
  c: { flex:1, backgroundColor:Colors.bg, justifyContent:'center', alignItems:'center', gap:12 },
  wm: { fontFamily: Typography.heading, fontSize:28, color:Colors.tx },
  acc: { color:Colors.lime },
  hi: { fontFamily: Typography.heading, fontSize:22, color:Colors.tx },
  sub: { fontFamily: Typography.body, fontSize:14, color:Colors.tx2 },
  hint: { fontFamily: Typography.headingBold, fontSize:13, color:Colors.lime },
});
