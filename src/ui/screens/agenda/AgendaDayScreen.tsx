import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import theme from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { getAgendaService } from '../../../core/DependencyContainer';
import { ScheduledTask, DayAgenda } from '../../../services/AgendaService';
import { AgendaStackParamList } from '../../navigation/TabNavigator';

type AgendaDayRouteProp = RouteProp<AgendaStackParamList, 'AgendaDay'>;
type AgendaDayNavProp = StackNavigationProp<AgendaStackParamList, 'AgendaDay'>;

const TASK_TYPE_ICONS = {
  regular: '📋',
  meeting: '👥',
  milestone: '🎯',
};

const HOURS = Array.from({ length: 24 }, (_, i) => i);

export default function AgendaDayScreen() {
  const route = useRoute<AgendaDayRouteProp>();
  const navigation = useNavigation<AgendaDayNavProp>();
  const { date } = route.params;

  const [dayAgenda, setDayAgenda] = useState<DayAgenda | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadDayData = useCallback(async () => {
    try {
      const agendaService = getAgendaService();
      const data = await agendaService.getTasksForDate(date);
      setDayAgenda(data);
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

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadDayData();
    setRefreshing(false);
  }, [loadDayData]);

  const getTasksForHour = (hour: number): ScheduledTask[] => {
    if (!dayAgenda) return [];

    const allTasks = [
      ...dayAgenda.meetings,
      ...dayAgenda.tasks,
      ...dayAgenda.milestones,
    ];

    return allTasks.filter(st => {
      if (!st.task.scheduled_time) return false;
      const taskHour = parseInt(st.task.scheduled_time.split(':')[0], 10);
      return taskHour === hour;
    });
  };

  const getUnscheduledTimeTasks = (): ScheduledTask[] => {
    if (!dayAgenda) return [];

    const allTasks = [
      ...dayAgenda.meetings,
      ...dayAgenda.tasks,
      ...dayAgenda.milestones,
    ];

    return allTasks.filter(st => !st.task.scheduled_time);
  };

  const formatHour = (hour: number): string => {
    if (hour === 0) return '12 AM';
    if (hour === 12) return '12 PM';
    if (hour < 12) return `${hour} AM`;
    return `${hour - 12} PM`;
  };

  const renderTaskCard = (item: ScheduledTask, compact: boolean = false) => {
    const task = item.task;
    const icon = TASK_TYPE_ICONS[task.task_type];
    const duration = task.time_block_minutes;

    return (
      <TouchableOpacity
        key={task.id}
        style={[styles.taskCard, compact && styles.taskCardCompact]}
        onPress={() => navigation.navigate('TaskSchedule', { taskId: task.id, boardId: item.boardId })}
      >
        <View style={styles.taskCardLeft}>
          <Text style={styles.taskIcon}>{icon}</Text>
        </View>
        <View style={styles.taskCardContent}>
          <Text style={styles.taskTitle} numberOfLines={1}>{task.title}</Text>
          <View style={styles.taskMeta}>
            <Text style={styles.taskBoard}>{item.boardName}</Text>
            {duration && (
              <Text style={styles.taskDuration}>{duration} min</Text>
            )}
          </View>
        </View>
        {task.task_type === 'meeting' && task.meeting_data?.location && (
          <Text style={styles.taskLocation} numberOfLines={1}>
            📍 {task.meeting_data.location}
          </Text>
        )}
      </TouchableOpacity>
    );
  };

  const renderTimeSlot = (hour: number) => {
    const tasks = getTasksForHour(hour);
    const hasTask = tasks.length > 0;

    return (
      <View key={hour} style={styles.timeSlot}>
        <View style={styles.timeLabel}>
          <Text style={[styles.timeLabelText, hasTask && styles.timeLabelTextActive]}>
            {formatHour(hour)}
          </Text>
        </View>
        <View style={styles.timeContent}>
          <View style={[styles.timeLine, hasTask && styles.timeLineActive]} />
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
    dayAgenda.tasks.some(t => t.task.scheduled_time) ||
    dayAgenda.meetings.some(t => t.task.scheduled_time) ||
    dayAgenda.milestones.some(t => t.task.scheduled_time)
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
      {unscheduledTasks.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>All Day</Text>
          {unscheduledTasks.map(task => renderTaskCard(task))}
        </View>
      )}

      <View style={styles.timeline}>
        {HOURS.map(renderTimeSlot)}
      </View>

      {!hasScheduledTasks && unscheduledTasks.length === 0 && (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>📅</Text>
          <Text style={styles.emptyTitle}>No tasks for this day</Text>
          <Text style={styles.emptySubtitle}>Tasks scheduled for this date will appear here</Text>
        </View>
      )}

      <View style={styles.bottomPadding} />
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
  sectionTitle: {
    color: theme.text.secondary,
    fontSize: 13,
    fontWeight: '600',
    marginBottom: spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
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
  taskCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.card.background,
    borderRadius: 8,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  taskCardCompact: {
    marginTop: spacing.xs,
    marginBottom: 0,
  },
  taskCardLeft: {
    marginRight: spacing.sm,
  },
  taskIcon: {
    fontSize: 18,
  },
  taskCardContent: {
    flex: 1,
  },
  taskTitle: {
    color: theme.text.primary,
    fontSize: 15,
    fontWeight: '500',
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
  },
  taskLocation: {
    color: theme.text.secondary,
    fontSize: 12,
    maxWidth: 100,
  },
  emptyState: {
    alignItems: 'center',
    padding: spacing.xxl,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: spacing.md,
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
});
