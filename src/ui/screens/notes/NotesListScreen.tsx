import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  TextInput,
} from 'react-native';
import { Screen } from '../../components/Screen';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import theme from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { getNoteService, getProjectService, getBoardService, getTaskService } from '../../../core/DependencyContainer';
import { Note, NoteType } from '../../../domain/entities/Note';
import { NotesStackParamList } from '../../navigation/TabNavigator';
import { useAutoRefresh } from '../../hooks/useAutoRefresh';
import AutoRefreshIndicator from '../../components/AutoRefreshIndicator';

type NotesListNavProp = StackNavigationProp<NotesStackParamList, 'NotesList'>;

const NOTE_TYPE_FILTERS: { value: NoteType | 'all'; label: string; icon: string }[] = [
  { value: 'all', label: 'All', icon: '📑' },
  { value: 'general', label: 'Notes', icon: '📝' },
  { value: 'meeting', label: 'Meetings', icon: '👥' },
  { value: 'daily', label: 'Daily', icon: '📅' },
];

const NOTE_TYPE_ICONS: Record<NoteType, string> = {
  general: '📝',
  meeting: '👥',
  daily: '📅',
  task: '✅',
};

export default function NotesListScreen() {
  const navigation = useNavigation<NotesListNavProp>();
  const [notes, setNotes] = useState<Note[]>([]);
  const [filteredNotes, setFilteredNotes] = useState<Note[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<NoteType | 'all'>('all');
  const [entityNames, setEntityNames] = useState<Map<string, string>>(new Map());

  const loadNotes = useCallback(async () => {
    try {
      const noteService = getNoteService();
      const loadedNotes = await noteService.getAllNotes();
      setNotes(loadedNotes);
      await loadEntityNames(loadedNotes);
    } catch (error) {
      console.error('Failed to load notes:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const { isAutoRefreshing } = useAutoRefresh(['notes_invalidated'], loadNotes);

  const loadEntityNames = async (notes: Note[]) => {
    try {
      const projectService = getProjectService();
      const boardService = getBoardService();
      const taskService = getTaskService();
      const names = new Map<string, string>();

      const allEntityIds = new Set<string>();
      notes.forEach(note => {
        note.project_ids.forEach(id => allEntityIds.add(`p_${id}`));
        note.board_ids.forEach(id => allEntityIds.add(`b_${id}`));
        note.task_ids.forEach(id => allEntityIds.add(`t_${id}`));
      });

      for (const entityId of allEntityIds) {
        try {
          const [type, id] = entityId.split('_');
          if (type === 'p') {
            const project = await projectService.getProjectById(id);
            if (project) names.set(entityId, project.name);
          } else if (type === 'b') {
            const board = await boardService.getBoardById(id);
            if (board) names.set(entityId, board.name);
          } else if (type === 't') {
            // const task = await taskService.getTask(id);
            // if (task) names.set(entityId, task.title);
          }
        } catch (e) { }
      }

      setEntityNames(names);
    } catch (error) {
      console.error('Failed to load entity names:', error);
    }
  };

  useEffect(() => {
    loadNotes();
  }, [loadNotes]);

  useEffect(() => {
    let filtered = notes;

    if (selectedType !== 'all') {
      filtered = filtered.filter(n => n.note_type === selectedType);
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(n =>
        n.title.toLowerCase().includes(query) ||
        n.content.toLowerCase().includes(query)
      );
    }

    setFilteredNotes(filtered);
  }, [notes, selectedType, searchQuery]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadNotes();
    setRefreshing(false);
  }, [loadNotes]);

  const handleCreateNote = () => {
    navigation.navigate('NoteEditor', {});
  };

  const handleCreateDailyNote = async () => {
    try {
      const noteService = getNoteService();
      const dailyNote = await noteService.getTodaysDailyNote();
      navigation.navigate('NoteEditor', { noteId: dailyNote.id });
    } catch (error) {
      console.error('Failed to create daily note:', error);
    }
  };

  const handleNotePress = (note: Note) => {
    navigation.navigate('NoteEditor', { noteId: note.id });
  };

  const formatDate = (date: Date): string => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) {
      return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    } else if (days === 1) {
      return 'Yesterday';
    } else if (days < 7) {
      return date.toLocaleDateString('en-US', { weekday: 'short' });
    }
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const renderEntityIndicators = (note: Note) => {
    const entities: { icon: string; name: string }[] = [];

    note.project_ids.slice(0, 1).forEach(id => {
      const name = entityNames.get(`p_${id}`) || id;
      entities.push({ icon: '📁', name });
    });

    note.board_ids.slice(0, 1).forEach(id => {
      const name = entityNames.get(`b_${id}`) || id;
      entities.push({ icon: '📋', name });
    });

    const taskCount = note.task_ids.length;
    if (taskCount > 0) {
      entities.push({ icon: '✓', name: `${taskCount} task${taskCount > 1 ? 's' : ''}` });
    }

    const totalEntities = note.project_ids.length + note.board_ids.length + note.task_ids.length;
    const showing = entities.length;
    const remaining = totalEntities - showing;

    if (entities.length === 0) return null;

    return (
      <View style={styles.entityIndicators}>
        {entities.map((entity, index) => (
          <Text key={index} style={styles.entityIndicatorText}>
            {entity.icon} {entity.name}
            {index < entities.length - 1 && ' • '}
          </Text>
        ))}
        {remaining > 0 && (
          <Text style={styles.entityIndicatorText}> • +{remaining} more</Text>
        )}
      </View>
    );
  };

  const renderNoteCard = ({ item: note }: { item: Note }) => {
    const icon = NOTE_TYPE_ICONS[note.note_type];

    return (
      <TouchableOpacity
        style={styles.noteCard}
        onPress={() => handleNotePress(note)}
        activeOpacity={0.8}
      >
        <View style={styles.noteHeader}>
          <View style={styles.noteHeaderLeft}>
            <Text style={styles.noteIcon}>{icon}</Text>
            <Text style={styles.noteTitle} numberOfLines={1}>{note.title}</Text>
          </View>
          <Text style={styles.noteDate}>{formatDate(note.updated_at)}</Text>
        </View>
        {note.preview && (
          <Text style={styles.notePreview} numberOfLines={3}>{note.preview}</Text>
        )}
        {renderEntityIndicators(note)}
        <View style={styles.noteMeta}>
          {note.tags.length > 0 && (
            <View style={styles.tagRow}>
              {note.tags.slice(0, 3).map(tag => (
                <View key={tag} style={styles.tag}>
                  <Text style={styles.tagText}>#{tag}</Text>
                </View>
              ))}
              {note.tags.length > 3 && (
                <Text style={styles.moreTagsText}>+{note.tags.length - 3}</Text>
              )}
            </View>
          )}
          <Text style={styles.wordCount}>{note.wordCount} words</Text>
        </View>
      </TouchableOpacity>
    );
  };

  const renderFilters = () => (
    <View style={styles.filterContainer}>
      <View style={styles.searchContainer}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={styles.searchInput}
          placeholder="Search notes..."
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
      <View style={styles.typeFilters}>
        {NOTE_TYPE_FILTERS.map(filter => (
          <TouchableOpacity
            key={filter.value}
            style={[
              styles.filterButton,
              selectedType === filter.value && styles.filterButtonActive,
            ]}
            onPress={() => setSelectedType(filter.value)}
          >
            <Text style={styles.filterIcon}>{filter.icon}</Text>
            <Text style={[
              styles.filterLabel,
              selectedType === filter.value && styles.filterLabelActive,
            ]}>
              {filter.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyIcon}>📝</Text>
      <Text style={styles.emptyTitle}>No Notes Yet</Text>
      <Text style={styles.emptyText}>
        Create notes to capture ideas, meeting minutes, and daily reflections.
      </Text>
      <View style={styles.emptyActions}>
        <TouchableOpacity style={styles.createButton} onPress={handleCreateNote}>
          <Text style={styles.createButtonText}>New Note</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.dailyButton} onPress={handleCreateDailyNote}>
          <Text style={styles.dailyButtonText}>Today's Journal</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  if (loading) {
    return (
      <Screen hasTabBar>
        <Text style={styles.loadingText}>Loading notes...</Text>
      </Screen>
    );
  }

  return (
    <Screen hasTabBar>
      <View style={styles.screenHeader}>
        <AutoRefreshIndicator isRefreshing={isAutoRefreshing} />
        <View style={styles.headerLeft} />
      </View>

      {renderFilters()}
      <FlatList
        data={filteredNotes}
        keyExtractor={(item) => item.id}
        renderItem={renderNoteCard}
        ListEmptyComponent={searchQuery || selectedType !== 'all' ? (
          <View style={styles.noResults}>
            <Text style={styles.noResultsText}>No notes found</Text>
          </View>
        ) : renderEmpty()}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.accent.primary}
          />
        }
        contentContainerStyle={filteredNotes.length === 0 ? styles.emptyList : styles.list}
      />

      <TouchableOpacity style={styles.fab} onPress={handleCreateNote}>
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background.primary,
  },
  screenHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  headerLeft: {
    width: 40,
  },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.glass.tint.neutral,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: theme.glass.border,
  },
  addButtonText: {
    color: theme.accent.primary,
    fontSize: 24,
    fontWeight: '300',
  },
  loadingText: {
    color: theme.text.secondary,
    textAlign: 'center',
    marginTop: spacing.xl,
  },
  filterContainer: {
    backgroundColor: theme.background.secondary,
    paddingTop: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.border.primary,
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
    fontSize: 16,
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
  typeFilters: {
    flexDirection: 'row',
    paddingHorizontal: spacing.sm,
    paddingBottom: spacing.md,
    gap: spacing.sm,
  },
  filterButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    borderRadius: 20,
    backgroundColor: theme.glass.tint.neutral,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  filterButtonActive: {
    backgroundColor: theme.accent.primary + '30',
    borderColor: theme.accent.primary,
  },
  filterIcon: {
    fontSize: 14,
    marginRight: spacing.xs,
  },
  filterLabel: {
    color: theme.text.secondary,
    fontSize: 12,
    fontWeight: '500',
  },
  filterLabelActive: {
    color: theme.accent.primary,
    fontWeight: '600',
  },
  list: {
    padding: spacing.md,
    paddingBottom: 100,
  },
  emptyList: {
    flexGrow: 1,
  },
  noteCard: {
    backgroundColor: theme.glass.tint.neutral,
    borderRadius: 16,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: theme.glass.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  noteHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  noteHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  noteIcon: {
    fontSize: 20,
    marginRight: spacing.sm,
  },
  noteTitle: {
    flex: 1,
    color: theme.text.primary,
    fontSize: 17,
    fontWeight: '700',
  },
  noteDate: {
    color: theme.text.muted,
    fontSize: 11,
    marginLeft: spacing.sm,
  },
  notePreview: {
    color: theme.text.secondary,
    fontSize: 14,
    lineHeight: 22,
    marginBottom: spacing.sm,
  },
  entityIndicators: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: spacing.sm,
  },
  entityIndicatorText: {
    color: theme.text.tertiary,
    fontSize: 11,
  },
  noteMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  tagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  tag: {
    backgroundColor: theme.accent.primary + '20',
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: 6,
    marginRight: spacing.xs,
  },
  tagText: {
    color: theme.accent.primary,
    fontSize: 12,
    fontWeight: '500',
  },
  moreTagsText: {
    color: theme.text.muted,
    fontSize: 11,
  },
  wordCount: {
    color: theme.text.muted,
    fontSize: 11,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  emptyIcon: {
    fontSize: 80,
    marginBottom: spacing.lg,
  },
  emptyTitle: {
    color: theme.text.primary,
    fontSize: 20,
    fontWeight: '600',
    marginBottom: spacing.sm,
  },
  emptyText: {
    color: theme.text.secondary,
    fontSize: 14,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  emptyActions: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  createButton: {
    backgroundColor: theme.accent.primary,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: 12,
  },
  createButtonText: {
    color: theme.background.primary,
    fontSize: 15,
    fontWeight: '600',
  },
  dailyButton: {
    backgroundColor: theme.glass.tint.neutral,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.border.primary,
  },
  dailyButtonText: {
    color: theme.text.primary,
    fontSize: 15,
    fontWeight: '500',
  },
  noResults: {
    padding: spacing.xl,
    alignItems: 'center',
  },
  noResultsText: {
    color: theme.text.secondary,
    fontSize: 14,
  },
  fab: {
    position: 'absolute',
    right: spacing.lg + 8,
    bottom: 24 + 80,
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: theme.accent.primary,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  fabText: {
    fontSize: 28,
  },
});
