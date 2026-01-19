import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RouteProp } from '@react-navigation/native';
import { BoardStackParamList } from '../navigation/TabNavigator';
import { Board } from '../../domain/entities/Board';
import { Task, TaskPriority } from '../../domain/entities/Task';
import { IssueType } from '../../core/enums';
import { getTaskService, getBoardService } from '../../core/DependencyContainer';
import ParentBadge from '../components/ParentBadge';
import theme from '../theme/colors';
import { spacing } from '../theme/spacing';
import { uiConstants } from '../theme/uiConstants';
import { getIssueTypeIcon, getAllIssueTypes } from '../../utils/issueTypeUtils';
import alertService from '../../services/AlertService';
import { Screen } from '../components/Screen';
import AppIcon from '../components/icons/AppIcon';
import AutoSaveIndicator, { SaveStatus } from '../components/AutoSaveIndicator';
import { useDebounce } from '../hooks/useDebounce';

type ItemDetailScreenNavigationProp = StackNavigationProp<BoardStackParamList, 'ItemDetail'>;
type ItemDetailScreenRouteProp = RouteProp<BoardStackParamList, 'ItemDetail'>;

interface Props {
  navigation: ItemDetailScreenNavigationProp;
  route: ItemDetailScreenRouteProp;
}

const PRIORITY_OPTIONS: { value: TaskPriority; label: string; color: string }[] = [
  { value: 'high', label: 'High', color: theme.status.error },
  { value: 'medium', label: 'Medium', color: theme.status.warning },
  { value: 'low', label: 'Low', color: theme.status.info },
  { value: 'none', label: 'None', color: theme.text.muted },
];

export default function ItemDetailScreen({ navigation, route }: Props) {
  const { boardId, itemId, columnId } = route.params;
  const [createdTaskId, setCreatedTaskId] = useState<string | null>(null);
  const currentTaskId = itemId ?? createdTaskId;
  const isCreateMode = !currentTaskId;

  const [board, setBoard] = useState<Board | null>(null);
  const [task, setTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [selectedParentId, setSelectedParentId] = useState<string | null>(null);
  const [selectedIssueType, setSelectedIssueType] = useState<string>(IssueType.TASK);
  const [priority, setPriority] = useState<TaskPriority>('none');
  const [showParentPicker, setShowParentPicker] = useState(false);
  const [activeMetaPicker, setActiveMetaPicker] = useState<'priority' | 'issueType' | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');

  const taskService = getTaskService();
  const boardService = getBoardService();
  const isInitialMount = useRef(true);

  const debouncedTitle = useDebounce(title, uiConstants.AUTO_SAVE_DEBOUNCE_TIME);
  const debouncedDescription = useDebounce(description, uiConstants.AUTO_SAVE_DEBOUNCE_TIME);

  useEffect(() => {
    const loadData = async () => {
      try {
        const loadedBoard = await boardService.getBoardById(boardId);
        if (!loadedBoard) {
          alertService.showError('Board not found');
          navigation.goBack();
          return;
        }

        setBoard(loadedBoard);

        if (!isCreateMode && itemId) {
          let foundTask: Task | null = null;
          for (const column of loadedBoard.columns) {
            foundTask = column.tasks.find((t) => t.id === itemId) || null;
            if (foundTask) break;
          }

          if (!foundTask) {
            alertService.showError('Task not found');
            navigation.goBack();
            return;
          }

          setTask(foundTask);
          setTitle(foundTask.title);
          setDescription(foundTask.description || '');
          setSelectedParentId(foundTask.parent_id || null);
          setSelectedIssueType(foundTask.getIssueType());
          setPriority(foundTask.priority || 'none');
        }
      } catch (error) {
        alertService.showError('Failed to load data');
        navigation.goBack();
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [boardId, itemId, isCreateMode, boardService, navigation]);

  const targetColumn = board
    ? columnId
      ? board.columns.find((col) => col.id === columnId)
      : task
        ? board.columns.find((col) => col.tasks.some((t) => t.id === task.id))
        : null
    : null;

  const saveTask = useCallback(async () => {
    if (!board) return;
    if (!debouncedTitle.trim()) return;
    if (!targetColumn) return;

    setSaveStatus('saving');

    try {
      if (!task) {
        const newTask = await taskService.createTask(
          board,
          targetColumn.id,
          debouncedTitle.trim(),
          debouncedDescription.trim() || undefined,
          selectedParentId || undefined
        );

        newTask.setIssueType(selectedIssueType);
        newTask.priority = priority;

        setTask(newTask);
        setCreatedTaskId(newTask.id);

        await boardService.saveBoard(board);
      } else {
        await taskService.updateTask(board, task.id, {
          title: debouncedTitle.trim(),
          description: debouncedDescription.trim() || undefined,
          parent_id: selectedParentId || undefined,
          priority,
        });

        task.setIssueType(selectedIssueType);
        task.priority = priority;

        await boardService.saveBoard(board);
      }

      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch (error) {
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 3000);
    }
  }, [
    board,
    debouncedTitle,
    debouncedDescription,
    priority,
    selectedParentId,
    selectedIssueType,
    targetColumn,
    task,
    taskService,
    boardService,
  ]);

  useEffect(() => {
    if (loading) return;
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }

    saveTask();
  }, [
    debouncedTitle,
    debouncedDescription,
    priority,
    selectedParentId,
    selectedIssueType,
    loading,
    saveTask,
  ]);

  const handleDelete = async () => {
    if (isCreateMode || !task || !board) {
      return;
    }

    alertService.showDestructiveConfirm(
      'Are you sure you want to delete this task? This action cannot be undone.',
      async () => {
        try {
          await taskService.deleteTask(board, task.id);
          await boardService.saveBoard(board);

          alertService.showSuccess('Task deleted successfully');
          navigation.goBack();
        } catch (error) {
          alertService.showError('Failed to delete task');
        }
      },
      undefined,
      'Delete Task'
    );
  };

  const insertTemplate = (template: string) => {
    setDescription((prev) => prev + template);
  };

  const selectedParent = selectedParentId && board
    ? board.parents.find((p) => p.id === selectedParentId)
    : null;

  if (loading || !board) {
    return (
      <Screen style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </Screen>
    );
  }

  const issueTypes = getAllIssueTypes();
  const selectedPriority = PRIORITY_OPTIONS.find((option) => option.value === priority) || PRIORITY_OPTIONS[3];

  const handleOpenMenu = () => {
    if (isCreateMode) {
      return;
    }

    Alert.alert('Task Options', '', [
      {
        text: 'Delete Task',
        style: 'destructive',
        onPress: handleDelete,
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  if (showParentPicker) {
    return (
      <Screen style={styles.container} scrollable hasTabBar={false}>
        <View style={styles.pickerHeader}>
          <Text style={styles.pickerTitle}>Select Parent</Text>
          <TouchableOpacity onPress={() => setShowParentPicker(false)}>
            <Text style={styles.pickerClose}>Done</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={styles.parentOption}
          onPress={() => {
            setSelectedParentId(null);
            setShowParentPicker(false);
          }}
        >
          <Text style={styles.parentOptionText}>None</Text>
          {selectedParentId === null && (
            <View style={styles.checkmark}>
              <AppIcon name="check" size={18} color={theme.accent.primary} />
            </View>
          )}
        </TouchableOpacity>

        {board.parents.map((parent) => (
          <TouchableOpacity
            key={parent.id}
            style={styles.parentOption}
            onPress={() => {
              setSelectedParentId(parent.id);
              setShowParentPicker(false);
            }}
          >
            <ParentBadge name={parent.name} color={parent.color} size="medium" />
            {selectedParentId === parent.id && (
              <View style={styles.checkmark}>
                <AppIcon name="check" size={18} color={theme.accent.primary} />
              </View>
            )}
          </TouchableOpacity>
        ))}
      </Screen>
    );
  }

  return (
    <Screen style={styles.container} scrollable={false}>
      <KeyboardAvoidingView
        style={styles.keyboardContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={88}
      >
        <AutoSaveIndicator status={saveStatus} />
        <ScrollView style={styles.scrollView} keyboardShouldPersistTaps="handled">
          {!isCreateMode && (
            <View style={styles.topRow}>
              <View style={styles.topRowSpacer} />
              <TouchableOpacity style={styles.menuButton} onPress={handleOpenMenu}>
                <AppIcon name="more" size={20} color={theme.text.secondary} />
              </TouchableOpacity>
            </View>
          )}
          <View style={styles.metaBar}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.metaBarContent}
            >
              <TouchableOpacity
                style={[styles.metaChip, activeMetaPicker === 'priority' && styles.metaChipActive]}
                onPress={() => setActiveMetaPicker(activeMetaPicker === 'priority' ? null : 'priority')}
                activeOpacity={0.85}
              >
                <View style={[styles.priorityDot, { backgroundColor: selectedPriority.color }]} />
                <Text style={styles.metaChipText}>Priority: {selectedPriority.label}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.metaChip, activeMetaPicker === 'issueType' && styles.metaChipActive]}
                onPress={() => setActiveMetaPicker(activeMetaPicker === 'issueType' ? null : 'issueType')}
                activeOpacity={0.85}
              >
                <AppIcon
                  name={getIssueTypeIcon(selectedIssueType)}
                  size={16}
                  color={theme.text.secondary}
                />
                <Text style={styles.metaChipText}>{selectedIssueType}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.metaChip}
                onPress={() => setShowParentPicker(true)}
                activeOpacity={0.85}
              >
                {selectedParent ? (
                  <ParentBadge name={selectedParent.name} color={selectedParent.color} size="small" />
                ) : (
                  <Text style={styles.metaChipText}>Parent: None</Text>
                )}
              </TouchableOpacity>
              {targetColumn && (
                <View style={styles.metaChipStatic}>
                  <AppIcon name="stack" size={16} color={theme.text.secondary} />
                  <Text style={styles.metaChipText}>{targetColumn.name}</Text>
                </View>
              )}
              {!isCreateMode && task && (
                <TouchableOpacity
                  style={styles.metaChip}
                  onPress={() => {
                    const rootNav = navigation.getParent();
                    if (rootNav) {
                      rootNav.navigate('AgendaTab', {
                        screen: 'TaskSchedule',
                        params: { taskId: task.id, boardId, taskData: task.toDict() },
                      });
                    }
                  }}
                  activeOpacity={0.85}
                >
                  <AppIcon name="calendar" size={16} color={theme.text.secondary} />
                  <Text style={styles.metaChipText}>
                    {task.isScheduled
                      ? `${task.scheduled_date}${task.scheduled_time ? ` ${formatScheduleTime(task.scheduled_time)}` : ''}`
                      : 'Schedule'}
                  </Text>
                </TouchableOpacity>
              )}
            </ScrollView>
          </View>

          {activeMetaPicker === 'priority' && (
            <View style={styles.metaPicker}>
              <View style={styles.optionRow}>
                {PRIORITY_OPTIONS.map((option) => {
                  const isActive = priority === option.value;
                  return (
                    <TouchableOpacity
                      key={option.value}
                      style={[
                        styles.optionButton,
                        isActive && {
                          borderColor: option.color,
                          backgroundColor: option.color + '20',
                        },
                      ]}
                      onPress={() => {
                        setPriority(option.value);
                        setActiveMetaPicker(null);
                      }}
                      activeOpacity={0.85}
                    >
                      <View
                        style={[
                          styles.priorityDot,
                          { backgroundColor: isActive ? option.color : theme.text.muted },
                        ]}
                      />
                      <Text style={[styles.optionLabel, { color: isActive ? option.color : theme.text.secondary }]}>
                        {option.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}

          {activeMetaPicker === 'issueType' && (
            <View style={styles.metaPicker}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.optionRow}>
                {issueTypes.map((issueType) => {
                  const isActive = selectedIssueType === issueType;
                  return (
                    <TouchableOpacity
                      key={issueType}
                      style={[styles.optionButton, isActive && styles.optionButtonActive]}
                      onPress={() => {
                        setSelectedIssueType(issueType);
                        setActiveMetaPicker(null);
                      }}
                      activeOpacity={0.85}
                    >
                      <AppIcon
                        name={getIssueTypeIcon(issueType)}
                        size={16}
                        color={isActive ? theme.accent.primary : theme.text.secondary}
                      />
                      <Text style={[styles.optionLabel, isActive && styles.optionLabelActive]}>
                        {issueType}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          )}

          <View style={styles.titleContainer}>
            <TextInput
              style={styles.titleInput}
              placeholder="Untitled task"
              placeholderTextColor={theme.text.muted}
              value={title}
              onChangeText={setTitle}
              autoFocus={isCreateMode}
            />
          </View>

          <View style={styles.editorBlock}>
            <View style={styles.toolbar}>
              <TouchableOpacity style={styles.toolButton} onPress={() => insertTemplate('\n## ')}>
                <Text style={styles.toolButtonText}>H</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.toolButton} onPress={() => insertTemplate('\n- ')}>
                <Text style={styles.toolButtonText}>-</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.toolButton} onPress={() => insertTemplate('\n- [ ] ')}>
                <Text style={styles.toolButtonText}>[]</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.toolButton} onPress={() => insertTemplate('\n> ')}>
                <Text style={styles.toolButtonText}>"</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.editorContainer}>
              <TextInput
                style={styles.contentInput}
                placeholder="Start writing your task details..."
                placeholderTextColor={theme.text.muted}
                value={description}
                onChangeText={setDescription}
                multiline
                textAlignVertical="top"
                scrollEnabled={false}
              />
            </View>
          </View>

          <View style={styles.bottomPadding} />
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

function formatScheduleTime(time: string): string {
  const [hours, minutes] = time.split(':');
  const hour = parseInt(hours, 10);
  const period = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
  return `${displayHour}:${minutes} ${period}`;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background.primary,
  },
  keyboardContainer: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: theme.text.secondary,
  },
  titleContainer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
  },
  titleInput: {
    color: theme.text.primary,
    fontSize: 28,
    fontWeight: '700',
  },
  metaBar: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  topRowSpacer: {
    flex: 1,
  },
  menuButton: {
    padding: spacing.xs,
  },
  metaBarContent: {
    gap: spacing.sm,
  },
  metaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: theme.glass.tint.neutral,
    borderRadius: 16,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderColor: theme.glass.border,
  },
  metaChipActive: {
    borderColor: theme.accent.primary,
    backgroundColor: theme.accent.primary + '20',
  },
  metaChipStatic: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: theme.glass.tint.neutral,
    borderRadius: 16,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderColor: theme.glass.border,
  },
  metaChipText: {
    color: theme.text.secondary,
    fontSize: 13,
    fontWeight: '600',
  },
  metaPicker: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  optionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  optionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.glass.tint.neutral,
    borderRadius: 12,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderColor: theme.glass.border,
  },
  optionButtonActive: {
    borderColor: theme.accent.primary,
    backgroundColor: theme.accent.primary + '20',
  },
  optionLabel: {
    color: theme.text.secondary,
    fontSize: 14,
    fontWeight: '600',
    marginLeft: spacing.xs,
  },
  optionLabelActive: {
    color: theme.accent.primary,
  },
  priorityDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  editorBlock: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  toolbar: {
    flexDirection: 'row',
    paddingBottom: spacing.md,
    gap: spacing.sm,
  },
  toolButton: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: theme.glass.tint.neutral,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.glass.border,
  },
  toolButtonText: {
    color: theme.text.primary,
    fontSize: 18,
    fontWeight: '600',
  },
  editorContainer: {
    minHeight: 200,
  },
  contentInput: {
    color: theme.text.primary,
    fontSize: 17,
    lineHeight: 26,
    minHeight: 200,
  },
  bottomPadding: {
    height: spacing.xxxl,
  },
  pickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: theme.border.primary,
  },
  pickerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.text.primary,
  },
  pickerClose: {
    fontSize: 16,
    color: theme.accent.primary,
    fontWeight: '600',
  },
  parentOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: theme.border.primary,
  },
  parentOptionText: {
    fontSize: 16,
    color: theme.text.secondary,
  },
  checkmark: {
    marginLeft: spacing.sm,
  },
});
