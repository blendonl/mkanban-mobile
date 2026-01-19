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
import { Task, TaskType, RecurrenceRule } from '../../../domain/entities/Task';
import { AgendaStackParamList } from '../../navigation/TabNavigator';
import AppIcon, { AppIconName } from '../../components/icons/AppIcon';

type TaskScheduleRouteProp = RouteProp<AgendaStackParamList, 'TaskSchedule'>;
type TaskScheduleNavProp = StackNavigationProp<AgendaStackParamList, 'TaskSchedule'>;

const TASK_TYPES: { value: TaskType; label: string; icon: AppIconName }[] = [
  { value: 'regular', label: 'Task', icon: 'task' },
  { value: 'meeting', label: 'Meeting', icon: 'users' },
  { value: 'milestone', label: 'Milestone', icon: 'milestone' },
];

const DURATION_OPTIONS = [15, 30, 45, 60, 90, 120];
const RECURRENCE_OPTIONS = [
  { value: 'none', label: 'None' },
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'custom', label: 'Custom' },
] as const;

const WEEKDAY_OPTIONS = [
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' },
  { value: 7, label: 'Sun' },
];

export default function TaskScheduleScreen() {
  const route = useRoute<TaskScheduleRouteProp>();
  const navigation = useNavigation<TaskScheduleNavProp>();
  const { taskId, boardId, taskData } = route.params;

  const [task, setTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [selectedDate, setSelectedDate] = useState<string>('');
  const [selectedTime, setSelectedTime] = useState<string>('');
  const [selectedDuration, setSelectedDuration] = useState<number | null>(null);
  const [selectedType, setSelectedType] = useState<TaskType>('regular');
  const [meetingLocation, setMeetingLocation] = useState<string>('');
  const [meetingAttendees, setMeetingAttendees] = useState<string>('');
  const [recurrenceType, setRecurrenceType] = useState<'none' | 'daily' | 'weekly' | 'monthly' | 'custom'>('none');
  const [customFrequency, setCustomFrequency] = useState<'daily' | 'weekly' | 'monthly'>('daily');
  const [repeatInterval, setRepeatInterval] = useState<string>('1');
  const [repeatDays, setRepeatDays] = useState<number[]>([]);
  const [extraTimes, setExtraTimes] = useState<string[]>([]);

  const applyRecurrenceToState = (
    rule: RecurrenceRule | null | undefined,
    dateValue: string | null | undefined,
    timeValue: string
  ) => {
    if (!rule) {
      setRecurrenceType('none');
      setCustomFrequency('daily');
      setRepeatInterval('1');
      setRepeatDays([]);
      setExtraTimes([]);
      return;
    }

    const baseFrequency = rule.frequency;
    const isCustom =
      (rule.interval && rule.interval > 1) ||
      (rule.times && rule.times.length > 1) ||
      (rule.daysOfWeek && rule.daysOfWeek.length > 1) ||
      (baseFrequency === 'monthly' && rule.dayOfMonth && dateValue && rule.dayOfMonth !== getDayOfMonth(dateValue));

    if (isCustom) {
      setRecurrenceType('custom');
      setCustomFrequency(baseFrequency);
    } else {
      setRecurrenceType(baseFrequency);
    }

    setRepeatInterval(String(rule.interval || 1));
    if (baseFrequency === 'weekly') {
      if (rule.daysOfWeek && rule.daysOfWeek.length > 0) {
        setRepeatDays(rule.daysOfWeek);
      } else if (dateValue) {
        setRepeatDays([getIsoDayOfWeek(dateValue)]);
      }
    } else {
      setRepeatDays([]);
    }

    if (rule.times && rule.times.length > 0) {
      setExtraTimes(rule.times.filter(t => t !== timeValue));
    } else {
      setExtraTimes([]);
    }
  };

  const loadTask = useCallback(async () => {
    try {
      if (taskData) {
        const taskInstance = Task.fromDict(taskData);
        setTask(taskInstance);
        setSelectedDate(taskInstance.scheduled_date || getTodayString());
        setSelectedTime(taskInstance.scheduled_time || '');
        setSelectedDuration(taskInstance.time_block_minutes);
        setSelectedType(taskInstance.task_type);
        setMeetingLocation(taskInstance.meeting_data?.location || '');
        setMeetingAttendees(taskInstance.meeting_data?.attendees?.join(', ') || '');
        applyRecurrenceToState(taskInstance.recurrence, taskInstance.scheduled_date, taskInstance.scheduled_time || '');
        setLoading(false);
        return;
      }

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
          setMeetingLocation(foundTask.meeting_data?.location || '');
          setMeetingAttendees(foundTask.meeting_data?.attendees?.join(', ') || '');
          applyRecurrenceToState(foundTask.recurrence, foundTask.scheduled_date, foundTask.scheduled_time || '');
          break;
        }
      }
    } catch (error) {
      console.error('Failed to load task:', error);
      Alert.alert('Error', 'Failed to load task');
    } finally {
      setLoading(false);
    }
  }, [taskId, boardId, taskData]);

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
      const recurrenceRule = buildRecurrenceRule();

      await agendaService.scheduleTask(
        boardId,
        taskId,
        selectedDate,
        selectedTime || undefined,
        selectedDuration || undefined,
        recurrenceRule
      );

      if (selectedType !== task.task_type) {
        await agendaService.setTaskType(boardId, taskId, selectedType);
      }

      if (selectedType === 'meeting' && (meetingLocation || meetingAttendees)) {
        const attendeesList = meetingAttendees
          .split(',')
          .map(a => a.trim())
          .filter(a => a.length > 0);

        await agendaService.updateMeetingData(boardId, taskId, {
          location: meetingLocation || undefined,
          attendees: attendeesList.length > 0 ? attendeesList : undefined,
        });
      }

      navigation.goBack();
    } catch (error) {
      console.error('Failed to save schedule:', error);
      Alert.alert('Error', 'Failed to save schedule');
    } finally {
      setSaving(false);
    }
  };

  const buildRecurrenceRule = (): RecurrenceRule | null => {
    if (recurrenceType === 'none') {
      return null;
    }

    const frequency = recurrenceType === 'custom' ? customFrequency : recurrenceType;
    const interval = recurrenceType === 'custom'
      ? Math.max(1, parseInt(repeatInterval || '1', 10))
      : 1;

    const rule: RecurrenceRule = { frequency, interval };

    if (frequency === 'weekly') {
      rule.daysOfWeek = repeatDays.length > 0 ? repeatDays : [getIsoDayOfWeek(selectedDate)];
    }

    if (frequency === 'monthly') {
      rule.dayOfMonth = getDayOfMonth(selectedDate);
    }

    if (frequency === 'daily') {
      const times = [selectedTime, ...extraTimes].filter(Boolean);
      if (times.length > 0) {
        rule.times = Array.from(new Set(times)) as string[];
      }
    }

    return rule;
  };

  const toggleRepeatDay = (day: number) => {
    setRepeatDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  };

  const toggleExtraTime = (time: string) => {
    setExtraTimes((prev) =>
      prev.includes(time) ? prev.filter((t) => t !== time) : [...prev, time]
    );
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
        <Text style={styles.loadingText}>Loading schedule...</Text>
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
  const effectiveFrequency = recurrenceType === 'custom' ? customFrequency : recurrenceType;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.hero}>
        <Text style={styles.heroLabel}>Scheduling</Text>
        <Text style={styles.heroTitle}>{task.title}</Text>
        <Text style={styles.heroSubtitle}>Pick when this work should happen.</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Task Type</Text>
        <Text style={styles.sectionSubtitle}>Set the kind of work this is.</Text>
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
              <AppIcon
                name={type.icon}
                size={18}
                color={selectedType === type.value ? theme.background.primary : theme.text.secondary}
              />
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
        <Text style={styles.sectionSubtitle}>Choose a day to schedule this task.</Text>
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
        <Text style={styles.sectionTitle}>Time</Text>
        <Text style={styles.sectionSubtitle}>Optional. Leave it as all day to keep it flexible.</Text>
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
              All day
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
        <Text style={styles.sectionTitle}>Repeat</Text>
        <Text style={styles.sectionSubtitle}>Set a recurrence pattern for this task.</Text>
        <View style={styles.recurrenceRow}>
          {RECURRENCE_OPTIONS.map(option => (
            <TouchableOpacity
              key={option.value}
              style={[
                styles.recurrenceButton,
                recurrenceType === option.value && styles.recurrenceButtonSelected,
              ]}
              onPress={() => setRecurrenceType(option.value)}
            >
              <Text style={[
                styles.recurrenceLabel,
                recurrenceType === option.value && styles.recurrenceLabelSelected,
              ]}>
                {option.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {recurrenceType === 'custom' && (
          <View style={styles.customRecurrence}>
            <Text style={styles.subLabel}>Frequency</Text>
            <View style={styles.recurrenceRow}>
              {(['daily', 'weekly', 'monthly'] as const).map(freq => (
                <TouchableOpacity
                  key={freq}
                  style={[
                    styles.recurrenceButton,
                    customFrequency === freq && styles.recurrenceButtonSelected,
                  ]}
                  onPress={() => setCustomFrequency(freq)}
                >
                  <Text style={[
                    styles.recurrenceLabel,
                    customFrequency === freq && styles.recurrenceLabelSelected,
                  ]}>
                    {freq.charAt(0).toUpperCase() + freq.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.subLabel}>Interval</Text>
            <TextInput
              style={styles.intervalInput}
              value={repeatInterval}
              onChangeText={setRepeatInterval}
              keyboardType="number-pad"
              placeholder="1"
              placeholderTextColor={theme.text.muted}
            />
          </View>
        )}

        {effectiveFrequency === 'weekly' && (
          <View style={styles.weekdayRow}>
            {WEEKDAY_OPTIONS.map(day => {
              const selected = repeatDays.includes(day.value);
              return (
                <TouchableOpacity
                  key={day.value}
                  style={[
                    styles.weekdayButton,
                    selected && styles.weekdayButtonSelected,
                  ]}
                  onPress={() => toggleRepeatDay(day.value)}
                >
                  <Text style={[
                    styles.weekdayLabel,
                    selected && styles.weekdayLabelSelected,
                  ]}>
                    {day.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {effectiveFrequency === 'daily' && (
          <>
            <Text style={styles.subLabel}>Additional times</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.timeScroll}>
              {timeOptions.map(option => {
                const isSelected = extraTimes.includes(option.value);
                return (
                  <TouchableOpacity
                    key={`extra-${option.value}`}
                    style={[
                      styles.timeButton,
                      isSelected && styles.timeButtonSelected,
                    ]}
                    onPress={() => toggleExtraTime(option.value)}
                  >
                    <Text style={[
                      styles.timeLabel,
                      isSelected && styles.timeLabelSelected,
                    ]}>
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Duration</Text>
        <Text style={styles.sectionSubtitle}>Optional. Helps estimate how much time you need.</Text>
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

      {selectedType === 'meeting' && (
        <>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Location</Text>
            <Text style={styles.sectionSubtitle}>Optional. Where is this happening?</Text>
            <TextInput
              style={styles.input}
              value={meetingLocation}
              onChangeText={setMeetingLocation}
              placeholder="Meeting location (optional)"
              autoCapitalize="words"
              placeholderTextColor={theme.text.muted}
            />
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Attendees</Text>
            <Text style={styles.sectionSubtitle}>Optional. Use commas to separate names.</Text>
            <TextInput
              style={styles.input}
              value={meetingAttendees}
              onChangeText={setMeetingAttendees}
              placeholder="Comma-separated list (optional)"
              autoCapitalize="none"
              autoCorrect={false}
              placeholderTextColor={theme.text.muted}
            />
          </View>
        </>
      )}

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

function getIsoDayOfWeek(dateString: string): number {
  const date = new Date(`${dateString}T00:00:00`);
  const day = date.getDay();
  return day === 0 ? 7 : day;
}

function getDayOfMonth(dateString: string): number {
  const date = new Date(`${dateString}T00:00:00`);
  return date.getDate();
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background.primary,
  },
  content: {
    paddingBottom: spacing.xxl,
  },
  loadingText: {
    color: theme.text.secondary,
    textAlign: 'center',
    marginTop: spacing.xl,
  },
  hero: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
  },
  heroLabel: {
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.7,
    color: theme.text.tertiary,
    marginBottom: 6,
  },
  heroTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: theme.text.primary,
    marginBottom: 6,
  },
  heroSubtitle: {
    fontSize: 14,
    color: theme.text.secondary,
  },
  section: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
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
  sectionSubtitle: {
    color: theme.text.tertiary,
    fontSize: 13,
    marginTop: -spacing.sm,
    marginBottom: spacing.md,
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
  recurrenceRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    marginTop: spacing.sm,
  },
  recurrenceButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.border.secondary,
    backgroundColor: theme.background.elevated,
  },
  recurrenceButtonSelected: {
    backgroundColor: theme.accent.primary,
    borderColor: theme.accent.primary,
  },
  recurrenceLabel: {
    fontSize: 12,
    color: theme.text.secondary,
    fontWeight: '600',
  },
  recurrenceLabelSelected: {
    color: theme.background.primary,
  },
  customRecurrence: {
    marginTop: spacing.md,
  },
  subLabel: {
    fontSize: 12,
    color: theme.text.tertiary,
    marginTop: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  intervalInput: {
    marginTop: spacing.sm,
    marginHorizontal: spacing.lg,
    backgroundColor: theme.input.background,
    borderWidth: 1,
    borderColor: theme.input.border,
    borderRadius: 10,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: theme.text.primary,
  },
  weekdayRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    marginTop: spacing.md,
  },
  weekdayButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.border.secondary,
    backgroundColor: theme.background.elevated,
  },
  weekdayButtonSelected: {
    backgroundColor: theme.accent.primary,
    borderColor: theme.accent.primary,
  },
  weekdayLabel: {
    fontSize: 12,
    color: theme.text.secondary,
    fontWeight: '600',
  },
  weekdayLabelSelected: {
    color: theme.background.primary,
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
  input: {
    backgroundColor: theme.card.background,
    borderRadius: 8,
    padding: spacing.md,
    color: theme.text.primary,
    fontSize: 14,
    borderWidth: 1,
    borderColor: theme.border.primary,
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
    borderWidth: 1,
    borderColor: theme.border.primary,
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
