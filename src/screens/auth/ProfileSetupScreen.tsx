import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, KeyboardAvoidingView, Platform, ActivityIndicator, Alert, ScrollView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Typography, Spacing, Radius } from '../../constants/theme';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../lib/authStore';
export default function ProfileSetupScreen({ navigation }: any) {
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const { fetchProfile } = useAuthStore();
  const handleComplete = async () => {
    if (!fullName.trim()) { Alert.alert('Add your name', 'We need your name.'); return; }
    if (username.length < 3) { Alert.alert('Choose a username', 'At least 3 characters.'); return; }
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }
    const { error } = await supabase.from('profiles').upsert({ id: user.id, full_name: fullName.trim(), username: username.toLowerCase().trim(), updated_at: new Date().toISOString() });
    setLoading(false);
    if (error) Alert.alert('Error', error.message);
    else await fetchProfile(user.id);
  };
  return (
    <KeyboardAvoidingView style={s.c} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
        <Text style={s.emoji}>🌿</Text>
        <Text style={s.title}>Set up your profile</Text>
        <Text style={s.sub}>How your friends will find you</Text>
        <Text style={s.label}>YOUR NAME</Text>
        <TextInput style={s.input} placeholder="Jordan Park" placeholderTextColor={Colors.tx3} value={fullName} onChangeText={setFullName} autoCapitalize="words" />
        <Text style={s.label}>USERNAME</Text>
        <View style={s.row}><Text style={s.at}>@</Text><TextInput style={s.uInput} placeholder="jordanpark" placeholderTextColor={Colors.tx3} value={username} onChangeText={(t) => setUsername(t.toLowerCase().replace(/[^a-z0-9_]/g,''))} autoCapitalize="none" /></View>
        <TouchableOpacity style={s.btn} onPress={handleComplete} disabled={loading} activeOpacity={0.85}>
          <LinearGradient colors={[Colors.lime, Colors.lime2]} start={{x:0,y:0}} end={{x:1,y:0}} style={s.grad}>
            {loading ? <ActivityIndicator color="#071810" /> : <Text style={s.btnTxt}>Start tracking 🌿</Text>}
          </LinearGradient>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
const s = StyleSheet.create({
  c:{flex:1,backgroundColor:Colors.bg}, scroll:{flexGrow:1,padding:Spacing.xxl,paddingTop:80},
  emoji:{fontSize:48,textAlign:'center',marginBottom:Spacing.md},
  title:{fontFamily:Typography.heading,fontSize:26,color:Colors.tx,textAlign:'center',marginBottom:Spacing.sm},
  sub:{fontFamily:Typography.body,fontSize:14,color:Colors.tx2,textAlign:'center',marginBottom:Spacing.xxxl},
  label:{fontFamily:Typography.headingMedium,fontSize:11,color:Colors.tx3,textTransform:'uppercase',letterSpacing:0.8,marginBottom:Spacing.xs},
  input:{backgroundColor:Colors.sf,borderWidth:0.5,borderColor:Colors.border,borderRadius:Radius.md,paddingVertical:13,paddingHorizontal:Spacing.md,fontSize:15,color:Colors.tx,fontFamily:Typography.body,marginBottom:Spacing.lg},
  row:{flexDirection:'row',alignItems:'center',backgroundColor:Colors.sf,borderWidth:0.5,borderColor:Colors.border,borderRadius:Radius.md,paddingHorizontal:Spacing.md,marginBottom:Spacing.xxxl},
  at:{fontFamily:Typography.headingBold,fontSize:16,color:Colors.tx3,marginRight:4},
  uInput:{flex:1,paddingVertical:13,fontSize:15,color:Colors.tx,fontFamily:Typography.body},
  btn:{borderRadius:Radius.xl,overflow:'hidden'},
  grad:{paddingVertical:16,alignItems:'center'},
  btnTxt:{fontFamily:Typography.headingBold,fontSize:16,color:'#071810'},
});
