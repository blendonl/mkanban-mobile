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
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import theme from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { getNoteService } from '../../../core/DependencyContainer';
import { Note, NoteType } from '../../../domain/entities/Note';
import { NotesStackParamList } from '../../navigation/TabNavigator';

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

  const loadNotes = useCallback(async () => {
    try {
      const noteService = getNoteService();
      const loadedNotes = await noteService.getAllNotes();
      setNotes(loadedNotes);
    } catch (error) {
      console.error('Failed to load notes:', error);
    } finally {
      setLoading(false);
    }
  }, []);

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
    navigation.navigate('NoteDetail', { noteId: note.id });
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

  const renderNoteCard = ({ item: note }: { item: Note }) => {
    const icon = NOTE_TYPE_ICONS[note.note_type];

    return (
      <TouchableOpacity
        style={styles.noteCard}
        onPress={() => handleNotePress(note)}
      >
        <View style={styles.noteHeader}>
          <Text style={styles.noteIcon}>{icon}</Text>
          <Text style={styles.noteTitle} numberOfLines={1}>{note.title}</Text>
          <Text style={styles.noteDate}>{formatDate(note.updated_at)}</Text>
        </View>
        {note.preview && (
          <Text style={styles.notePreview} numberOfLines={2}>{note.preview}</Text>
        )}
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
        <TextInput
          style={styles.searchInput}
          placeholder="Search notes..."
          placeholderTextColor={theme.text.muted}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
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
      <SafeAreaView style={styles.container} edges={['top']}>
        <Text style={styles.loadingText}>Loading notes...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.screenHeader}>
        <View style={styles.headerLeft} />
        <TouchableOpacity
          style={styles.addButton}
          onPress={handleCreateNote}
        >
          <Text style={styles.addButtonText}>+</Text>
        </TouchableOpacity>
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

      {notes.length > 0 && (
        <TouchableOpacity style={styles.fab} onPress={handleCreateDailyNote}>
          <Text style={styles.fabText}>📅</Text>
        </TouchableOpacity>
      )}
    </SafeAreaView>
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
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
  searchInput: {
    backgroundColor: theme.input.background,
    borderRadius: 8,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: theme.text.primary,
    fontSize: 15,
  },
  typeFilters: {
    flexDirection: 'row',
    paddingHorizontal: spacing.sm,
    paddingBottom: spacing.sm,
  },
  filterButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    marginHorizontal: spacing.xs,
    borderRadius: 8,
    backgroundColor: theme.card.background,
  },
  filterButtonActive: {
    backgroundColor: theme.accent.primary + '30',
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
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: theme.glass.border,
  },
  noteHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  noteIcon: {
    fontSize: 16,
    marginRight: spacing.sm,
  },
  noteTitle: {
    flex: 1,
    color: theme.text.primary,
    fontSize: 16,
    fontWeight: '600',
  },
  noteDate: {
    color: theme.text.muted,
    fontSize: 12,
  },
  notePreview: {
    color: theme.text.secondary,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: spacing.sm,
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
    paddingVertical: 2,
    borderRadius: 4,
    marginRight: spacing.xs,
  },
  tagText: {
    color: theme.accent.primary,
    fontSize: 11,
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
    fontSize: 64,
    marginBottom: spacing.md,
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
    marginBottom: spacing.lg,
  },
  emptyActions: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  createButton: {
    backgroundColor: theme.accent.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: 8,
  },
  createButtonText: {
    color: theme.background.primary,
    fontSize: 15,
    fontWeight: '600',
  },
  dailyButton: {
    backgroundColor: theme.card.background,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: 8,
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
    right: spacing.lg,
    bottom: 100,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: theme.accent.primary,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  fabText: {
    fontSize: 24,
  },
});
