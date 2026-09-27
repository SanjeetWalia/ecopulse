// src/screens/onboarding/OnboardingQuizScreen.tsx
//
// Six questions, one at a time, under a minute (claude/ONBOARDING-PLAN.md).
// Each answer is a stated fact: the backend phase writes them to user_facts
// with origin = 'stated', so they show up in You → What Eco Pulse remembers.

import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TextInput } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Colors, Typography } from '../../constants/theme';
import { Screen, Button, Chip, Body } from '../../components/kit';
import { useGrowthStore } from '../../lib/growthStore';
import { OnboardingAnswers, visibleQuestions } from '../../lib/plan';

export default function OnboardingQuizScreen({ navigation }: any) {
  const answers = useGrowthStore((s) => s.answers);
  const setAnswer = useGrowthStore((s) => s.setAnswer);
  const finishOnboarding = useGrowthStore((s) => s.finishOnboarding);
  const [step, setStep] = useState(0);

  const questions = useMemo(() => visibleQuestions(answers), [answers]);
  const q = questions[Math.min(step, questions.length - 1)];
  const value = answers[q.key] as string | undefined;
  const extra = q.extraInput ? (answers[q.extraInput.key] as string | undefined) : undefined;

  const canContinue = q.input ? true : !!value;
  const isLast = step >= questions.length - 1;

  const next = () => {
    Haptics.selectionAsync().catch(() => {});
    if (isLast) {
      finishOnboarding();
      navigation.replace('StartingPlan');
    } else {
      setStep((n) => n + 1);
    }
  };

  const pick = (v: string) => {
    Haptics.selectionAsync().catch(() => {});
    setAnswer(q.key, v as any);
  };

  return (
    <Screen
      onBack={step > 0 ? () => setStep((n) => n - 1) : undefined}
      title={`${step + 1} of ${questions.length}`}
      footer={
        <>
          <Button label={isLast ? 'See my plan' : 'Continue'} onPress={next} disabled={!canContinue} />
          {q.input?.optional && !value && <Button kind="ghost" label="Skip" onPress={next} />}
        </>
      }
    >
      <View style={st.progress}>
        {questions.map((_, i) => (
          <View key={i} style={[st.pip, i <= step && st.pipOn]} />
        ))}
      </View>

      <Text style={st.q}>{q.title}</Text>

      {q.options && (
        <View style={st.opts}>
          {q.options.map((o) => (
            <Chip key={o.value} label={o.label} on={value === o.value} onPress={() => pick(o.value)} style={st.opt} />
          ))}
        </View>
      )}

      {q.input && (
        <TextInput
          style={st.input}
          placeholder={q.input.placeholder}
          placeholderTextColor={Colors.tx3}
          value={value ?? ''}
          onChangeText={(t) => setAnswer(q.key, t as any)}
          autoCapitalize="words"
          returnKeyType="next"
          onSubmitEditing={next}
        />
      )}

      {q.extraInput && (
        <TextInput
          style={[st.input, { marginTop: 14 }]}
          placeholder={q.extraInput.placeholder}
          placeholderTextColor={Colors.tx3}
          value={extra ?? ''}
          onChangeText={(t) => setAnswer(q.extraInput!.key as keyof OnboardingAnswers, t as any)}
          autoCapitalize="words"
        />
      )}

      <Body muted style={st.why}>
        {q.why}
      </Body>
    </Screen>
  );
}

const st = StyleSheet.create({
  progress: { flexDirection: 'row', gap: 5, marginTop: 6, marginBottom: 30 },
  pip: { flex: 1, height: 3, borderRadius: 2, backgroundColor: Colors.sf2 },
  pipOn: { backgroundColor: Colors.lime },
  q: { fontFamily: Typography.heading, fontSize: 28, fontWeight: '700', color: Colors.tx, letterSpacing: -0.6, lineHeight: 33, marginBottom: 22 },
  opts: { gap: 10 },
  opt: { paddingVertical: 15, paddingHorizontal: 18, borderRadius: 14 },
  input: {
    backgroundColor: Colors.bg2,
    borderWidth: 1,
    borderColor: Colors.border2,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 15,
    fontFamily: Typography.body,
    fontSize: 16,
    color: Colors.tx,
  },
  why: { marginTop: 22, fontSize: 13.5 },
});
