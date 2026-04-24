// src/screens/activity/EditActivityModal.tsx
//
// Modal for editing a single logged activity.
// Usage:
//   <EditActivityModal
//     visible={editingActivity !== null}
//     activity={editingActivity}
//     onClose={() => setEditingActivity(null)}
//     onSaved={() => { setEditingActivity(null); refetch(); }}
//   />
//
// Editable fields:
//   - label        (free text)
//   - category     (picker: transport / food / energy / digital / other)
//   - activity_type (picker: scoped to selected category)
//   - amount + unit (numeric + derived unit)
//   - co2_kg       (auto-recomputed from amount when amount or type changes)
//   - logged_at    (date + time picker)
//
// On Save: UPDATE into activities. Supabase trigger recomputes daily_summary.
// On Cancel: discard changes, close.

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Alert,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { supabase } from '../../lib/supabase';
import { Colors, Typography, Radius, Spacing } from '../../constants/theme';
import {
  CATEGORIES,
  ACTIVITY_TYPES,
  findActivityType,
  computeCo2,
  Category,
} from '../../constants/activityTypes';

interface Props {
  visible: boolean;
  activity: any | null;
  onClose: () => void;
  onSaved: () => void;
}

export default function EditActivityModal({ visible, activity, onClose, onSaved }: Props) {
  const [label, setLabel] = useState('');
  const [category, setCategory] = useState<Category>('other');
  const [activityType, setActivityType] = useState('custom');
  const [amount, setAmount] = useState('0');
  const [unit, setUnit] = useState('kg');
  const [co2Kg, setCo2Kg] = useState(0);
  const [loggedAt, setLoggedAt] = useState(new Date());

  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [saving, setSaving] = useState(false);

  // When the modal opens with a new activity, seed all fields from it
  useEffect(() => {
    if (!activity) return;
    setLabel(activity.label ?? '');
    setCategory(activity.category ?? 'other');
    setActivityType(activity.activity_type ?? 'custom');
    setAmount(String(activity.amount ?? 0));
    setUnit(activity.unit ?? 'kg');
    setCo2Kg(activity.co2_kg ?? 0);
    setLoggedAt(activity.logged_at ? new Date(activity.logged_at) : new Date());
  }, [activity]);

  // Recompute co2_kg whenever amount or activity type changes
  useEffect(() => {
    const numAmount = parseFloat(amount) || 0;
    const newCo2 = computeCo2(category, activityType, numAmount);
    setCo2Kg(newCo2);
  }, [amount, category, activityType]);

  // When category changes, snap activityType to a valid default for that category
  const handleCategoryChange = (newCat: Category) => {
    setCategory(newCat);
    const firstTypeInCategory = ACTIVITY_TYPES[newCat][0];
    setActivityType(firstTypeInCategory.key);
    setUnit(firstTypeInCategory.unit);
  };

  // When activityType changes within a category, update unit to match
  const handleTypeChange = (newType: string) => {
    setActivityType(newType);
    const def = findActivityType(category, newType);
    if (def) setUnit(def.unit);
  };

  const handleSave = async () => {
    if (!activity?.id) return;

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount < 0) {
      Alert.alert('Invalid amount', 'Please enter a positive number.');
      return;
    }
    if (!label.trim()) {
      Alert.alert('Missing label', 'Please enter a description for this activity.');
      return;
    }

    setSaving(true);
    const { error } = await supabase
      .from('activities')
      .update({
        label: label.trim(),
        category,
        activity_type: activityType,
        amount: numAmount,
        unit,
        co2_kg: co2Kg,
        logged_at: loggedAt.toISOString(),
      })
      .eq('id', activity.id);

    setSaving(false);

    if (error) {
      Alert.alert('Save failed', error.message);
      return;
    }

    onSaved();
  };

  if (!activity) return null;

  const typesForCategory = ACTIVITY_TYPES[category] ?? [];

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
      presentationStyle="overFullScreen"
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={s.backdrop}
      >
        <View style={s.sheet}>
          {/* Header */}
          <View style={s.header}>
            <TouchableOpacity onPress={onClose} style={s.headerBtn}>
              <Text style={s.cancelTxt}>Cancel</Text>
            </TouchableOpacity>
            <Text style={s.headerTitle}>Edit activity</Text>
            <TouchableOpacity
              onPress={handleSave}
              style={s.headerBtn}
              disabled={saving}
            >
              <Text style={[s.saveTxt, saving && { opacity: 0.5 }]}>
                {saving ? 'Saving…' : 'Save'}
              </Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={s.body} contentContainerStyle={{ paddingBottom: 40 }}>
            {/* Label */}
            <Text style={s.fieldLabel}>Description</Text>
            <TextInput
              style={s.textInput}
              value={label}
              onChangeText={setLabel}
              placeholder="e.g., biked 5 miles to work"
              placeholderTextColor={Colors.tx3}
            />

            {/* Category picker — horizontal scroll chips */}
            <Text style={s.fieldLabel}>Category</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 8 }}
              style={{ marginBottom: 16 }}
            >
              {CATEGORIES.map(c => {
                const selected = c.key === category;
                return (
                  <TouchableOpacity
                    key={c.key}
                    style={[s.chip, selected && s.chipActive]}
                    onPress={() => handleCategoryChange(c.key)}
                  >
                    <Text style={[s.chipTxt, selected && s.chipTxtActive]}>
                      {c.icon} {c.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* Activity type picker — horizontal scroll chips */}
            <Text style={s.fieldLabel}>Type</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 8 }}
              style={{ marginBottom: 16 }}
            >
              {typesForCategory.map(t => {
                const selected = t.key === activityType;
                return (
                  <TouchableOpacity
                    key={t.key}
                    style={[s.chip, selected && s.chipActive]}
                    onPress={() => handleTypeChange(t.key)}
                  >
                    <Text style={[s.chipTxt, selected && s.chipTxtActive]}>
                      {t.icon} {t.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* Amount + unit */}
            <Text style={s.fieldLabel}>Amount</Text>
            <View style={s.amountRow}>
              <TextInput
                style={[s.textInput, { flex: 1 }]}
                value={amount}
                onChangeText={setAmount}
                keyboardType="decimal-pad"
                placeholder="0"
                placeholderTextColor={Colors.tx3}
              />
              <View style={s.unitBadge}>
                <Text style={s.unitTxt}>{unit}</Text>
              </View>
            </View>

            {/* Computed CO2e (read-only display) */}
            <View style={s.co2Row}>
              <Text style={s.co2Label}>Computed CO₂e</Text>
              <Text style={s.co2Value}>{co2Kg.toFixed(2)} kg</Text>
            </View>

            {/* Logged at: date + time */}
            <Text style={s.fieldLabel}>When</Text>
            <View style={s.dateRow}>
              <TouchableOpacity
                style={s.dateBtn}
                onPress={() => setShowDatePicker(true)}
              >
                <Text style={s.dateBtnTxt}>
                  {loggedAt.toLocaleDateString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={s.dateBtn}
                onPress={() => setShowTimePicker(true)}
              >
                <Text style={s.dateBtnTxt}>
                  {loggedAt.toLocaleTimeString(undefined, {
                    hour: 'numeric',
                    minute: '2-digit',
                  })}
                </Text>
              </TouchableOpacity>
            </View>

            {showDatePicker && (
              <DateTimePicker
                value={loggedAt}
                mode="date"
                display="default"
                onChange={(_, d) => {
                  setShowDatePicker(Platform.OS === 'ios');
                  if (d) {
                    const next = new Date(loggedAt);
                    next.setFullYear(d.getFullYear(), d.getMonth(), d.getDate());
                    setLoggedAt(next);
                  }
                }}
              />
            )}
            {showTimePicker && (
              <DateTimePicker
                value={loggedAt}
                mode="time"
                display="default"
                onChange={(_, d) => {
                  setShowTimePicker(Platform.OS === 'ios');
                  if (d) {
                    const next = new Date(loggedAt);
                    next.setHours(d.getHours(), d.getMinutes(), 0, 0);
                    setLoggedAt(next);
                  }
                }}
              />
            )}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: Colors.bg,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
    paddingBottom: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  headerBtn: { padding: 4, minWidth: 60 },
  headerTitle: {
    fontFamily: Typography.headingBold,
    fontSize: 16,
    color: Colors.tx,
  },
  cancelTxt: {
    fontFamily: Typography.body,
    fontSize: 15,
    color: Colors.tx2,
  },
  saveTxt: {
    fontFamily: Typography.headingBold,
    fontSize: 15,
    color: Colors.lime,
    textAlign: 'right',
  },
  body: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  fieldLabel: {
    fontFamily: Typography.headingBold,
    fontSize: 11,
    color: Colors.tx3,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 8,
  },
  textInput: {
    backgroundColor: Colors.sf2,
    borderRadius: Radius.md ?? 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontFamily: Typography.body,
    fontSize: 15,
    color: Colors.tx,
    marginBottom: 16,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 18,
    backgroundColor: Colors.sf2,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  chipActive: {
    backgroundColor: 'rgba(200,244,90,0.12)',
    borderColor: Colors.lime,
  },
  chipTxt: {
    fontFamily: Typography.body,
    fontSize: 13,
    color: Colors.tx2,
  },
  chipTxtActive: {
    color: Colors.lime,
    fontFamily: Typography.headingBold,
  },
  amountRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
    marginBottom: 16,
  },
  unitBadge: {
    backgroundColor: Colors.sf2,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: Radius.md ?? 10,
    minWidth: 60,
    alignItems: 'center',
  },
  unitTxt: {
    fontFamily: Typography.headingBold,
    fontSize: 14,
    color: Colors.tx,
  },
  co2Row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(200,244,90,0.08)',
    padding: 14,
    borderRadius: Radius.md ?? 10,
    marginBottom: 16,
  },
  co2Label: {
    fontFamily: Typography.body,
    fontSize: 13,
    color: Colors.tx2,
  },
  co2Value: {
    fontFamily: Typography.headingBold,
    fontSize: 16,
    color: Colors.lime,
  },
  dateRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  dateBtn: {
    flex: 1,
    backgroundColor: Colors.sf2,
    borderRadius: Radius.md ?? 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    alignItems: 'center',
  },
  dateBtnTxt: {
    fontFamily: Typography.body,
    fontSize: 14,
    color: Colors.tx,
  },
});
