import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
} from 'react-native';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import theme from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { getAgendaService, getGoalService } from '../../../core/DependencyContainer';
import { ScheduledAgendaItem, DayAgenda } from '../../../services/AgendaService';
import { AgendaStackParamList } from '../../navigation/TabNavigator';
import { TimeBlockBar } from '../../components/TimeBlockBar';
import AppIcon, { AppIconName } from '../../components/icons/AppIcon';
import ValueInputModal from '../../components/ValueInputModal';

type AgendaDayRouteProp = RouteProp<AgendaStackParamList, 'AgendaDay'>;
type AgendaDayNavProp = StackNavigationProp<AgendaStackParamList, 'AgendaDay'>;

const TASK_TYPE_ICONS: Record<string, AppIconName> = {
  regular: 'task',
  meeting: 'users',
  milestone: 'milestone',
};

const HOURS = Array.from({ length: 24 }, (_, i) => i);

export default function AgendaDayScreen() {
  const route = useRoute<AgendaDayRouteProp>();
  const navigation = useNavigation<AgendaDayNavProp>();
  const { date } = route.params;

  const [dayAgenda, setDayAgenda] = useState<DayAgenda | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [unfinishedItems, setUnfinishedItems] = useState<ScheduledAgendaItem[]>([]);
  const [showValueInput, setShowValueInput] = useState(false);
  const [selectedMeasurableTask, setSelectedMeasurableTask] = useState<ScheduledAgendaItem | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const loadDayData = useCallback(async () => {
    try {
      const agendaService = getAgendaService();
      const [data, unfinished] = await Promise.all([
        agendaService.getTasksForDate(date),
        agendaService.getUnfinishedItems(date),
      ]);
      setDayAgenda(data);
      setUnfinishedItems(unfinished);
    } catch (error) {
      console.error('Failed to load day data:', error);
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => {
    loadDayData();
  }, [loadDayData]);

  useEffect(() => {
    const displayDate = new Date(date).toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
    });
    navigation.setOptions({ title: displayDate });
  }, [date, navigation]);

  useEffect(() => {
    if (isCurrentDay()) {
      checkExpiredBlocks();
      timerRef.current = setInterval(checkExpiredBlocks, 60000);

      return () => {
        if (timerRef.current) {
          clearInterval(timerRef.current);
        }
      };
    }
  }, [isCurrentDay, checkExpiredBlocks]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadDayData();
    setRefreshing(false);
  }, [loadDayData]);

  const handleToggleComplete = async (item: ScheduledAgendaItem) => {
    try {
      const agendaService = getAgendaService();
      const agendaItem = item.agendaItem;
      if (agendaItem.completed_at) {
        agendaItem.markIncomplete();
      } else {
        agendaItem.markComplete();
      }
      await agendaService.updateAgendaItem(agendaItem);
      await loadDayData();
    } catch (error) {
      console.error('Failed to update agenda item status:', error);
    }
  };

  const handleLogProgress = (item: ScheduledAgendaItem) => {
    setSelectedMeasurableTask(item);
    setShowValueInput(true);
  };

  const handleSaveValue = async (value: number) => {
    if (!selectedMeasurableTask) return;

    try {
      const agendaService = getAgendaService();
      await agendaService.updateActualValue(selectedMeasurableTask.agendaItem.id, value);

      if (selectedMeasurableTask.task?.goal_id) {
        const goalService = getGoalService();
        await goalService.updateGoalProgress(selectedMeasurableTask.task.goal_id, value);
      }

      await loadDayData();
      setShowValueInput(false);
      setSelectedMeasurableTask(null);
    } catch (error) {
      console.error('Failed to save progress value:', error);
      Alert.alert('Error', 'Failed to save progress value');
    }
  };

  const handleDeleteUnfinished = async (item: ScheduledAgendaItem) => {
    Alert.alert(
      'Delete Unfinished Task',
      'Are you sure you want to delete this task from your agenda?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const agendaService = getAgendaService();
              await agendaService.deleteAgendaItem(item.agendaItem);
              await loadDayData();
            } catch (error) {
              console.error('Failed to delete unfinished item:', error);
              Alert.alert('Error', 'Failed to delete item');
            }
          },
        },
      ]
    );
  };

  const handleRescheduleUnfinished = (item: ScheduledAgendaItem) => {
    navigation.navigate('AgendaItemDetail', {
      agendaItemId: item.agendaItem.id,
    });
  };

  const checkExpiredBlocks = useCallback(async () => {
    if (!isCurrentDay()) return;

    const now = new Date();
    const items = dayAgenda?.items || [];
    let needsReload = false;

    for (const item of items) {
      if (item.agendaItem.completed_at || item.agendaItem.is_unfinished) continue;
      if (!item.agendaItem.scheduled_time || !item.agendaItem.duration_minutes) continue;

      const scheduledTime = new Date(`${date}T${item.agendaItem.scheduled_time}`);
      const endTime = new Date(scheduledTime.getTime() + item.agendaItem.duration_minutes * 60000);

      if (now > endTime) {
        needsReload = true;
        break;
      }
    }

    if (needsReload) {
      await loadDayData();
    }
  }, [isCurrentDay, dayAgenda, date, loadDayData]);

  const getTasksForHour = (hour: number): ScheduledAgendaItem[] => {
    if (!dayAgenda) return [];

    const allTasks = [
      ...dayAgenda.meetings,
      ...dayAgenda.regularTasks,
      ...dayAgenda.milestones,
    ];

    return allTasks.filter(si => {
      if (!si.agendaItem.scheduled_time) return false;
      const taskHour = parseInt(si.agendaItem.scheduled_time.split(':')[0], 10);
      return taskHour === hour;
    });
  };

  const getUnscheduledTimeTasks = (): ScheduledAgendaItem[] => {
    if (!dayAgenda) return [];

    const allTasks = [
      ...dayAgenda.meetings,
      ...dayAgenda.regularTasks,
      ...dayAgenda.milestones,
    ];

    return allTasks.filter(si => !si.agendaItem.scheduled_time);
  };

  const formatHour = (hour: number): string => {
    if (hour === 0) return '12 AM';
    if (hour === 12) return '12 PM';
    if (hour < 12) return `${hour} AM`;
    return `${hour - 12} PM`;
  };

  const isCurrentDay = () => {
    const today = new Date();
    return new Date(date).toDateString() === today.toDateString();
  };

  const renderTaskCard = (item: ScheduledAgendaItem, compact: boolean = false, showUnfinishedActions: boolean = false) => {
    const { agendaItem, task, boardName, isOrphaned } = item;
    const icon = TASK_TYPE_ICONS[agendaItem.task_type];
    const duration = agendaItem.duration_minutes;
    const taskTitle = task?.title || agendaItem.task_id;
    const isCompleted = !!agendaItem.completed_at;
    const isMeasurable = task?.target_value && task?.value_unit;

    return (
      <View key={agendaItem.id} style={[styles.taskCardWrapper, compact && styles.taskCardCompact]}>
        <TouchableOpacity
          style={[
            styles.taskCard,
            isOrphaned && styles.taskCardOrphaned,
            showUnfinishedActions && styles.taskCardUnfinished,
          ]}
          onPress={() => navigation.navigate('AgendaItemDetail', { agendaItemId: agendaItem.id })}
        >
          <View style={styles.taskCardLeft}>
            <View style={styles.taskIconBadge}>
              <AppIcon name={icon} size={14} color={theme.text.secondary} />
            </View>
          </View>
          <View style={styles.taskCardContent}>
            <Text
              style={[
                styles.taskTitle,
                isOrphaned && styles.taskTitleOrphaned,
                isCompleted && styles.taskTitleCompleted,
              ]}
              numberOfLines={1}
            >
              {taskTitle}
            </Text>
            <View style={styles.taskMeta}>
              <Text style={styles.taskBoard}>{boardName}</Text>
              {duration && (
                <Text style={styles.taskDuration}>{duration} min</Text>
              )}
              {isMeasurable && (
                <Text style={styles.taskMeasurable}>
                  {task.target_value} {task.value_unit}
                </Text>
              )}
            </View>
            {duration && (
              <TimeBlockBar
                taskType={agendaItem.task_type}
                durationMinutes={duration}
                maxDurationMinutes={120}
              />
            )}
          </View>
          {agendaItem.task_type === 'meeting' && agendaItem.meeting_data?.location && (
            <View style={styles.taskLocation}>
              <AppIcon name="pin" size={14} color={theme.text.tertiary} />
              <Text style={styles.taskLocationText} numberOfLines={1}>
                {agendaItem.meeting_data.location}
              </Text>
            </View>
          )}
          {isMeasurable && !showUnfinishedActions && (
            <TouchableOpacity
              style={styles.progressButton}
              onPress={(event) => {
                event.stopPropagation?.();
                handleLogProgress(item);
              }}
            >
              <AppIcon name="trending-up" size={14} color={theme.accent.primary} />
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[styles.completeToggle, isCompleted && styles.completeToggleDone]}
            onPress={(event) => {
              event.stopPropagation?.();
              handleToggleComplete(item);
            }}
            activeOpacity={0.7}
          >
            <AppIcon
              name="check"
              size={14}
              color={isCompleted ? theme.background.primary : theme.accent.success}
            />
          </TouchableOpacity>
        </TouchableOpacity>
        {showUnfinishedActions && (
          <View style={styles.unfinishedActions}>
            <TouchableOpacity
              style={styles.unfinishedActionButton}
              onPress={() => handleRescheduleUnfinished(item)}
            >
              <AppIcon name="clock" size={14} color={theme.accent.primary} />
              <Text style={styles.unfinishedActionText}>Reschedule</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.unfinishedActionButton, styles.unfinishedActionButtonDanger]}
              onPress={() => handleDeleteUnfinished(item)}
            >
              <AppIcon name="trash" size={14} color={theme.status.error} />
              <Text style={[styles.unfinishedActionText, styles.unfinishedActionTextDanger]}>Delete</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  const renderTimeSlot = (hour: number) => {
    const tasks = getTasksForHour(hour);
    const hasTask = tasks.length > 0;
    const isCurrentHour = isCurrentDay() && new Date().getHours() === hour;

    return (
      <View key={hour} style={styles.timeSlot}>
        <View style={styles.timeLabel}>
          <Text
            style={[
              styles.timeLabelText,
              hasTask && styles.timeLabelTextActive,
              isCurrentHour && styles.timeLabelTextCurrent,
            ]}
          >
            {formatHour(hour)}
          </Text>
        </View>
        <View style={styles.timeContent}>
          <View style={[
            styles.timeLine,
            hasTask && styles.timeLineActive,
            isCurrentHour && styles.timeLineCurrent,
          ]} />
          {isCurrentHour && <View style={styles.currentHourDot} />}
          {tasks.map(task => renderTaskCard(task, true))}
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  const unscheduledTasks = getUnscheduledTimeTasks();
  const hasScheduledTasks = dayAgenda && (
    dayAgenda.regularTasks.some(si => si.agendaItem.scheduled_time) ||
    dayAgenda.meetings.some(si => si.agendaItem.scheduled_time) ||
    dayAgenda.milestones.some(si => si.agendaItem.scheduled_time)
  );

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={theme.accent.primary}
        />
      }
    >
      {unfinishedItems.length > 0 && (
        <View style={[styles.section, styles.unfinishedSection]}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleRow}>
              <AppIcon name="alert-circle" size={16} color={theme.status.error} />
              <Text style={[styles.sectionTitle, styles.unfinishedTitle]}>Unfinished</Text>
            </View>
            <Text style={styles.sectionCount}>{unfinishedItems.length}</Text>
          </View>
          {unfinishedItems.map(task => renderTaskCard(task, false, true))}
        </View>
      )}

      {unscheduledTasks.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>All day</Text>
            <Text style={styles.sectionCount}>{unscheduledTasks.length}</Text>
          </View>
          {unscheduledTasks.map(task => renderTaskCard(task))}
        </View>
      )}

      <View style={styles.timeline}>
        {HOURS.map(renderTimeSlot)}
      </View>

      {!hasScheduledTasks && unscheduledTasks.length === 0 && (
        <View style={styles.emptyState}>
          <AppIcon name="calendar" size={28} color={theme.text.muted} />
          <Text style={styles.emptyTitle}>Nothing scheduled yet</Text>
          <Text style={styles.emptySubtitle}>Add tasks to your agenda to see them here.</Text>
        </View>
      )}

      <View style={styles.bottomPadding} />

      <ValueInputModal
        visible={showValueInput}
        onClose={() => {
          setShowValueInput(false);
          setSelectedMeasurableTask(null);
        }}
        onSave={handleSaveValue}
        valueUnit={selectedMeasurableTask?.task?.value_unit}
        currentValue={selectedMeasurableTask?.agendaItem.actual_value || 0}
        targetValue={selectedMeasurableTask?.task?.target_value}
      />
    </ScrollView>
  );
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
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.border.primary,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  sectionTitle: {
    color: theme.text.secondary,
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sectionCount: {
    color: theme.text.muted,
    fontSize: 12,
    backgroundColor: theme.background.elevated,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: 10,
  },
  timeline: {
    paddingTop: spacing.sm,
  },
  timeSlot: {
    flexDirection: 'row',
    minHeight: 50,
  },
  timeLabel: {
    width: 60,
    paddingRight: spacing.sm,
    alignItems: 'flex-end',
  },
  timeLabelText: {
    color: theme.text.muted,
    fontSize: 12,
    fontWeight: '500',
  },
  timeLabelTextActive: {
    color: theme.text.secondary,
  },
  timeLabelTextCurrent: {
    color: theme.accent.primary,
  },
  timeContent: {
    flex: 1,
    borderLeftWidth: 1,
    borderLeftColor: theme.border.primary,
    paddingLeft: spacing.md,
    paddingBottom: spacing.sm,
    minHeight: 50,
  },
  timeLine: {
    position: 'absolute',
    left: -3,
    top: 0,
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: theme.border.primary,
  },
  timeLineActive: {
    backgroundColor: theme.accent.primary,
  },
  timeLineCurrent: {
    backgroundColor: theme.accent.primary,
  },
  currentHourDot: {
    position: 'absolute',
    left: -7,
    top: -2,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: theme.accent.primary,
    borderWidth: 2,
    borderColor: theme.background.primary,
  },
  taskCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.card.background,
    borderRadius: 8,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: theme.card.border,
  },
  taskCardCompact: {
    marginTop: spacing.xs,
    marginBottom: 0,
  },
  taskCardOrphaned: {
    opacity: 0.6,
    borderColor: theme.accent.error,
  },
  taskCardLeft: {
    marginRight: spacing.sm,
  },
  taskIconBadge: {
    width: 26,
    height: 26,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.background.elevated,
    borderWidth: 1,
    borderColor: theme.border.secondary,
  },
  taskCardContent: {
    flex: 1,
  },
  taskTitle: {
    color: theme.text.primary,
    fontSize: 15,
    fontWeight: '500',
  },
  taskTitleOrphaned: {
    textDecorationLine: 'line-through',
    color: theme.text.secondary,
  },
  taskTitleCompleted: {
    textDecorationLine: 'line-through',
    color: theme.text.tertiary,
  },
  taskMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  taskBoard: {
    color: theme.text.secondary,
    fontSize: 12,
  },
  taskDuration: {
    color: theme.text.muted,
    fontSize: 12,
    marginLeft: spacing.sm,
    backgroundColor: theme.background.elevated,
    paddingHorizontal: spacing.xs,
    paddingVertical: 1,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: theme.border.secondary,
  },
  taskLocation: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    maxWidth: 140,
  },
  taskLocationText: {
    color: theme.text.secondary,
    fontSize: 12,
    flexShrink: 1,
  },
  completeToggle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: theme.accent.success,
    backgroundColor: theme.card.background,
    marginLeft: spacing.sm,
  },
  completeToggleDone: {
    backgroundColor: theme.accent.success,
    borderColor: theme.accent.success,
  },
  emptyState: {
    alignItems: 'center',
    padding: spacing.xxl,
  },
  emptyTitle: {
    color: theme.text.primary,
    fontSize: 18,
    fontWeight: '600',
    marginBottom: spacing.xs,
  },
  emptySubtitle: {
    color: theme.text.secondary,
    fontSize: 14,
    textAlign: 'center',
  },
  bottomPadding: {
    height: spacing.xxl,
  },
  taskCardWrapper: {
    marginBottom: spacing.sm,
  },
  taskCardUnfinished: {
    borderColor: theme.status.error,
    borderWidth: 1.5,
  },
  unfinishedSection: {
    backgroundColor: theme.status.error + '10',
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  unfinishedTitle: {
    color: theme.status.error,
  },
  unfinishedActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  unfinishedActionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: 8,
    backgroundColor: theme.background.elevated,
    borderWidth: 1,
    borderColor: theme.accent.primary,
  },
  unfinishedActionButtonDanger: {
    borderColor: theme.status.error,
  },
  unfinishedActionText: {
    color: theme.accent.primary,
    fontSize: 12,
    fontWeight: '600',
  },
  unfinishedActionTextDanger: {
    color: theme.status.error,
  },
  taskMeasurable: {
    color: theme.text.muted,
    fontSize: 11,
    marginLeft: spacing.sm,
    backgroundColor: theme.accent.primary + '20',
    paddingHorizontal: spacing.xs,
    paddingVertical: 1,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: theme.accent.primary,
  },
  progressButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: theme.accent.primary,
    backgroundColor: theme.card.background,
    marginLeft: spacing.sm,
  },
});
