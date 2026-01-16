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
import { ScheduledAgendaItem, DayAgenda } from '../../../services/AgendaService';
import { AgendaStackParamList } from '../../navigation/TabNavigator';
import { TimeBlockBar } from '../../components/TimeBlockBar';
import AppIcon, { AppIconName } from '../../components/icons/AppIcon';

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

  const renderTaskCard = (item: ScheduledAgendaItem, compact: boolean = false) => {
    const { agendaItem, task, boardName, isOrphaned } = item;
    const icon = TASK_TYPE_ICONS[agendaItem.task_type];
    const duration = agendaItem.duration_minutes;
    const taskTitle = task?.title || agendaItem.task_id;

    return (
      <TouchableOpacity
        key={agendaItem.id}
        style={[styles.taskCard, compact && styles.taskCardCompact, isOrphaned && styles.taskCardOrphaned]}
        onPress={() => navigation.navigate('AgendaItemDetail', { agendaItemId: agendaItem.id })}
      >
        <View style={styles.taskCardLeft}>
          <View style={styles.taskIconBadge}>
            <AppIcon name={icon} size={14} color={theme.text.secondary} />
          </View>
        </View>
        <View style={styles.taskCardContent}>
          <Text style={[styles.taskTitle, isOrphaned && styles.taskTitleOrphaned]} numberOfLines={1}>
            {taskTitle}
          </Text>
          <View style={styles.taskMeta}>
            <Text style={styles.taskBoard}>{boardName}</Text>
            {duration && (
              <Text style={styles.taskDuration}>{duration} min</Text>
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
      </TouchableOpacity>
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
});
