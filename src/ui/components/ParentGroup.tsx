import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Task } from '../../domain/entities/Task';
import { Parent } from '../../domain/entities/Parent';
import TaskCard from './ItemCard';
import ParentBadge from './ParentBadge';
import theme from '../theme';

interface ParentGroupProps {
  parent: Parent | null;
  tasks: Task[];
  onTaskPress: (task: Task) => void;
  onTaskLongPress?: (task: Task) => void;
}

export default function ParentGroup({
  parent,
  tasks,
  onTaskPress,
  onTaskLongPress,
}: ParentGroupProps) {
  if (tasks.length === 0) {
    return null;
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        {parent ? (
          <ParentBadge name={parent.name} color={parent.color} size="medium" />
        ) : (
          <Text style={styles.ungroupedLabel}>No Parent</Text>
        )}
        <Text style={styles.count}>{tasks.length}</Text>
      </View>
      <View style={styles.tasks}>
        {tasks.map((task) => (
          <TaskCard
            key={task.id}
            task={task}
            parent={parent}
            onPress={() => onTaskPress(task)}
            onLongPress={onTaskLongPress ? () => onTaskLongPress(task) : undefined}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: theme.spacing.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.sm,
    paddingBottom: theme.spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: theme.border.primary,
  },
  ungroupedLabel: {
    ...theme.typography.textStyles.body,
    fontWeight: theme.typography.fontWeights.semibold,
    color: theme.text.secondary,
    fontStyle: 'italic',
  },
  count: {
    ...theme.typography.textStyles.bodySmall,
    fontWeight: theme.typography.fontWeights.semibold,
    color: theme.text.tertiary,
    backgroundColor: theme.background.elevated,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.radius.sm,
  },
  tasks: {
    gap: theme.spacing.sm,
  },
});
