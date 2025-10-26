import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Task } from '../../domain/entities/Task';
import { Parent } from '../../domain/entities/Parent';
import ParentBadge from './ParentBadge';
import theme from '../theme';
import { getIssueTypeIcon } from '../../utils/issueTypeUtils';
import { uiConstants } from '../theme';

interface TaskCardProps {
  task: Task;
  parent?: Parent;
  onPress: () => void;
  onLongPress?: () => void;
}

const TaskCard = React.memo<TaskCardProps>(({ task, parent, onPress, onLongPress }) => {
  // Use centralized issue type utility
  const icon = getIssueTypeIcon(task.getIssueType());

  // Extract description preview
  const descriptionPreview = task.description
    ? task.description.length > uiConstants.DESCRIPTION_PREVIEW_LENGTH
      ? `${task.description.substring(0, uiConstants.DESCRIPTION_PREVIEW_LENGTH)}...`
      : task.description
    : '';

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onPress}
      onLongPress={onLongPress}
      activeOpacity={theme.ui.PRESSED_OPACITY}
    >
      <View style={styles.header}>
        <Text style={styles.icon}>{icon}</Text>
        <Text style={styles.title} numberOfLines={2}>
          {task.title}
        </Text>
      </View>

      {parent && (
        <View style={styles.parentContainer}>
          <ParentBadge name={parent.name} color={parent.color} size="small" />
        </View>
      )}

      {descriptionPreview && (
        <Text style={styles.description} numberOfLines={3}>
          {descriptionPreview}
        </Text>
      )}

      {task.id && (
        <Text style={styles.taskId}>{task.id}</Text>
      )}
    </TouchableOpacity>
  );
});

TaskCard.displayName = 'TaskCard';

export default TaskCard;

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.card.background,
    borderRadius: theme.radius.card,
    padding: theme.spacing.cardPadding,
    marginBottom: theme.spacing.sm,
    borderWidth: 1,
    borderColor: theme.card.border,
    ...theme.shadows.card,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: theme.spacing.sm,
  },
  icon: {
    fontSize: theme.typography.fontSizes.lg,
    marginRight: theme.spacing.sm,
    marginTop: 2,
  },
  title: {
    flex: 1,
    ...theme.typography.textStyles.body,
    fontWeight: theme.typography.fontWeights.semibold,
    color: theme.text.primary,
  },
  parentContainer: {
    marginBottom: theme.spacing.sm,
  },
  description: {
    ...theme.typography.textStyles.bodySmall,
    color: theme.text.secondary,
    marginBottom: theme.spacing.sm,
  },
  taskId: {
    ...theme.typography.textStyles.caption,
    color: theme.text.tertiary,
  },
});
