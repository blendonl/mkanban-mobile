import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { ScheduledAgendaItem } from '../../services/AgendaService';
import { OrphanedItemBadge } from './OrphanedItemBadge';
import { TimeBlockBar } from './TimeBlockBar';
import { theme } from '../theme/colors';
import AppIcon, { AppIconName } from './icons/AppIcon';

interface AgendaItemCardProps {
  scheduledItem: ScheduledAgendaItem;
  onPress: () => void;
  onLongPress?: () => void;
}

export const AgendaItemCard: React.FC<AgendaItemCardProps> = ({
  scheduledItem,
  onPress,
  onLongPress,
}) => {
  const { agendaItem, task, projectName, boardName, columnName, isOrphaned } = scheduledItem;

  const getTaskTypeIcon = (): AppIconName => {
    switch (agendaItem.task_type) {
      case 'meeting':
        return 'users';
      case 'milestone':
        return 'milestone';
      default:
        return 'task';
    }
  };

  const getTaskTypeMeta = () => {
    switch (agendaItem.task_type) {
      case 'meeting':
        return { label: 'Meeting', color: theme.accent.success };
      case 'milestone':
        return { label: 'Milestone', color: theme.accent.secondary };
      default:
        return { label: 'Task', color: theme.accent.primary };
    }
  };

  const formatTime = (time: string | null) => {
    if (!time) return null;
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours);
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

  const taskTitle = task?.title || agendaItem.task_id;
  const typeMeta = getTaskTypeMeta();
  const timeLabel = formatTime(agendaItem.scheduled_time);

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
            <AppIcon name={getTaskTypeIcon()} size={16} color={typeMeta.color} />
          </View>
          <View style={styles.titleBlock}>
            <Text style={[styles.title, isOrphaned && styles.titleOrphaned]} numberOfLines={2}>
              {taskTitle}
            </Text>
            <Text style={styles.typeLabel}>{typeMeta.label}</Text>
          </View>
        </View>
        {timeLabel && (
          <View style={styles.timeBadge}>
            <Text style={styles.timeText}>{timeLabel}</Text>
          </View>
        )}
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
        {columnName && !isOrphaned && (
          <View style={styles.columnBadge}>
            <Text style={styles.columnBadgeText}>{columnName}</Text>
          </View>
        )}
      </View>

      <View style={styles.detailsRow}>
        {agendaItem.duration_minutes && (
          <View style={styles.detailChip}>
            <AppIcon name="clock" size={12} color={theme.text.secondary} />
            <Text style={styles.detailChipText}>
              {formatDuration(agendaItem.duration_minutes)}
            </Text>
          </View>
        )}
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

      {agendaItem.duration_minutes && (
        <TimeBlockBar
          taskType={agendaItem.task_type}
          durationMinutes={agendaItem.duration_minutes}
          maxDurationMinutes={120}
        />
      )}

      {task?.description && (
        <Text style={styles.descriptionText} numberOfLines={1}>
          {task.description}
        </Text>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.card.background,
    borderRadius: 12,
    padding: 14,
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
  columnBadge: {
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 10,
    backgroundColor: theme.background.elevated,
    borderWidth: 1,
    borderColor: theme.border.secondary,
    marginLeft: 8,
  },
  columnBadgeText: {
    fontSize: 10,
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
