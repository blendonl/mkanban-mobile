import React, { useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ListRenderItem } from 'react-native';
import { Column } from '../../domain/entities/Column';
import { Task } from '../../domain/entities/Task';
import { Parent } from '../../domain/entities/Parent';
import TaskCard from './ItemCard';
import ParentGroup from './ParentGroup';
import theme from '../theme';
import AppIcon from './icons/AppIcon';

// Type for grouped tasks with parent
interface GroupedTasksData {
  type: 'group';
  parentId: string | null;
  parent: Parent | null;
  tasks: Task[];
}

// Type for individual task
interface FlatTaskData {
  type: 'task';
  task: Task;
  parent?: Parent;
}

interface ColumnCardProps {
  column: Column;
  parents: Parent[];
  showParentGroups?: boolean;
  onTaskPress: (task: Task) => void;
  onTaskLongPress?: (task: Task) => void;
  onAddTask: () => void;
  onColumnMenu?: (column: Column) => void;
}

const ColumnCard = React.memo<ColumnCardProps>(({
  column,
  parents,
  showParentGroups = false,
  onTaskPress,
  onTaskLongPress,
  onAddTask,
  onColumnMenu,
}) => {
  // Create a map of parent IDs to Parent objects for quick lookup
  const parentMap = useMemo(() => {
    const map = new Map<string, Parent>();
    parents.forEach((parent) => {
      map.set(parent.id, parent);
    });
    return map;
  }, [parents]);

  // Prepare data for FlatList based on view mode
  const listData = useMemo((): (GroupedTasksData | FlatTaskData)[] => {
    if (showParentGroups) {
      // Group tasks by parent
      const groups = new Map<string | null, Task[]>();

      column.tasks.forEach((task) => {
        const parentId = task.parent_id || null;
        if (!groups.has(parentId)) {
          groups.set(parentId, []);
        }
        groups.get(parentId)!.push(task);
      });

      // Convert groups to array for FlatList
      return Array.from(groups.entries()).map(([parentId, tasks]) => ({
        type: 'group' as const,
        parentId,
        parent: parentId ? parentMap.get(parentId) || null : null,
        tasks,
      }));
    } else {
      // Flat view: convert tasks to FlatTaskData
      return column.tasks.map((task) => ({
        type: 'task' as const,
        task,
        parent: task.parent_id ? parentMap.get(task.parent_id) : undefined,
      }));
    }
  }, [column.tasks, showParentGroups, parentMap]);

  // Render function for FlatList tasks
  const renderItem: ListRenderItem<GroupedTasksData | FlatTaskData> = useCallback(
    ({ item: data }) => {
      if (data.type === 'group') {
        return (
          <ParentGroup
            parent={data.parent}
            tasks={data.tasks}
            onTaskPress={onTaskPress}
            onTaskLongPress={onTaskLongPress}
          />
        );
      } else {
        return (
          <TaskCard
            task={data.task}
            parent={data.parent}
            onPress={() => onTaskPress(data.task)}
            onLongPress={onTaskLongPress ? () => onTaskLongPress(data.task) : undefined}
          />
        );
      }
    },
    [onTaskPress, onTaskLongPress]
  );

  // Key extractor for FlatList
  const keyExtractor = useCallback(
    (item: GroupedTasksData | FlatTaskData, index: number) => {
      if (item.type === 'group') {
        return `group-${item.parentId || 'no-parent'}`;
      } else {
        return `task-${item.task.id}`;
      }
    },
    []
  );

  // Empty component
  const renderEmpty = useCallback(
    () => (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>No tasks yet</Text>
      </View>
    ),
    []
  );

  // Footer component with Add Task button
  const renderFooter = useCallback(
    () => (
      <TouchableOpacity style={styles.addButton} onPress={onAddTask}>
        <Text style={styles.addButtonText}>+ Add Task</Text>
      </TouchableOpacity>
    ),
    [onAddTask]
  );

  return (
    <View style={styles.container}>
      {/* Column Header */}
      <View style={styles.header}>
        <Text style={styles.title}>{column.name}</Text>
        <View style={styles.headerRight}>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{column.tasks.length}</Text>
          </View>
          {onColumnMenu && (
            <TouchableOpacity
              style={styles.menuButton}
              onPress={() => onColumnMenu(column)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <AppIcon name="more" size={18} color={theme.text.secondary} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Tasks List with Virtualization */}
      <FlatList
        data={listData}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        ListEmptyComponent={renderEmpty}
        ListFooterComponent={renderFooter}
        style={styles.itemsContainer}
        contentContainerStyle={styles.itemsContent}
        showsVerticalScrollIndicator={false}
        removeClippedSubviews={true}
        maxToRenderPerBatch={10}
        windowSize={5}
        initialNumToRender={10}
      />
    </View>
  );
});

ColumnCard.displayName = 'ColumnCard';

export default ColumnCard;

const styles = StyleSheet.create({
  container: {
    width: theme.ui.DEFAULT_COLUMN_WIDTH,
    backgroundColor: theme.background.secondary,
    borderRadius: theme.radius.card,
    marginHorizontal: theme.spacing.sm,
    padding: theme.spacing.md,
    maxHeight: '100%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
    paddingBottom: theme.spacing.sm,
    borderBottomWidth: 2,
    borderBottomColor: theme.border.primary,
  },
  title: {
    ...theme.typography.textStyles.body,
    fontWeight: theme.typography.fontWeights.bold,
    color: theme.text.primary,
    flex: 1,
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
  itemsContainer: {
    flex: 1,
  },
  itemsContent: {
    paddingBottom: theme.spacing.sm,
  },
  emptyContainer: {
    padding: theme.spacing.lg,
    alignItems: 'center',
  },
  emptyText: {
    ...theme.typography.textStyles.body,
    color: theme.text.muted,
    fontStyle: 'italic',
  },
  addButton: {
    backgroundColor: theme.card.background,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    alignItems: 'center',
    marginTop: theme.spacing.xs,
    marginBottom: theme.spacing.xs,
    borderWidth: 1,
    borderColor: theme.border.primary,
    borderStyle: 'dashed',
  },
  addButtonText: {
    color: theme.accent.primary,
    ...theme.typography.textStyles.body,
    fontWeight: theme.typography.fontWeights.semibold,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  menuButton: {
    padding: theme.spacing.xs,
  },
});
