import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { ScheduledAgendaItem } from '../../services/AgendaService';
import { OrphanedItemBadge } from './OrphanedItemBadge';
import { theme } from '../theme/colors';
import AppIcon, { AppIconName } from './icons/AppIcon';

interface AgendaItemCardProps {
  scheduledItem: ScheduledAgendaItem;
  onPress: () => void;
  onLongPress?: () => void;
  onToggleComplete?: () => void;
}

type TaskType = 'meeting' | 'milestone' | null;

const getTaskTypeIcon = (taskType: TaskType): AppIconName => {
  switch (taskType) {
    case 'meeting':
      return 'users';
    case 'milestone':
      return 'milestone';
    default:
      return 'task';
  }
};

const getTaskTypeMeta = (taskType: TaskType) => {
  switch (taskType) {
    case 'meeting':
      return { label: 'Meeting', color: theme.accent.success };
    case 'milestone':
      return { label: 'Milestone', color: theme.accent.secondary };
    default:
      return { label: 'Task', color: theme.accent.primary };
  }
};

const formatTime = (time: string | null | undefined) => {
  if (!time || typeof time !== 'string') return null;
  const [hours, minutes] = time.split(':');
  if (!hours || !minutes) return null;
  const hour = parseInt(hours, 10);
  if (Number.isNaN(hour)) return null;
  const period = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
  return `${displayHour}:${minutes} ${period}`;
};

const formatDuration = (minutes: number | null) => {
  if (!minutes) return null;
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
};

const AgendaItemCardComponent: React.FC<AgendaItemCardProps> = ({
  scheduledItem,
  onPress,
  onLongPress,
  onToggleComplete,
}) => {
  const { agendaItem, task, projectName, boardName, columnName, isOrphaned } = scheduledItem;

  const taskTitle = useMemo(
    () => task?.title || agendaItem.task_id,
    [task?.title, agendaItem.task_id]
  );

  const typeMeta = useMemo(
    () => getTaskTypeMeta(agendaItem.task_type),
    [agendaItem.task_type]
  );

  const timeLabel = useMemo(
    () => formatTime(agendaItem.scheduled_time),
    [agendaItem.scheduled_time]
  );

  const isCompleted = !!agendaItem.completed_at;

  const hasDetailChips = !!agendaItem.meeting_data?.location
    || (!!agendaItem.meeting_data?.attendees && agendaItem.meeting_data.attendees.length > 0);

  return (
    <TouchableOpacity
      style={[styles.card, { borderLeftColor: typeMeta.color }]}
      onPress={onPress}
      onLongPress={onLongPress}
      activeOpacity={0.7}
    >
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <View style={[styles.typeBadge, { backgroundColor: `${typeMeta.color}22` }]}>
            <AppIcon name={getTaskTypeIcon(agendaItem.task_type)} size={16} color={typeMeta.color} />
          </View>
          <View style={styles.titleBlock}>
            <Text
              style={[
                styles.title,
                isOrphaned && styles.titleOrphaned,
                isCompleted && styles.titleCompleted,
              ]}
              numberOfLines={2}
            >
              {taskTitle}
            </Text>
            <Text style={styles.typeLabel}>{typeMeta.label}</Text>
          </View>
        </View>
        <View style={styles.headerActions}>
          {!!onToggleComplete && (
            <TouchableOpacity
              style={[styles.completeToggle, isCompleted && styles.completeToggleDone]}
              onPress={(event) => {
                event.stopPropagation?.();
                onToggleComplete();
              }}
              activeOpacity={0.7}
            >
              <AppIcon
                name="check"
                size={14}
                color={isCompleted ? theme.background.primary : theme.accent.success}
              />
            </TouchableOpacity>
          )}
          {!isCompleted && timeLabel && (
            <View style={styles.timeBadge}>
              <Text style={styles.timeText}>{timeLabel}</Text>
            </View>
          )}
        </View>
      </View>

      {isOrphaned && (
        <View style={styles.orphanedBadgeContainer}>
          <OrphanedItemBadge size="small" />
        </View>
      )}

      <View style={styles.metadata}>
        <Text style={styles.metadataText} numberOfLines={1}>
          {projectName} / {boardName}
        </Text>
        {agendaItem.duration_minutes && (
          <View style={styles.durationBadge}>
            <AppIcon name="clock" size={12} color={theme.text.secondary} />
            <Text style={styles.durationText}>
              {formatDuration(agendaItem.duration_minutes)}
            </Text>
          </View>
        )}
      </View>

      {hasDetailChips && (
        <View style={styles.detailsRow}>
          {agendaItem.meeting_data?.location && (
            <View style={styles.detailChip}>
              <AppIcon name="pin" size={12} color={theme.text.secondary} />
              <Text style={styles.detailChipText} numberOfLines={1}>
                {agendaItem.meeting_data.location}
              </Text>
            </View>
          )}
          {agendaItem.meeting_data?.attendees && agendaItem.meeting_data.attendees.length > 0 && (
            <View style={styles.detailChip}>
              <AppIcon name="users" size={12} color={theme.text.secondary} />
              <Text style={styles.detailChipText}>
                {agendaItem.meeting_data.attendees.length} {agendaItem.meeting_data.attendees.length === 1 ? 'person' : 'people'}
              </Text>
            </View>
          )}
        </View>
      )}

    </TouchableOpacity>
  );
};

const arePropsEqual = (
  prevProps: AgendaItemCardProps,
  nextProps: AgendaItemCardProps
): boolean => {
  const prevItem = prevProps.scheduledItem;
  const nextItem = nextProps.scheduledItem;

  return (
    prevItem.agendaItem.id === nextItem.agendaItem.id &&
    prevItem.agendaItem.completed_at === nextItem.agendaItem.completed_at &&
    prevItem.agendaItem.scheduled_time === nextItem.agendaItem.scheduled_time &&
    prevItem.agendaItem.task_type === nextItem.agendaItem.task_type &&
    prevItem.task?.title === nextItem.task?.title &&
    prevItem.isOrphaned === nextItem.isOrphaned &&
    prevProps.onPress === nextProps.onPress &&
    prevProps.onLongPress === nextProps.onLongPress &&
    prevProps.onToggleComplete === nextProps.onToggleComplete
  );
};

export const AgendaItemCard = React.memo(AgendaItemCardComponent, arePropsEqual);

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.card.background,
    borderRadius: 12,
    padding: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: theme.card.border,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginLeft: 8,
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
  },
  completeToggleDone: {
    backgroundColor: theme.accent.success,
    borderColor: theme.accent.success,
  },
  titleRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  typeBadge: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleBlock: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.text.primary,
  },
  titleOrphaned: {
    color: theme.text.tertiary,
    textDecorationLine: 'line-through',
  },
  titleCompleted: {
    textDecorationLine: 'line-through',
    color: theme.text.tertiary,
  },
  typeLabel: {
    fontSize: 12,
    color: theme.text.tertiary,
    marginTop: 2,
  },
  timeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    backgroundColor: theme.background.elevated,
    borderWidth: 1,
    borderColor: theme.border.secondary,
  },
  timeText: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.text.primary,
  },
  orphanedBadgeContainer: {
    marginBottom: 8,
  },
  metadata: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  metadataText: {
    flex: 1,
    fontSize: 12,
    color: theme.text.tertiary,
  },
  durationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: theme.background.elevated,
    borderWidth: 1,
    borderColor: theme.border.secondary,
    marginLeft: 8,
  },
  durationText: {
    fontSize: 12,
    color: theme.text.secondary,
    fontWeight: '600',
  },
  detailsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 6,
  },
  detailChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: theme.background.elevated,
    borderWidth: 1,
    borderColor: theme.border.secondary,
  },
  detailChipText: {
    fontSize: 12,
    color: theme.text.secondary,
  },
  descriptionText: {
    marginTop: 6,
    fontSize: 12,
    color: theme.text.tertiary,
  },
});
