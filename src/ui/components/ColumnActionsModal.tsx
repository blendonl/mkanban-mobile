import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { Column } from '../../domain/entities/Column';
import BaseModal from './BaseModal';
import theme from '../theme';

interface ActionItem {
  id: string;
  icon: string;
  label: string;
  onPress: () => void;
  disabled?: boolean;
  destructive?: boolean;
  badge?: string | number;
}

interface ColumnActionsModalProps {
  visible: boolean;
  column: Column;
  canMoveLeft: boolean;
  canMoveRight: boolean;
  onClose: () => void;
  onRename: () => void;
  onMoveLeft: () => void;
  onMoveRight: () => void;
  onClearTasks: () => void;
  onMoveAllTasks: () => void;
  onDelete: () => void;
}

export default function ColumnActionsModal({
  visible,
  column,
  canMoveLeft,
  canMoveRight,
  onClose,
  onRename,
  onMoveLeft,
  onMoveRight,
  onClearTasks,
  onMoveAllTasks,
  onDelete,
}: ColumnActionsModalProps) {
  const taskCount = column.tasks.length;
  const canDelete = taskCount === 0;

  const actions: ActionItem[] = [
    {
      id: 'rename',
      icon: '✏️',
      label: 'Rename Column',
      onPress: onRename,
    },
    {
      id: 'move-left',
      icon: '⬅️',
      label: 'Move Left',
      onPress: onMoveLeft,
      disabled: !canMoveLeft,
    },
    {
      id: 'move-right',
      icon: '➡️',
      label: 'Move Right',
      onPress: onMoveRight,
      disabled: !canMoveRight,
    },
    {
      id: 'clear',
      icon: '🗑️',
      label: 'Clear All Tasks',
      onPress: onClearTasks,
      disabled: taskCount === 0,
      destructive: true,
      badge: taskCount > 0 ? taskCount : undefined,
    },
    {
      id: 'move-all',
      icon: '📤',
      label: 'Move All Tasks',
      onPress: onMoveAllTasks,
      disabled: taskCount === 0,
      badge: taskCount > 0 ? taskCount : undefined,
    },
    {
      id: 'delete',
      icon: '❌',
      label: 'Delete Column',
      onPress: onDelete,
      disabled: !canDelete,
      destructive: true,
    },
  ];

  return (
    <BaseModal
      visible={visible}
      onClose={onClose}
      title={`${column.name}`}
      scrollable
    >
      <View style={styles.header}>
        <Text style={styles.subtitle}>Column Actions</Text>
        {taskCount > 0 && (
          <Text style={styles.taskInfo}>
            {taskCount} {taskCount === 1 ? 'task' : 'tasks'}
          </Text>
        )}
      </View>

      {actions.map((action, index) => (
        <TouchableOpacity
          key={action.id}
          style={[
            styles.actionOption,
            action.disabled && styles.actionDisabled,
            action.destructive && !action.disabled && styles.actionDestructive,
            index === actions.length - 1 && styles.lastAction,
          ]}
          onPress={() => {
            if (!action.disabled) {
              action.onPress();
            }
          }}
          disabled={action.disabled}
          activeOpacity={theme.ui.PRESSED_OPACITY}
        >
          <View style={styles.actionContent}>
            <Text style={styles.actionIcon}>{action.icon}</Text>
            <Text
              style={[
                styles.actionLabel,
                action.disabled && styles.actionLabelDisabled,
                action.destructive && !action.disabled && styles.actionLabelDestructive,
              ]}
            >
              {action.label}
            </Text>
          </View>
          {action.badge !== undefined && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{action.badge}</Text>
            </View>
          )}
        </TouchableOpacity>
      ))}

      {!canDelete && taskCount > 0 && (
        <View style={styles.infoBox}>
          <Text style={styles.infoText}>
            Clear all tasks before deleting this column
          </Text>
        </View>
      )}
    </BaseModal>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
    paddingBottom: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.border.secondary,
  },
  subtitle: {
    ...theme.typography.textStyles.bodySmall,
    color: theme.text.secondary,
    fontWeight: theme.typography.fontWeights.semibold,
  },
  taskInfo: {
    ...theme.typography.textStyles.bodySmall,
    color: theme.text.tertiary,
  },
  actionOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.border.secondary,
  },
  lastAction: {
    borderBottomWidth: 0,
  },
  actionDisabled: {
    opacity: theme.ui.DISABLED_OPACITY,
    backgroundColor: theme.background.primary,
  },
  actionDestructive: {
    backgroundColor: 'rgba(255, 59, 48, 0.05)',
  },
  actionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  actionIcon: {
    fontSize: 20,
    marginRight: theme.spacing.md,
  },
  actionLabel: {
    ...theme.typography.textStyles.body,
    fontWeight: theme.typography.fontWeights.semibold,
    color: theme.text.primary,
  },
  actionLabelDisabled: {
    color: theme.text.tertiary,
  },
  actionLabelDestructive: {
    color: '#FF3B30',
  },
  badge: {
    backgroundColor: theme.badge.background,
    borderRadius: theme.radius.badge,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    minWidth: 24,
    alignItems: 'center',
  },
  badgeText: {
    color: theme.badge.text,
    ...theme.typography.textStyles.bodySmall,
    fontWeight: theme.typography.fontWeights.semibold,
  },
  infoBox: {
    backgroundColor: theme.background.elevated,
    padding: theme.spacing.md,
    borderRadius: theme.radius.md,
    marginTop: theme.spacing.md,
  },
  infoText: {
    ...theme.typography.textStyles.bodySmall,
    color: theme.text.secondary,
    textAlign: 'center',
  },
});
