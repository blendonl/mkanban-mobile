import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
} from 'react-native';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import theme from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { getAgendaService, getBoardService } from '../../../core/DependencyContainer';
import { Task, TaskType } from '../../../domain/entities/Task';
import { AgendaStackParamList } from '../../navigation/TabNavigator';

type TaskScheduleRouteProp = RouteProp<AgendaStackParamList, 'TaskSchedule'>;
type TaskScheduleNavProp = StackNavigationProp<AgendaStackParamList, 'TaskSchedule'>;

const TASK_TYPES: { value: TaskType; label: string; icon: string }[] = [
  { value: 'regular', label: 'Task', icon: '📋' },
  { value: 'meeting', label: 'Meeting', icon: '👥' },
  { value: 'milestone', label: 'Milestone', icon: '🎯' },
];

const DURATION_OPTIONS = [15, 30, 45, 60, 90, 120];

export default function TaskScheduleScreen() {
  const route = useRoute<TaskScheduleRouteProp>();
  const navigation = useNavigation<TaskScheduleNavProp>();
  const { taskId, boardId } = route.params;

  const [task, setTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [selectedDate, setSelectedDate] = useState<string>('');
  const [selectedTime, setSelectedTime] = useState<string>('');
  const [selectedDuration, setSelectedDuration] = useState<number | null>(null);
  const [selectedType, setSelectedType] = useState<TaskType>('regular');

  const loadTask = useCallback(async () => {
    try {
      const boardService = getBoardService();
      const board = await boardService.getBoardById(boardId);

      for (const column of board.columns) {
        const foundTask = column.tasks.find(t => t.id === taskId);
        if (foundTask) {
          setTask(foundTask);
          setSelectedDate(foundTask.scheduled_date || getTodayString());
          setSelectedTime(foundTask.scheduled_time || '');
          setSelectedDuration(foundTask.time_block_minutes);
          setSelectedType(foundTask.task_type);
          break;
        }
      }
    } catch (error) {
      console.error('Failed to load task:', error);
      Alert.alert('Error', 'Failed to load task');
    } finally {
      setLoading(false);
    }
  }, [taskId, boardId]);

  useEffect(() => {
    loadTask();
  }, [loadTask]);

  useEffect(() => {
    navigation.setOptions({
      title: task?.title || 'Schedule Task',
    });
  }, [navigation, task]);

  const handleSave = async () => {
    if (!task) return;

    setSaving(true);
    try {
      const agendaService = getAgendaService();

      await agendaService.scheduleTask(
        boardId,
        taskId,
        selectedDate,
        selectedTime || undefined,
        selectedDuration || undefined
      );

      if (selectedType !== task.task_type) {
        await agendaService.setTaskType(boardId, taskId, selectedType);
      }

      navigation.goBack();
    } catch (error) {
      console.error('Failed to save schedule:', error);
      Alert.alert('Error', 'Failed to save schedule');
    } finally {
      setSaving(false);
    }
  };

  const handleUnschedule = async () => {
    if (!task) return;

    Alert.alert(
      'Remove Schedule',
      'Are you sure you want to remove the schedule from this task?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            setSaving(true);
            try {
              const agendaService = getAgendaService();
              await agendaService.unscheduleTask(boardId, taskId);
              navigation.goBack();
            } catch (error) {
              console.error('Failed to unschedule:', error);
              Alert.alert('Error', 'Failed to remove schedule');
            } finally {
              setSaving(false);
            }
          },
        },
      ]
    );
  };

  const generateDateOptions = (): { value: string; label: string }[] => {
    const options: { value: string; label: string }[] = [];
    const today = new Date();

    for (let i = 0; i < 14; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() + i);
      const dateStr = formatDateString(date);
      const label = i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : date.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      });
      options.push({ value: dateStr, label });
    }

    return options;
  };

  const generateTimeOptions = (): { value: string; label: string }[] => {
    const options: { value: string; label: string }[] = [];

    for (let hour = 0; hour < 24; hour++) {
      for (const min of [0, 30]) {
        const h = hour.toString().padStart(2, '0');
        const m = min.toString().padStart(2, '0');
        const value = `${h}:${m}`;
        const label = formatTimeLabel(hour, min);
        options.push({ value, label });
      }
    }

    return options;
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  if (!task) {
    return (
      <View style={styles.container}>
        <Text style={styles.loadingText}>Task not found</Text>
      </View>
    );
  }

  const dateOptions = generateDateOptions();
  const timeOptions = generateTimeOptions();

  return (
    <ScrollView style={styles.container}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Task Type</Text>
        <View style={styles.typeRow}>
          {TASK_TYPES.map(type => (
            <TouchableOpacity
              key={type.value}
              style={[
                styles.typeButton,
                selectedType === type.value && styles.typeButtonSelected,
              ]}
              onPress={() => setSelectedType(type.value)}
            >
              <Text style={styles.typeIcon}>{type.icon}</Text>
              <Text style={[
                styles.typeLabel,
                selectedType === type.value && styles.typeLabelSelected,
              ]}>
                {type.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Date</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.dateScroll}>
          {dateOptions.map(option => (
            <TouchableOpacity
              key={option.value}
              style={[
                styles.dateButton,
                selectedDate === option.value && styles.dateButtonSelected,
              ]}
              onPress={() => setSelectedDate(option.value)}
            >
              <Text style={[
                styles.dateLabel,
                selectedDate === option.value && styles.dateLabelSelected,
              ]}>
                {option.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Time (Optional)</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.timeScroll}>
          <TouchableOpacity
            style={[
              styles.timeButton,
              !selectedTime && styles.timeButtonSelected,
            ]}
            onPress={() => setSelectedTime('')}
          >
            <Text style={[
              styles.timeLabel,
              !selectedTime && styles.timeLabelSelected,
            ]}>
              All Day
            </Text>
          </TouchableOpacity>
          {timeOptions.map(option => (
            <TouchableOpacity
              key={option.value}
              style={[
                styles.timeButton,
                selectedTime === option.value && styles.timeButtonSelected,
              ]}
              onPress={() => setSelectedTime(option.value)}
            >
              <Text style={[
                styles.timeLabel,
                selectedTime === option.value && styles.timeLabelSelected,
              ]}>
                {option.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Duration (Optional)</Text>
        <View style={styles.durationRow}>
          <TouchableOpacity
            style={[
              styles.durationButton,
              !selectedDuration && styles.durationButtonSelected,
            ]}
            onPress={() => setSelectedDuration(null)}
          >
            <Text style={[
              styles.durationLabel,
              !selectedDuration && styles.durationLabelSelected,
            ]}>
              None
            </Text>
          </TouchableOpacity>
          {DURATION_OPTIONS.map(duration => (
            <TouchableOpacity
              key={duration}
              style={[
                styles.durationButton,
                selectedDuration === duration && styles.durationButtonSelected,
              ]}
              onPress={() => setSelectedDuration(duration)}
            >
              <Text style={[
                styles.durationLabel,
                selectedDuration === duration && styles.durationLabelSelected,
              ]}>
                {duration}m
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.saveButton}
          onPress={handleSave}
          disabled={saving}
        >
          <Text style={styles.saveButtonText}>
            {saving ? 'Saving...' : 'Save Schedule'}
          </Text>
        </TouchableOpacity>

        {task.isScheduled && (
          <TouchableOpacity
            style={styles.unscheduleButton}
            onPress={handleUnschedule}
            disabled={saving}
          >
            <Text style={styles.unscheduleButtonText}>Remove Schedule</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.bottomPadding} />
    </ScrollView>
  );
}

function getTodayString(): string {
  return formatDateString(new Date());
}

function formatDateString(date: Date): string {
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatTimeLabel(hour: number, min: number): string {
  const period = hour >= 12 ? 'PM' : 'AM';
  const h = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  const m = min.toString().padStart(2, '0');
  return `${h}:${m} ${period}`;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background.primary,
  },
  loadingText: {
    color: theme.text.secondary,
    textAlign: 'center',
    marginTop: spacing.xl,
  },
  section: {
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: theme.border.primary,
  },
  sectionTitle: {
    color: theme.text.secondary,
    fontSize: 13,
    fontWeight: '600',
    marginBottom: spacing.md,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  typeRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  typeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.card.background,
    borderRadius: 8,
    padding: spacing.md,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  typeButtonSelected: {
    borderColor: theme.accent.primary,
    backgroundColor: theme.accent.primary + '20',
  },
  typeIcon: {
    fontSize: 18,
    marginRight: spacing.sm,
  },
  typeLabel: {
    color: theme.text.primary,
    fontSize: 14,
    fontWeight: '500',
  },
  typeLabelSelected: {
    color: theme.accent.primary,
  },
  dateScroll: {
    marginHorizontal: -spacing.lg,
    paddingHorizontal: spacing.lg,
  },
  dateButton: {
    backgroundColor: theme.card.background,
    borderRadius: 8,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginRight: spacing.sm,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  dateButtonSelected: {
    borderColor: theme.accent.primary,
    backgroundColor: theme.accent.primary + '20',
  },
  dateLabel: {
    color: theme.text.primary,
    fontSize: 14,
    fontWeight: '500',
  },
  dateLabelSelected: {
    color: theme.accent.primary,
  },
  timeScroll: {
    marginHorizontal: -spacing.lg,
    paddingHorizontal: spacing.lg,
  },
  timeButton: {
    backgroundColor: theme.card.background,
    borderRadius: 8,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginRight: spacing.sm,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  timeButtonSelected: {
    borderColor: theme.accent.primary,
    backgroundColor: theme.accent.primary + '20',
  },
  timeLabel: {
    color: theme.text.primary,
    fontSize: 14,
    fontWeight: '500',
  },
  timeLabelSelected: {
    color: theme.accent.primary,
  },
  durationRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  durationButton: {
    backgroundColor: theme.card.background,
    borderRadius: 8,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  durationButtonSelected: {
    borderColor: theme.accent.primary,
    backgroundColor: theme.accent.primary + '20',
  },
  durationLabel: {
    color: theme.text.primary,
    fontSize: 14,
    fontWeight: '500',
  },
  durationLabelSelected: {
    color: theme.accent.primary,
  },
  actions: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  saveButton: {
    backgroundColor: theme.accent.primary,
    borderRadius: 8,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  saveButtonText: {
    color: theme.background.primary,
    fontSize: 16,
    fontWeight: '600',
  },
  unscheduleButton: {
    backgroundColor: theme.card.background,
    borderRadius: 8,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  unscheduleButtonText: {
    color: theme.accent.error,
    fontSize: 16,
    fontWeight: '500',
  },
  bottomPadding: {
    height: spacing.xxl,
  },
});
