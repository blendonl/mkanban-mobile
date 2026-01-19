import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import DateTimePicker from '@react-native-community/datetimepicker';
import theme from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { getAgendaService, getBoardService } from '../../../core/DependencyContainer';
import { Task, TaskType, RecurrenceRule } from '../../../domain/entities/Task';
import { AgendaStackParamList } from '../../navigation/TabNavigator';
import AppIcon, { AppIconName } from '../../components/icons/AppIcon';
import BaseModal from '../../components/BaseModal';

type TaskScheduleRouteProp = RouteProp<AgendaStackParamList, 'TaskSchedule'>;
type TaskScheduleNavProp = StackNavigationProp<AgendaStackParamList, 'TaskSchedule'>;

const TASK_TYPES: { value: TaskType; label: string; icon: AppIconName }[] = [
  { value: 'regular', label: 'Task', icon: 'task' },
  { value: 'meeting', label: 'Meeting', icon: 'users' },
  { value: 'milestone', label: 'Milestone', icon: 'milestone' },
];

const DURATION_PRESETS = [30, 60];
const REPEAT_OPTIONS = [
  { value: 'none', label: 'None' },
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
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
  const insets = useSafeAreaInsets();
  const { taskId, boardId, taskData } = route.params;
  const allowTypeEdit = route.params?.allowTypeEdit ?? false;

  const [task, setTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [selectedDate, setSelectedDate] = useState<string>('');
  const [selectedTime, setSelectedTime] = useState<string>('');
  const [viewMonth, setViewMonth] = useState<Date>(() => new Date());
  const [selectedDuration, setSelectedDuration] = useState<number | null>(null);
  const [durationMode, setDurationMode] = useState<'none' | 'tbd' | 'preset' | 'custom'>('none');
  const [customDuration, setCustomDuration] = useState<string>('');
  const [selectedType, setSelectedType] = useState<TaskType>('regular');
  const [meetingLocation, setMeetingLocation] = useState<string>('');
  const [meetingAttendees, setMeetingAttendees] = useState<string>('');
  const [repeatFrequency, setRepeatFrequency] = useState<'none' | 'daily' | 'weekly' | 'monthly'>('none');
  const [repeatInterval, setRepeatInterval] = useState<string>('1');
  const [repeatDays, setRepeatDays] = useState<number[]>([]);
  const [extraTimes, setExtraTimes] = useState<string[]>([]);
  const [showSystemDatePicker, setShowSystemDatePicker] = useState(false);
  const [activeTimePicker, setActiveTimePicker] = useState<'primary' | 'extra' | null>(null);
  const [showAdvancedRepeat, setShowAdvancedRepeat] = useState(false);
  const [meetingExpanded, setMeetingExpanded] = useState(false);

  const [draftRepeatInterval, setDraftRepeatInterval] = useState<string>('1');
  const [draftExtraTimes, setDraftExtraTimes] = useState<string[]>([]);

  const applyRecurrenceToState = (
    rule: RecurrenceRule | null | undefined,
    dateValue: string | null | undefined,
    timeValue: string
  ) => {
    if (!rule) {
      setRepeatFrequency('none');
      setRepeatInterval('1');
      setRepeatDays([]);
      setExtraTimes([]);
      return;
    }

    const baseFrequency = rule.frequency;
    if (baseFrequency !== 'daily' && baseFrequency !== 'weekly' && baseFrequency !== 'monthly') {
      setRepeatFrequency('none');
      setRepeatInterval('1');
      setRepeatDays([]);
      setExtraTimes([]);
      return;
    }

    setRepeatFrequency(baseFrequency);
    setRepeatInterval(String(rule.interval || 1));
    if (baseFrequency === 'weekly') {
      const days = rule.daysOfWeek && rule.daysOfWeek.length > 0 ? rule.daysOfWeek : null;
      if (days) {
        setRepeatDays(days);
      } else if (dateValue) {
        setRepeatDays([getIsoDayOfWeek(dateValue)]);
      } else {
        setRepeatDays([]);
      }
    } else {
      setRepeatDays([]);
    }

    if (baseFrequency === 'daily' && rule.times && rule.times.length > 0) {
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
        const nextDate = taskInstance.scheduled_date || getTodayString();
        setSelectedDate(nextDate);
        setSelectedTime(taskInstance.scheduled_time || '');
        setSelectedDuration(taskInstance.time_block_minutes);
        initializeDurationState(taskInstance.time_block_minutes);
        setSelectedType(taskInstance.task_type);
        setMeetingLocation(taskInstance.meeting_data?.location || '');
        setMeetingAttendees(taskInstance.meeting_data?.attendees?.join(', ') || '');
        applyRecurrenceToState(taskInstance.recurrence, taskInstance.scheduled_date, taskInstance.scheduled_time || '');
        setMeetingExpanded(!!(taskInstance.meeting_data?.location || taskInstance.meeting_data?.attendees?.length));
        setViewMonth(getMonthStart(getDatePickerValue(nextDate)));
        setLoading(false);
        return;
      }

      const boardService = getBoardService();
      const board = await boardService.getBoardById(boardId);

      for (const column of board.columns) {
        const foundTask = column.tasks.find(t => t.id === taskId);
        if (foundTask) {
          setTask(foundTask);
          const nextDate = foundTask.scheduled_date || getTodayString();
          setSelectedDate(nextDate);
          setSelectedTime(foundTask.scheduled_time || '');
          setSelectedDuration(foundTask.time_block_minutes);
          initializeDurationState(foundTask.time_block_minutes);
          setSelectedType(foundTask.task_type);
          setMeetingLocation(foundTask.meeting_data?.location || '');
          setMeetingAttendees(foundTask.meeting_data?.attendees?.join(', ') || '');
          applyRecurrenceToState(foundTask.recurrence, foundTask.scheduled_date, foundTask.scheduled_time || '');
          setMeetingExpanded(!!(foundTask.meeting_data?.location || foundTask.meeting_data?.attendees?.length));
          setViewMonth(getMonthStart(getDatePickerValue(nextDate)));
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

  useEffect(() => {
    if (allowTypeEdit && selectedType === 'meeting') {
      setMeetingExpanded(true);
    }
  }, [allowTypeEdit, selectedType]);

  const handleSave = async () => {
    if (!task) return;

    setSaving(true);
    try {
      const agendaService = getAgendaService();
      const recurrenceRule = buildRecurrenceRule();
      const durationMinutes = resolveDurationMinutes();

      if (durationMode === 'custom' && durationMinutes === null) {
        setSaving(false);
        Alert.alert('Duration', 'Enter a valid duration in minutes.');
        return;
      }

      await agendaService.scheduleTask(
        boardId,
        taskId,
        selectedDate,
        selectedTime || undefined,
        durationMinutes ?? undefined,
        recurrenceRule
      );

      if (allowTypeEdit && selectedType !== task.task_type) {
        await agendaService.setTaskType(boardId, taskId, selectedType);
      }

      const effectiveType = allowTypeEdit ? selectedType : task.task_type;
      if (effectiveType === 'meeting' && (meetingLocation || meetingAttendees)) {
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

  const initializeDurationState = (duration: number | null | undefined) => {
    if (!duration) {
      setDurationMode('none');
      setCustomDuration('');
      return;
    }

    if (DURATION_PRESETS.includes(duration)) {
      setDurationMode('preset');
      setCustomDuration('');
      return;
    }

    setDurationMode('custom');
    setCustomDuration(String(duration));
  };

  const resolveDurationMinutes = (): number | null => {
    if (durationMode === 'preset') {
      return selectedDuration || null;
    }

    if (durationMode === 'custom') {
      const parsed = parseInt(customDuration, 10);
      return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
    }

    return null;
  };

  const buildRecurrenceRule = (): RecurrenceRule | null => {
    if (repeatFrequency === 'none') {
      return null;
    }

    const frequency = repeatFrequency;
    const interval = Math.max(1, parseInt(repeatInterval || '1', 10));
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
    setRepeatDays((prev) => {
      if (prev.includes(day)) {
        if (prev.length === 1) return prev;
        return prev.filter((d) => d !== day);
      }
      return [...prev, day];
    });
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

  const showMeetingFields = (allowTypeEdit ? selectedType : task.task_type) === 'meeting';
  const selectedDateLabel = formatDateDisplay(selectedDate);
  const selectedTimeLabel = selectedTime ? formatTimeDisplay(selectedTime) : 'All day';
  const durationSummary = getDurationSummary(durationMode, resolveDurationMinutes());
  const repeatSummary = getRepeatSummary(
    repeatFrequency,
    repeatInterval,
    repeatDays,
    selectedDate,
    selectedTime,
    extraTimes
  );
  const calendarCells = getMonthGrid(viewMonth);
  const footerPadding = insets.bottom + spacing.lg;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.topBar}>
        <TouchableOpacity
          style={styles.topBarButton}
          onPress={() => navigation.goBack()}
          accessibilityLabel="Close scheduling"
        >
          <AppIcon name="close" size={18} color={theme.text.secondary} />
        </TouchableOpacity>

        <View style={styles.topBarCenter}>
          <Text style={styles.topBarTitle}>Schedule</Text>
          <Text style={styles.topBarSubtitle} numberOfLines={1}>
            {task.title}
          </Text>
        </View>

        <TouchableOpacity
          style={styles.topBarButton}
          onPress={() => {
            setActiveTimePicker(null);
            setShowSystemDatePicker(true);
          }}
          accessibilityLabel="Open system date picker"
        >
          <AppIcon name="calendar" size={18} color={theme.text.secondary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.container}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: footerPadding + spacing.xxxl + 80 },
        ]}
      >
        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>{selectedDateLabel}</Text>
          <Text style={styles.summaryLine}>
            {selectedTimeLabel}
            {durationSummary ? ` • ${durationSummary}` : ''}
          </Text>
          <Text style={styles.summaryMeta}>{repeatSummary}</Text>
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <Text style={styles.cardTitle}>Date</Text>
            <View style={styles.monthNav}>
              <TouchableOpacity
                style={styles.iconButton}
                onPress={() => setViewMonth(addMonths(viewMonth, -1))}
                accessibilityLabel="Previous month"
              >
                <AppIcon name="arrow-left" size={18} color={theme.text.secondary} />
              </TouchableOpacity>
              <Text style={styles.monthLabel}>{formatMonthYear(viewMonth)}</Text>
              <TouchableOpacity
                style={styles.iconButton}
                onPress={() => setViewMonth(addMonths(viewMonth, 1))}
                accessibilityLabel="Next month"
              >
                <AppIcon name="arrow-right" size={18} color={theme.text.secondary} />
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              style={styles.todayButton}
              onPress={() => {
                const today = getTodayString();
                setSelectedDate(today);
                setViewMonth(getMonthStart(getDatePickerValue(today)));
              }}
            >
              <Text style={styles.todayButtonText}>Today</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.weekHeaderRow}>
            {WEEKDAY_OPTIONS.map(day => (
              <Text key={`wh-${day.value}`} style={styles.weekHeaderLabel}>
                {day.label}
              </Text>
            ))}
          </View>

          <View style={styles.monthGrid}>
            {calendarCells.map(cell => {
              const isSelected = cell.dateString === selectedDate;
              const isToday = cell.dateString === getTodayString();
              return (
                <TouchableOpacity
                  key={cell.dateString}
                  style={[
                    styles.dayCell,
                    !cell.inMonth && styles.dayCellOutside,
                    isSelected && styles.dayCellSelected,
                    !isSelected && isToday && styles.dayCellToday,
                  ]}
                  onPress={() => {
                    setSelectedDate(cell.dateString);
                    setViewMonth(getMonthStart(getDatePickerValue(cell.dateString)));
                    if (repeatFrequency === 'weekly' && repeatDays.length === 0) {
                      setRepeatDays([getIsoDayOfWeek(cell.dateString)]);
                    }
                  }}
                >
                  <Text
                    style={[
                      styles.dayLabel,
                      !cell.inMonth && styles.dayLabelOutside,
                      isSelected && styles.dayLabelSelected,
                      !isSelected && isToday && styles.dayLabelToday,
                    ]}
                  >
                    {cell.day}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Time</Text>
          <Text style={styles.cardSubtitle}>All day is fine. Add a time when it matters.</Text>
          <View style={styles.pillRow}>
            <TouchableOpacity
              style={[styles.pill, !selectedTime && styles.pillSelected]}
              onPress={() => {
                setSelectedTime('');
                setExtraTimes([]);
              }}
            >
              <Text style={[styles.pillText, !selectedTime && styles.pillTextSelected]}>All day</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.pill, !!selectedTime && styles.pillSelected]}
              onPress={() => setActiveTimePicker('primary')}
            >
              <Text style={[styles.pillText, !!selectedTime && styles.pillTextSelected]}>
                {selectedTime ? formatTimeDisplay(selectedTime) : 'Pick time'}
              </Text>
            </TouchableOpacity>
            {!!selectedTime && (
              <TouchableOpacity
                style={styles.iconButton}
                onPress={() => setSelectedTime('')}
                accessibilityLabel="Clear time"
              >
                <AppIcon name="trash" size={18} color={theme.text.tertiary} />
              </TouchableOpacity>
            )}
          </View>

          {activeTimePicker === 'primary' && (
            <View style={styles.pickerWrapper}>
              <DateTimePicker
                value={getTimePickerValue(selectedDate, selectedTime)}
                mode="time"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={(event, date) => {
                  if (event.type === 'dismissed') {
                    if (Platform.OS !== 'ios') {
                      setActiveTimePicker(null);
                    }
                    return;
                  }

                  const nextTime = date || getTimePickerValue(selectedDate, selectedTime);
                  setSelectedTime(formatTimeValue(nextTime));
                  if (Platform.OS !== 'ios') {
                    setActiveTimePicker(null);
                  }
                }}
              />
              {Platform.OS === 'ios' && (
                <TouchableOpacity
                  style={styles.pickerDoneButton}
                  onPress={() => setActiveTimePicker(null)}
                >
                  <Text style={styles.pickerDoneText}>Done</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          <View style={styles.cardDivider} />

          <Text style={styles.cardTitle}>Duration</Text>
          <Text style={styles.cardSubtitle}>Optional. Helps time-blocking and planning.</Text>
          <View style={styles.pillRow}>
            <TouchableOpacity
              style={[styles.pill, durationMode === 'none' && styles.pillSelected]}
              onPress={() => {
                setDurationMode('none');
                setSelectedDuration(null);
                setCustomDuration('');
              }}
            >
              <Text style={[styles.pillText, durationMode === 'none' && styles.pillTextSelected]}>None</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.pill, durationMode === 'tbd' && styles.pillSelected]}
              onPress={() => {
                setDurationMode('tbd');
                setSelectedDuration(null);
                setCustomDuration('');
              }}
            >
              <Text style={[styles.pillText, durationMode === 'tbd' && styles.pillTextSelected]}>TBD</Text>
            </TouchableOpacity>
            {DURATION_PRESETS.map(minutes => (
              <TouchableOpacity
                key={`dur-${minutes}`}
                style={[
                  styles.pill,
                  durationMode === 'preset' && selectedDuration === minutes && styles.pillSelected,
                ]}
                onPress={() => {
                  setDurationMode('preset');
                  setSelectedDuration(minutes);
                  setCustomDuration('');
                }}
              >
                <Text
                  style={[
                    styles.pillText,
                    durationMode === 'preset' && selectedDuration === minutes && styles.pillTextSelected,
                  ]}
                >
                  {minutes}m
                </Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              style={[styles.pill, durationMode === 'custom' && styles.pillSelected]}
              onPress={() => {
                setDurationMode('custom');
                setSelectedDuration(null);
              }}
            >
              <Text style={[styles.pillText, durationMode === 'custom' && styles.pillTextSelected]}>Custom</Text>
            </TouchableOpacity>
          </View>

          {durationMode === 'custom' && (
            <View style={styles.customDurationRow}>
              <TextInput
                style={styles.durationInput}
                value={customDuration}
                onChangeText={setCustomDuration}
                keyboardType="number-pad"
                placeholder="Minutes"
                placeholderTextColor={theme.text.muted}
              />
              <Text style={styles.helperText}>min</Text>
            </View>
          )}
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <View>
              <Text style={styles.cardTitle}>Repeat</Text>
              <Text style={styles.cardSubtitle}>Optional. Keep it off unless needed.</Text>
            </View>
            {repeatFrequency !== 'none' && (
              <TouchableOpacity
                style={styles.advancedButton}
                onPress={() => {
                  setDraftRepeatInterval(repeatInterval);
                  setDraftExtraTimes(extraTimes);
                  setActiveTimePicker(null);
                  setShowAdvancedRepeat(true);
                }}
              >
                <AppIcon name="edit" size={16} color={theme.text.secondary} />
                <Text style={styles.advancedButtonText}>Advanced</Text>
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.pillRow}>
            {REPEAT_OPTIONS.map(option => (
              <TouchableOpacity
                key={`rep-${option.value}`}
                style={[
                  styles.pill,
                  repeatFrequency === option.value && styles.pillSelected,
                ]}
                onPress={() => {
                  const next = option.value;
                  setRepeatFrequency(next);
                  if (next === 'none') {
                    setRepeatInterval('1');
                    setRepeatDays([]);
                    setExtraTimes([]);
                    return;
                  }
                  if (next === 'weekly' && repeatDays.length === 0) {
                    setRepeatDays([getIsoDayOfWeek(selectedDate)]);
                  }
                }}
              >
                <Text
                  style={[
                    styles.pillText,
                    repeatFrequency === option.value && styles.pillTextSelected,
                  ]}
                >
                  {option.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {repeatFrequency === 'weekly' && (
            <View style={styles.weekdayRow}>
              {WEEKDAY_OPTIONS.map(day => {
                const selected = repeatDays.includes(day.value);
                return (
                  <TouchableOpacity
                    key={`wd-${day.value}`}
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

          <Text style={styles.repeatPreview} numberOfLines={2}>
            {repeatSummary}
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Details</Text>
          <Text style={styles.cardSubtitle}>Optional context that helps later.</Text>

          {allowTypeEdit && (
            <>
              <Text style={styles.subLabel}>Task type</Text>
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
                      color={selectedType === type.value ? theme.accent.primary : theme.text.secondary}
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
            </>
          )}

          {showMeetingFields && (
            <>
              <TouchableOpacity
                style={styles.collapsibleHeader}
                onPress={() => setMeetingExpanded(prev => !prev)}
              >
                <Text style={styles.collapsibleTitle}>Meeting details</Text>
                <AppIcon name="more" size={18} color={theme.text.secondary} />
              </TouchableOpacity>

              {meetingExpanded && (
                <>
                  <Text style={styles.subLabel}>Location</Text>
                  <TextInput
                    style={styles.input}
                    value={meetingLocation}
                    onChangeText={setMeetingLocation}
                    placeholder="Meeting location (optional)"
                    autoCapitalize="words"
                    placeholderTextColor={theme.text.muted}
                  />

                  <Text style={styles.subLabel}>Attendees</Text>
                  <TextInput
                    style={styles.input}
                    value={meetingAttendees}
                    onChangeText={setMeetingAttendees}
                    placeholder="Comma-separated list (optional)"
                    autoCapitalize="none"
                    autoCorrect={false}
                    placeholderTextColor={theme.text.muted}
                  />
                </>
              )}
            </>
          )}
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: footerPadding }]}>
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
            <Text style={styles.unscheduleButtonText}>Remove schedule</Text>
          </TouchableOpacity>
        )}
      </View>

      <BaseModal
        visible={showSystemDatePicker}
        onClose={() => setShowSystemDatePicker(false)}
        title="Pick date"
        maxHeight="90%"
        scrollable={false}
      >
        <DateTimePicker
          value={getDatePickerValue(selectedDate)}
          mode="date"
          display={Platform.OS === 'ios' ? 'inline' : 'default'}
          onChange={(event, date) => {
            if (event.type === 'dismissed') {
              if (Platform.OS !== 'ios') {
                setShowSystemDatePicker(false);
              }
              return;
            }

            const nextDate = date || getDatePickerValue(selectedDate);
            const formatted = formatDateString(nextDate);
            setSelectedDate(formatted);
            setViewMonth(getMonthStart(nextDate));
            if (Platform.OS !== 'ios') {
              setShowSystemDatePicker(false);
            }
          }}
        />
        {Platform.OS === 'ios' && (
          <TouchableOpacity
            style={[styles.pickerDoneButton, { alignSelf: 'flex-end', marginTop: spacing.md }]}
            onPress={() => setShowSystemDatePicker(false)}
          >
            <Text style={styles.pickerDoneText}>Done</Text>
          </TouchableOpacity>
        )}
      </BaseModal>

      <BaseModal
        visible={showAdvancedRepeat}
        onClose={() => {
          setActiveTimePicker(null);
          setShowAdvancedRepeat(false);
        }}
        title="Repeat advanced"
        maxHeight="90%"
      >
        <Text style={styles.modalHint}>
          Interval applies to the selected frequency.
        </Text>

        <Text style={styles.subLabel}>Interval</Text>
        <TextInput
          style={styles.intervalInput}
          value={draftRepeatInterval}
          onChangeText={setDraftRepeatInterval}
          keyboardType="number-pad"
          placeholder="1"
          placeholderTextColor={theme.text.muted}
        />

        {repeatFrequency === 'daily' && (
          <>
            <Text style={styles.subLabel}>Additional times</Text>
            <View style={styles.choiceRow}>
              <TouchableOpacity
                style={styles.choiceButton}
                onPress={() => setActiveTimePicker('extra')}
                disabled={!selectedTime}
              >
                <Text style={styles.choiceLabel}>Add time</Text>
              </TouchableOpacity>
              {!selectedTime && (
                <Text style={styles.helperText}>Pick a primary time first.</Text>
              )}
              {selectedTime && draftExtraTimes.length === 0 && (
                <Text style={styles.helperText}>No extra times added yet.</Text>
              )}
            </View>
            <View style={styles.timeChipRow}>
              {draftExtraTimes.map(time => (
                <TouchableOpacity
                  key={`draft-extra-${time}`}
                  style={styles.timeChip}
                  onPress={() => setDraftExtraTimes(prev => prev.filter(t => t !== time))}
                >
                  <Text style={styles.timeChipLabel}>{formatTimeDisplay(time)}</Text>
                </TouchableOpacity>
              ))}
            </View>
            {activeTimePicker === 'extra' && (
              <View style={styles.pickerWrapper}>
                <DateTimePicker
                  value={getTimePickerValue(selectedDate, selectedTime)}
                  mode="time"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onChange={(event, date) => {
                    if (event.type === 'dismissed') {
                      if (Platform.OS !== 'ios') {
                        setActiveTimePicker(null);
                      }
                      return;
                    }

                    const nextTime = date || getTimePickerValue(selectedDate, selectedTime);
                    const formatted = formatTimeValue(nextTime);
                    if (formatted && !draftExtraTimes.includes(formatted) && formatted !== selectedTime) {
                      setDraftExtraTimes(prev => [...prev, formatted]);
                    }
                    if (Platform.OS !== 'ios') {
                      setActiveTimePicker(null);
                    }
                  }}
                />
                {Platform.OS === 'ios' && (
                  <TouchableOpacity
                    style={styles.pickerDoneButton}
                    onPress={() => setActiveTimePicker(null)}
                  >
                    <Text style={styles.pickerDoneText}>Done</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </>
        )}

        <View style={styles.modalActions}>
          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => {
              setActiveTimePicker(null);
              setShowAdvancedRepeat(false);
            }}
          >
            <Text style={styles.secondaryButtonText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => {
              setRepeatInterval(draftRepeatInterval || '1');
              setExtraTimes(draftExtraTimes);
              setActiveTimePicker(null);
              setShowAdvancedRepeat(false);
            }}
          >
            <Text style={styles.primaryButtonText}>Apply</Text>
          </TouchableOpacity>
        </View>
      </BaseModal>
    </SafeAreaView>
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

function formatDateDisplay(dateString: string): string {
  if (!dateString) {
    return '';
  }

  const date = new Date(`${dateString}T00:00:00`);
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatTimeDisplay(timeString: string): string {
  if (!timeString) {
    return '';
  }

  const [hour, minute] = timeString.split(':').map(Number);
  if (Number.isNaN(hour) || Number.isNaN(minute)) {
    return timeString;
  }

  return formatTimeLabel(hour, minute);
}

function formatTimeValue(date: Date): string {
  const hour = date.getHours().toString().padStart(2, '0');
  const minute = date.getMinutes().toString().padStart(2, '0');
  return `${hour}:${minute}`;
}

function getDatePickerValue(dateString: string): Date {
  if (!dateString) {
    return new Date();
  }

  return new Date(`${dateString}T00:00:00`);
}

function getTimePickerValue(dateString: string, timeString: string): Date {
  const baseDate = dateString ? new Date(`${dateString}T00:00:00`) : new Date();

  if (!timeString) {
    baseDate.setHours(9, 0, 0, 0);
    return baseDate;
  }

  const [hour, minute] = timeString.split(':').map(Number);
  baseDate.setHours(Number.isNaN(hour) ? 9 : hour, Number.isNaN(minute) ? 0 : minute, 0, 0);
  return baseDate;
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

function getDurationSummary(
  durationMode: 'none' | 'tbd' | 'preset' | 'custom',
  durationMinutes: number | null
): string | null {
  if (durationMode === 'tbd') return 'TBD';
  if (durationMode === 'preset' || durationMode === 'custom') {
    return durationMinutes ? `${durationMinutes}m` : null;
  }
  return null;
}

function getRepeatSummary(
  frequency: 'none' | 'daily' | 'weekly' | 'monthly',
  intervalValue: string,
  repeatDays: number[],
  selectedDate: string,
  selectedTime: string,
  extraTimes: string[]
): string {
  if (frequency === 'none') return 'No repeat';

  const interval = Math.max(1, parseInt(intervalValue || '1', 10));
  const intervalPart =
    interval > 1
      ? `Every ${interval} ${frequency === 'daily' ? 'days' : frequency === 'weekly' ? 'weeks' : 'months'}`
      : `Every ${frequency === 'daily' ? 'day' : frequency === 'weekly' ? 'week' : 'month'}`;

  if (frequency === 'weekly') {
    const days = (repeatDays.length > 0 ? repeatDays : [getIsoDayOfWeek(selectedDate)])
      .slice()
      .sort((a, b) => a - b)
      .map(d => WEEKDAY_OPTIONS.find(w => w.value === d)?.label)
      .filter(Boolean)
      .join(', ');
    return days ? `${intervalPart} on ${days}` : intervalPart;
  }

  if (frequency === 'monthly') {
    return `${intervalPart} on day ${getDayOfMonth(selectedDate)}`;
  }

  const times = [selectedTime, ...extraTimes].filter(Boolean);
  const timePart = times.length > 0 ? ` at ${times.map(formatTimeDisplay).join(', ')}` : '';
  return `${intervalPart}${timePart}`;
}

function getMonthStart(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addMonths(date: Date, delta: number): Date {
  const next = new Date(date.getFullYear(), date.getMonth() + delta, 1);
  return getMonthStart(next);
}

function formatMonthYear(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function getMonthGrid(viewMonth: Date): { dateString: string; day: number; inMonth: boolean }[] {
  const monthStart = getMonthStart(viewMonth);
  const isoDow = getIsoDayOfWeek(formatDateString(monthStart));
  const offset = isoDow - 1;
  const gridStart = addDays(monthStart, -offset);

  return Array.from({ length: 42 }).map((_, index) => {
    const date = addDays(gridStart, index);
    return {
      dateString: formatDateString(date),
      day: date.getDate(),
      inMonth: date.getMonth() === monthStart.getMonth(),
    };
  });
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background.primary,
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    gap: spacing.lg,
  },
  loadingText: {
    color: theme.text.secondary,
    textAlign: 'center',
    marginTop: spacing.xl,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.border.primary,
  },
  topBarButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: theme.background.elevated,
    borderWidth: 1,
    borderColor: theme.border.primary,
  },
  topBarCenter: {
    flex: 1,
    marginHorizontal: spacing.md,
  },
  topBarTitle: {
    color: theme.text.primary,
    fontSize: 16,
    fontWeight: '700',
  },
  topBarSubtitle: {
    color: theme.text.tertiary,
    fontSize: 13,
    marginTop: 2,
  },
  summaryCard: {
    backgroundColor: theme.card.background,
    borderRadius: 14,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: theme.border.primary,
  },
  summaryTitle: {
    color: theme.text.primary,
    fontSize: 16,
    fontWeight: '700',
  },
  summaryLine: {
    marginTop: spacing.xs,
    color: theme.text.secondary,
    fontSize: 13,
    fontWeight: '600',
  },
  summaryMeta: {
    marginTop: spacing.sm,
    color: theme.text.tertiary,
    fontSize: 12,
  },
  card: {
    backgroundColor: theme.card.background,
    borderRadius: 14,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: theme.border.primary,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  cardTitle: {
    color: theme.text.secondary,
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  cardSubtitle: {
    marginTop: spacing.xs,
    color: theme.text.tertiary,
    fontSize: 12,
  },
  cardDivider: {
    height: 1,
    backgroundColor: theme.border.primary,
    marginVertical: spacing.lg,
  },
  monthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
    justifyContent: 'center',
  },
  monthLabel: {
    color: theme.text.primary,
    fontSize: 14,
    fontWeight: '700',
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.background.elevated,
    borderWidth: 1,
    borderColor: theme.border.primary,
  },
  todayButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 12,
    backgroundColor: theme.accent.primary + '20',
    borderWidth: 1,
    borderColor: theme.accent.primary,
  },
  todayButtonText: {
    color: theme.accent.primary,
    fontWeight: '700',
    fontSize: 12,
  },
  weekHeaderRow: {
    flexDirection: 'row',
    marginTop: spacing.lg,
  },
  weekHeaderLabel: {
    flex: 1,
    textAlign: 'center',
    color: theme.text.tertiary,
    fontSize: 11,
    fontWeight: '700',
  },
  monthGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: spacing.sm,
  },
  dayCell: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    padding: 2,
  },
  dayCellOutside: {
    opacity: 0.55,
  },
  dayCellSelected: {
    backgroundColor: theme.accent.primary,
  },
  dayCellToday: {
    borderWidth: 1,
    borderColor: theme.accent.primary,
  },
  dayLabel: {
    color: theme.text.primary,
    fontSize: 13,
    fontWeight: '600',
  },
  dayLabelOutside: {
    color: theme.text.tertiary,
  },
  dayLabelSelected: {
    color: theme.background.primary,
    fontWeight: '800',
  },
  dayLabelToday: {
    color: theme.accent.primary,
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    alignItems: 'center',
    marginTop: spacing.md,
  },
  pill: {
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.border.secondary,
    backgroundColor: theme.background.elevated,
  },
  pillSelected: {
    backgroundColor: theme.accent.primary,
    borderColor: theme.accent.primary,
  },
  pillText: {
    color: theme.text.secondary,
    fontSize: 12,
    fontWeight: '700',
  },
  pillTextSelected: {
    color: theme.background.primary,
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
    gap: spacing.sm,
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
  pickerButton: {
    backgroundColor: theme.card.background,
    borderRadius: 10,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderWidth: 1,
    borderColor: theme.border.primary,
  },
  pickerButtonLabel: {
    fontSize: 12,
    color: theme.text.tertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  pickerValue: {
    fontSize: 16,
    color: theme.text.primary,
    fontWeight: '600',
    marginTop: spacing.xs,
  },
  pickerWrapper: {
    marginTop: spacing.md,
    backgroundColor: theme.card.background,
    borderRadius: 12,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: theme.border.primary,
  },
  pickerDoneButton: {
    marginTop: spacing.sm,
    alignSelf: 'flex-end',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 8,
    backgroundColor: theme.accent.primary,
  },
  pickerDoneText: {
    color: theme.background.primary,
    fontWeight: '600',
  },
  choiceRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    alignItems: 'center',
  },
  choiceButton: {
    backgroundColor: theme.card.background,
    borderRadius: 10,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderColor: theme.border.primary,
    minWidth: 120,
  },
  choiceButtonSelected: {
    borderColor: theme.accent.primary,
    backgroundColor: theme.accent.primary + '20',
  },
  choiceLabel: {
    color: theme.text.secondary,
    fontSize: 13,
    fontWeight: '600',
  },
  choiceLabelSelected: {
    color: theme.accent.primary,
  },
  choiceValue: {
    marginTop: spacing.xs,
    color: theme.text.primary,
    fontSize: 14,
    fontWeight: '500',
  },
  helperText: {
    color: theme.text.tertiary,
    fontSize: 12,
  },
  timeChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  timeChip: {
    backgroundColor: theme.card.background,
    borderRadius: 16,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderWidth: 1,
    borderColor: theme.border.secondary,
  },
  timeChipLabel: {
    color: theme.text.primary,
    fontSize: 13,
    fontWeight: '500',
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
  customDurationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
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
  durationInput: {
    flex: 1,
    backgroundColor: theme.card.background,
    borderRadius: 8,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderColor: theme.border.primary,
    color: theme.text.primary,
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
  repeatPreview: {
    marginTop: spacing.md,
    color: theme.text.tertiary,
    fontSize: 12,
  },
  advancedButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 12,
    backgroundColor: theme.background.elevated,
    borderWidth: 1,
    borderColor: theme.border.primary,
  },
  advancedButtonText: {
    color: theme.text.secondary,
    fontSize: 12,
    fontWeight: '700',
  },
  collapsibleHeader: {
    marginTop: spacing.lg,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  collapsibleTitle: {
    color: theme.text.secondary,
    fontSize: 13,
    fontWeight: '700',
  },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    gap: spacing.sm,
    backgroundColor: theme.background.primary,
    borderTopWidth: 1,
    borderTopColor: theme.border.primary,
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
  modalHint: {
    color: theme.text.tertiary,
    fontSize: 12,
    marginBottom: spacing.sm,
  },
  modalActions: {
    marginTop: spacing.lg,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm,
  },
  secondaryButton: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.border.primary,
    backgroundColor: theme.background.elevated,
  },
  secondaryButtonText: {
    color: theme.text.primary,
    fontWeight: '700',
  },
  primaryButton: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: 10,
    backgroundColor: theme.accent.primary,
  },
  primaryButtonText: {
    color: theme.background.primary,
    fontWeight: '800',
  },
});
