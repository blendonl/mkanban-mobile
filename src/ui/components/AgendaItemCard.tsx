import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { ScheduledAgendaItem } from '../../services/AgendaService';
import { OrphanedItemBadge } from './OrphanedItemBadge';
import { theme } from '../theme/colors';

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

  const getTaskTypeIcon = () => {
    switch (agendaItem.task_type) {
      case 'meeting':
        return '👥';
      case 'milestone':
        return '🎯';
      default:
        return '📋';
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

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onPress}
      onLongPress={onLongPress}
      activeOpacity={0.7}
    >
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Text style={styles.icon}>{getTaskTypeIcon()}</Text>
          <Text style={[styles.title, isOrphaned && styles.titleOrphaned]} numberOfLines={2}>
            {taskTitle}
          </Text>
        </View>
        {agendaItem.scheduled_time && (
          <Text style={styles.time}>
            {formatTime(agendaItem.scheduled_time)}
          </Text>
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
          <Text style={styles.columnBadge}>{columnName}</Text>
        )}
      </View>

      {agendaItem.duration_minutes && (
        <View style={styles.durationContainer}>
          <Text style={styles.durationText}>
            ⏱️ {formatDuration(agendaItem.duration_minutes)}
          </Text>
        </View>
      )}

      {agendaItem.meeting_data?.location && (
        <View style={styles.locationContainer}>
          <Text style={styles.locationText} numberOfLines={1}>
            📍 {agendaItem.meeting_data.location}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.card.background,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: theme.card.border,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  titleRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  icon: {
    fontSize: 20,
  },
  title: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: theme.text.primary,
  },
  titleOrphaned: {
    color: theme.text.tertiary,
    textDecorationLine: 'line-through',
  },
  time: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.accent.primary,
    marginLeft: 8,
  },
  orphanedBadgeContainer: {
    marginBottom: 8,
  },
  metadata: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  metadataText: {
    flex: 1,
    fontSize: 12,
    color: theme.text.tertiary,
  },
  columnBadge: {
    fontSize: 10,
    color: theme.text.secondary,
    backgroundColor: theme.background.elevated,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 8,
  },
  durationContainer: {
    marginTop: 4,
  },
  durationText: {
    fontSize: 12,
    color: theme.text.secondary,
  },
  locationContainer: {
    marginTop: 4,
  },
  locationText: {
    fontSize: 12,
    color: theme.text.secondary,
  },
});
