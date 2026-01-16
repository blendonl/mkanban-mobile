import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  FlatList,
  TextInput,
  SafeAreaView,
} from 'react-native';
import theme from '../theme/colors';
import { spacing } from '../theme/spacing';
import { EntityType } from '../../domain/entities/Note';
import { ProjectId, BoardId, TaskId } from '../../core/types';
import { getProjectService, getBoardService, getTaskService } from '../../core/DependencyContainer';
import { Project } from '../../domain/entities/Project';
import { Board } from '../../domain/entities/Board';
import { Task } from '../../domain/entities/Task';
import AppIcon, { AppIconName } from './icons/AppIcon';

type Tab = 'projects' | 'boards' | 'tasks';

interface Entity {
  id: string;
  name: string;
  type: EntityType;
}

interface EntityPickerProps {
  visible: boolean;
  onClose: () => void;
  selectedProjects: ProjectId[];
  selectedBoards: BoardId[];
  selectedTasks: TaskId[];
  onSelectionChange: (
    projects: ProjectId[],
    boards: BoardId[],
    tasks: TaskId[]
  ) => void;
}

export default function EntityPicker({
  visible,
  onClose,
  selectedProjects,
  selectedBoards,
  selectedTasks,
  onSelectionChange,
}: EntityPickerProps) {
  const [activeTab, setActiveTab] = useState<Tab>('projects');
  const [searchQuery, setSearchQuery] = useState('');
  const [projects, setProjects] = useState<Project[]>([]);
  const [boards, setBoards] = useState<Board[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [localSelectedProjects, setLocalSelectedProjects] = useState<ProjectId[]>([]);
  const [localSelectedBoards, setLocalSelectedBoards] = useState<BoardId[]>([]);
  const [localSelectedTasks, setLocalSelectedTasks] = useState<TaskId[]>([]);

  useEffect(() => {
    if (visible) {
      loadData();
      setLocalSelectedProjects(selectedProjects);
      setLocalSelectedBoards(selectedBoards);
      setLocalSelectedTasks(selectedTasks);
    }
  }, [visible]);

  const loadData = async () => {
    try {
      const projectService = getProjectService();
      const loadedProjects = await projectService.getAllProjects();
      setProjects(loadedProjects);

      const allBoards: Board[] = [];
      const allTasks: Task[] = [];

      for (const project of loadedProjects) {
        const projectBoards = await projectService.getBoards(project.id);
        allBoards.push(...projectBoards);

        for (const board of projectBoards) {
          const boardTasks = await getBoardService().getAllTasks(board.id);
          allTasks.push(...boardTasks);
        }
      }

      setBoards(allBoards);
      setTasks(allTasks);
    } catch (error) {
      console.error('Failed to load entities:', error);
    }
  };

  const handleDone = () => {
    onSelectionChange(localSelectedProjects, localSelectedBoards, localSelectedTasks);
    onClose();
  };

  const toggleProject = (projectId: ProjectId) => {
    setLocalSelectedProjects(prev =>
      prev.includes(projectId)
        ? prev.filter(id => id !== projectId)
        : [...prev, projectId]
    );
  };

  const toggleBoard = (boardId: BoardId) => {
    setLocalSelectedBoards(prev =>
      prev.includes(boardId)
        ? prev.filter(id => id !== boardId)
        : [...prev, boardId]
    );
  };

  const toggleTask = (taskId: TaskId) => {
    setLocalSelectedTasks(prev =>
      prev.includes(taskId)
        ? prev.filter(id => id !== taskId)
        : [...prev, taskId]
    );
  };

  const getFilteredEntities = (): Entity[] => {
    const query = searchQuery.toLowerCase();
    let entities: Entity[] = [];

    switch (activeTab) {
      case 'projects':
        entities = projects.map(p => ({
          id: p.id,
          name: p.name,
          type: 'project' as EntityType,
        }));
        break;
      case 'boards':
        entities = boards.map(b => ({
          id: b.id,
          name: b.name,
          type: 'board' as EntityType,
        }));
        break;
      case 'tasks':
        entities = tasks.map(t => ({
          id: t.id,
          name: t.title,
          type: 'task' as EntityType,
        }));
        break;
    }

    if (query) {
      entities = entities.filter(e => e.name.toLowerCase().includes(query));
    }

    return entities;
  };

  const isSelected = (entity: Entity): boolean => {
    switch (entity.type) {
      case 'project':
        return localSelectedProjects.includes(entity.id);
      case 'board':
        return localSelectedBoards.includes(entity.id);
      case 'task':
        return localSelectedTasks.includes(entity.id);
      default:
        return false;
    }
  };

  const toggleEntity = (entity: Entity) => {
    switch (entity.type) {
      case 'project':
        toggleProject(entity.id);
        break;
      case 'board':
        toggleBoard(entity.id);
        break;
      case 'task':
        toggleTask(entity.id);
        break;
    }
  };

  const renderEntityItem = ({ item }: { item: Entity }) => {
    const selected = isSelected(item);
    const icon: AppIconName = item.type === 'project' ? 'folder' : item.type === 'board' ? 'board' : 'check';

    return (
      <TouchableOpacity
        style={[styles.entityItem, selected && styles.entityItemSelected]}
        onPress={() => toggleEntity(item)}
      >
        <View style={styles.entityItemLeft}>
          <View style={styles.entityIcon}>
            <AppIcon name={icon} size={18} color={theme.text.secondary} />
          </View>
          <Text style={styles.entityName} numberOfLines={1}>{item.name}</Text>
        </View>
        <View style={[styles.checkbox, selected && styles.checkboxSelected]}>
          {selected && (
            <AppIcon name="check" size={14} color={theme.background.primary} />
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const entities = getFilteredEntities();

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <SafeAreaView style={styles.container}>
        <View style={styles.modal}>
          <View style={styles.header}>
            <Text style={styles.title}>Connect to...</Text>
            <TouchableOpacity onPress={onClose}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.tabs}>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'projects' && styles.tabActive]}
              onPress={() => setActiveTab('projects')}
            >
              <Text style={[styles.tabText, activeTab === 'projects' && styles.tabTextActive]}>
                Projects
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'boards' && styles.tabActive]}
              onPress={() => setActiveTab('boards')}
            >
              <Text style={[styles.tabText, activeTab === 'boards' && styles.tabTextActive]}>
                Boards
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'tasks' && styles.tabActive]}
              onPress={() => setActiveTab('tasks')}
            >
              <Text style={[styles.tabText, activeTab === 'tasks' && styles.tabTextActive]}>
                Tasks
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.searchContainer}>
            <View style={styles.searchIcon}>
              <AppIcon name="search" size={16} color={theme.text.muted} />
            </View>
            <TextInput
              style={styles.searchInput}
              placeholder="Search..."
              placeholderTextColor={theme.text.muted}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Text style={styles.clearButton}>×</Text>
              </TouchableOpacity>
            )}
          </View>

          <FlatList
            data={entities}
            renderItem={renderEntityItem}
            keyExtractor={item => item.id}
            contentContainerStyle={styles.list}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Text style={styles.emptyText}>No {activeTab} found</Text>
              </View>
            }
          />

          <View style={styles.footer}>
            <TouchableOpacity style={styles.doneButton} onPress={handleDone}>
              <Text style={styles.doneButtonText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.modal.overlay,
  },
  modal: {
    flex: 1,
    backgroundColor: theme.glass.background,
    marginTop: 100,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: theme.glass.border,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.text.primary,
  },
  cancelText: {
    fontSize: 16,
    color: theme.accent.primary,
  },
  tabs: {
    flexDirection: 'row',
    padding: spacing.md,
    gap: spacing.sm,
  },
  tab: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: 20,
    backgroundColor: theme.card.background,
    alignItems: 'center',
  },
  tabActive: {
    backgroundColor: theme.accent.primary + '30',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500',
    color: theme.text.secondary,
  },
  tabTextActive: {
    color: theme.accent.primary,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
    backgroundColor: theme.input.background,
    borderRadius: 12,
    paddingHorizontal: spacing.md,
    height: 44,
  },
  searchIcon: {
    marginRight: spacing.sm,
  },
  searchInput: {
    flex: 1,
    color: theme.text.primary,
    fontSize: 15,
  },
  clearButton: {
    fontSize: 24,
    color: theme.text.muted,
    fontWeight: '300',
  },
  list: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xl,
  },
  entityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
    backgroundColor: theme.card.background,
    borderRadius: 12,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  entityItemSelected: {
    borderColor: theme.accent.primary,
    backgroundColor: theme.accent.primary + '10',
  },
  entityItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  entityIcon: {
    marginRight: spacing.sm,
  },
  entityName: {
    fontSize: 15,
    color: theme.text.primary,
    flex: 1,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: theme.border.secondary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxSelected: {
    backgroundColor: theme.accent.primary,
    borderColor: theme.accent.primary,
  },
  emptyState: {
    padding: spacing.xl,
    alignItems: 'center',
  },
  emptyText: {
    color: theme.text.secondary,
    fontSize: 14,
  },
  footer: {
    padding: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: theme.glass.border,
  },
  doneButton: {
    backgroundColor: theme.accent.primary,
    paddingVertical: spacing.md,
    borderRadius: 12,
    alignItems: 'center',
  },
  doneButtonText: {
    color: theme.background.primary,
    fontSize: 16,
    fontWeight: '600',
  },
});
