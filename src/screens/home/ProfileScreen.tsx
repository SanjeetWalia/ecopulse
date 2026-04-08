// src/screens/home/ProfileScreen.tsx — Stub (full implementation next phase)
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Colors, Typography } from '../../constants/theme';
export default function ProfileScreen({ navigation }: any) {
  return (
    <View style={s.c}>
      <TouchableOpacity onPress={() => navigation.goBack()} style={s.back}>
        <Text style={s.backTxt}>← Back</Text>
      </TouchableOpacity>
      <Text style={s.title}>ProfileScreen</Text>
      <Text style={s.sub}>Coming in next build phase</Text>
    </View>
  );
}
const s = StyleSheet.create({
  c: { flex:1, backgroundColor:Colors.bg, justifyContent:'center', alignItems:'center', gap:12 },
  back: { position:'absolute', top:60, left:20 },
  backTxt: { fontFamily: Typography.headingBold, fontSize:14, color:Colors.lime },
  title: { fontFamily: Typography.heading, fontSize:22, color:Colors.tx },
  sub: { fontFamily: Typography.body, fontSize:13, color:Colors.tx2 },
});
