// src/screens/activity/ActivityDetailScreen.tsx
//
// Day timeline: shows all activities for a selected date.
// Swipe-to-delete. Tap-to-edit (opens EditActivityModal).
// Date picker at the top to change the day being viewed.
//
// Architecture:
//   - Reads directly from `activities` table (RLS-enforced by user_id)
//   - Delete → DELETE query. Supabase trigger recomputes daily_summary.
//   - Edit via EditActivityModal → UPDATE query. Trigger recomputes.
//   - Refetches on focus, so returning from Home shows latest state.

import { supabase } from '../../lib/supabase';
import { invalidateMokoAviCache } from '../../lib/mokoAvi';
import { formatCo2 } from '../../lib/format';
import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { GestureHandlerRootView, Swipeable } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useAuthStore } from '../../lib/authStore';
import { Colors, Typography, Radius, Spacing } from '../../constants/theme';
import { findActivityType, findCategory } from '../../constants/activityTypes';
import EditActivityModal from './EditActivityModal';

export default function ActivityDetailScreen({ navigation }: any) {
  const { profile } = useAuthStore();
  const insets = useSafeAreaInsets();

  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [activities, setActivities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingActivity, setEditingActivity] = useState<any | null>(null);

  const fetchActivities = useCallback(async () => {
    if (!profile?.id) return;
    setLoading(true);

    // Compute ISO date boundaries for the selected day (local time)
    const dayStart = new Date(selectedDate);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(selectedDate);
    dayEnd.setHours(23, 59, 59, 999);

    const { data, error } = await supabase
      .from('activities')
      .select('id, label, category, activity_type, amount, unit, co2_kg, logged_at, source')
      .eq('user_id', profile.id)
      .gte('logged_at', dayStart.toISOString())
      .lte('logged_at', dayEnd.toISOString())
      .order('logged_at', { ascending: false });

    if (!error) {
      setActivities(data || []);
    }
    setLoading(false);
  }, [profile?.id, selectedDate]);

  useFocusEffect(
    useCallback(() => {
      fetchActivities();
    }, [fetchActivities])
  );

  const handleDelete = (activity: any) => {
    const labelShort = (activity.label || '').split('·')[0].trim();
    Alert.alert(
      'Delete activity?',
      `${labelShort} (${formatCo2(activity.co2_kg)} kg CO₂e)\n\nThis will update your daily total.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const { error } = await supabase
              .from('activities')
              .delete()
              .eq('id', activity.id);

            if (error) {
              Alert.alert('Delete failed', error.message);
              return;
            }
            // Refetch to reflect change
            invalidateMokoAviCache(profile?.id || '');
            fetchActivities();
          },
        },
      ]
    );
  };

  const renderRightActions = (activity: any) => (
    <TouchableOpacity style={s.deleteAction} onPress={() => handleDelete(activity)}>
      <Text style={s.deleteActionTxt}>Delete</Text>
    </TouchableOpacity>
  );

  const dayLabel = selectedDate.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
  const isToday = selectedDate.toDateString() === new Date().toDateString();

  const dailyTotal = activities.reduce((sum, a) => sum + (a.co2_kg ?? 0), 0);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <View style={[s.root, { paddingTop: insets.top || 12 }]}>
        <StatusBar barStyle="light-content" backgroundColor={Colors.bg} />

        {/* Header */}
        <View style={s.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
            <Text style={s.backTxt}>← Back</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.dateBtn} onPress={() => setShowDatePicker(true)}>
            <Text style={s.dateBtnTxt}>{isToday ? 'Today' : dayLabel}</Text>
            <Text style={s.dateBtnSub}>tap to change</Text>
          </TouchableOpacity>
          <View style={{ width: 60 }} />
        </View>

        {/* Daily total chip */}
        <View style={s.totalChip}>
          <Text style={s.totalLabel}>{activities.length} activities</Text>
          <Text style={s.totalValue}>{formatCo2(dailyTotal)} kg CO₂e</Text>
        </View>

        {showDatePicker && (
          <DateTimePicker
            value={selectedDate}
            mode="date"
            display={Platform.OS === 'ios' ? 'inline' : 'default'}
            maximumDate={new Date()}
            onChange={(_, d) => {
              setShowDatePicker(Platform.OS === 'ios' ? false : false);
              if (d) setSelectedDate(d);
            }}
          />
        )}

        {/* Timeline list */}
        {loading ? (
          <View style={s.centered}>
            <ActivityIndicator color={Colors.lime} />
          </View>
        ) : activities.length === 0 ? (
          <View style={s.centered}>
            <Text style={s.emptyIcon}>🌱</Text>
            <Text style={s.emptyTitle}>No activities logged {isToday ? 'today' : 'this day'}</Text>
            <Text style={s.emptySub}>Log from the Home screen to get started.</Text>
          </View>
        ) : (
          <ScrollView style={s.list} contentContainerStyle={{ paddingBottom: 40 }}>
            {activities.map(act => {
              const typeDef = findActivityType(act.category, act.activity_type);
              const catDef = findCategory(act.category);
              const icon = typeDef?.icon ?? catDef?.icon ?? '◯';
              const time = new Date(act.logged_at).toLocaleTimeString(undefined, {
                hour: 'numeric',
                minute: '2-digit',
              });

              return (
                <Swipeable
                  key={act.id}
                  renderRightActions={() => renderRightActions(act)}
                  overshootRight={false}
                >
                  <TouchableOpacity
                    style={s.row}
                    onPress={() => setEditingActivity(act)}
                    activeOpacity={0.7}
                  >
                    <View style={s.rowLeft}>
                      <Text style={s.rowTime}>{time}</Text>
                      <Text style={s.rowIcon}>{icon}</Text>
                    </View>
                    <View style={s.rowMiddle}>
                      <Text style={s.rowLabel} numberOfLines={1}>
                        {act.label}
                      </Text>
                      <Text style={s.rowMeta}>
                        {typeDef?.name ?? act.activity_type} · {act.amount ?? 0} {act.unit ?? ''}
                      </Text>
                    </View>
                    <View style={s.rowRight}>
                      <Text style={s.rowCo2}>{formatCo2(act.co2_kg)}</Text>
                      <Text style={s.rowCo2Unit}>kg</Text>
                    </View>
                  </TouchableOpacity>
                </Swipeable>
              );
            })}
          </ScrollView>
        )}

        {/* Edit modal */}
        <EditActivityModal
          visible={editingActivity !== null}
          activity={editingActivity}
          onClose={() => setEditingActivity(null)}
          onSaved={() => {
            setEditingActivity(null);
            invalidateMokoAviCache(profile?.id || '');
            fetchActivities();
          }}
        />
      </View>
    </GestureHandlerRootView>
  );
}

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  backBtn: { minWidth: 60 },
  backTxt: {
    fontFamily: Typography.headingBold,
    fontSize: 14,
    color: Colors.lime,
  },
  dateBtn: {
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  dateBtnTxt: {
    fontFamily: Typography.headingBold,
    fontSize: 16,
    color: Colors.tx,
  },
  dateBtnSub: {
    fontFamily: Typography.body,
    fontSize: 10,
    color: Colors.tx3,
    marginTop: 2,
  },
  totalChip: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginHorizontal: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: 'rgba(200,244,90,0.08)',
    borderRadius: Radius.md ?? 10,
    marginBottom: 10,
  },
  totalLabel: {
    fontFamily: Typography.body,
    fontSize: 12,
    color: Colors.tx2,
  },
  totalValue: {
    fontFamily: Typography.headingBold,
    fontSize: 15,
    color: Colors.lime,
  },
  list: {
    flex: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: Colors.bg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  rowLeft: {
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    minWidth: 50,
  },
  rowTime: {
    fontFamily: Typography.body,
    fontSize: 10,
    color: Colors.tx3,
    marginBottom: 4,
  },
  rowIcon: {
    fontSize: 22,
  },
  rowMiddle: {
    flex: 1,
    paddingRight: 10,
  },
  rowLabel: {
    fontFamily: Typography.headingBold,
    fontSize: 14,
    color: Colors.tx,
    marginBottom: 2,
  },
  rowMeta: {
    fontFamily: Typography.body,
    fontSize: 11,
    color: Colors.tx3,
  },
  rowRight: {
    alignItems: 'flex-end',
    minWidth: 50,
  },
  rowCo2: {
    fontFamily: Typography.headingBold,
    fontSize: 15,
    color: Colors.lime,
  },
  rowCo2Unit: {
    fontFamily: Typography.body,
    fontSize: 10,
    color: Colors.tx3,
  },
  deleteAction: {
    backgroundColor: '#EF4444',
    justifyContent: 'center',
    alignItems: 'center',
    width: 80,
  },
  deleteActionTxt: {
    color: '#fff',
    fontFamily: Typography.headingBold,
    fontSize: 14,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyIcon: {
    fontSize: 40,
    marginBottom: 10,
  },
  emptyTitle: {
    fontFamily: Typography.headingBold,
    fontSize: 15,
    color: Colors.tx,
    marginBottom: 6,
    textAlign: 'center',
  },
  emptySub: {
    fontFamily: Typography.body,
    fontSize: 13,
    color: Colors.tx3,
    textAlign: 'center',
  },
});
