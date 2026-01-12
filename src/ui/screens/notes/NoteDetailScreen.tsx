import React, { useState, useEffect, useCallback, useLayoutEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  RefreshControl,
} from 'react-native';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import theme from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { getNoteService, getProjectService, getBoardService, getTaskService } from '../../../core/DependencyContainer';
import { Note, NoteType } from '../../../domain/entities/Note';
import { NotesStackParamList } from '../../navigation/TabNavigator';
import EntityChip from '../../components/EntityChip';

type NoteDetailRouteProp = RouteProp<NotesStackParamList, 'NoteDetail'>;
type NoteDetailNavProp = StackNavigationProp<NotesStackParamList, 'NoteDetail'>;

const NOTE_TYPE_LABELS: Record<NoteType, string> = {
  general: 'Note',
  meeting: 'Meeting Note',
  daily: 'Daily Journal',
  task: 'Task Note',
};

const NOTE_TYPE_ICONS: Record<NoteType, string> = {
  general: '📝',
  meeting: '👥',
  daily: '📅',
  task: '✅',
};

export default function NoteDetailScreen() {
  const route = useRoute<NoteDetailRouteProp>();
  const navigation = useNavigation<NoteDetailNavProp>();
  const { noteId } = route.params;

  const [note, setNote] = useState<Note | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [entityNames, setEntityNames] = useState<{
    projects: Map<string, string>;
    boards: Map<string, string>;
    tasks: Map<string, string>;
  }>({
    projects: new Map(),
    boards: new Map(),
    tasks: new Map(),
  });

  const loadNote = useCallback(async () => {
    try {
      const noteService = getNoteService();
      const loadedNote = await noteService.getNoteById(noteId);
      setNote(loadedNote);
      if (loadedNote) {
        await loadEntityNames(loadedNote);
      }
    } catch (error) {
      console.error('Failed to load note:', error);
    } finally {
      setLoading(false);
    }
  }, [noteId]);

  const loadEntityNames = async (note: Note) => {
    try {
      const projectService = getProjectService();
      const boardService = getBoardService();
      const taskService = getTaskService();

      const newEntityNames = {
        projects: new Map<string, string>(),
        boards: new Map<string, string>(),
        tasks: new Map<string, string>(),
      };

      for (const projectId of note.project_ids) {
        try {
          const project = await projectService.getProject(projectId);
          if (project) newEntityNames.projects.set(projectId, project.name);
        } catch (e) {}
      }

      for (const boardId of note.board_ids) {
        try {
          const board = await boardService.getBoard(boardId);
          if (board) newEntityNames.boards.set(boardId, board.name);
        } catch (e) {}
      }

      for (const taskId of note.task_ids) {
        try {
          const task = await taskService.getTask(taskId);
          if (task) newEntityNames.tasks.set(taskId, task.title);
        } catch (e) {}
      }

      setEntityNames(newEntityNames);
    } catch (error) {
      console.error('Failed to load entity names:', error);
    }
  };

  useEffect(() => {
    loadNote();
  }, [loadNote]);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <View style={styles.headerButtons}>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={handleEdit}
          >
            <Text style={styles.editButtonText}>✏️</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={handleDelete}
          >
            <Text style={styles.deleteButtonText}>🗑️</Text>
          </TouchableOpacity>
        </View>
      ),
    });
  }, [navigation, note]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadNote();
    setRefreshing(false);
  }, [loadNote]);

  const handleEdit = () => {
    if (note) {
      navigation.navigate('NoteEditor', { noteId: note.id });
    }
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete Note',
      'Are you sure you want to delete this note? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const noteService = getNoteService();
              await noteService.deleteNote(noteId);
              navigation.goBack();
            } catch (error) {
              console.error('Failed to delete note:', error);
              Alert.alert('Error', 'Failed to delete note');
            }
          },
        },
      ]
    );
  };

  const formatDate = (date: Date): string => {
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const renderMarkdown = (content: string) => {
    const lines = content.split('\n');

    return lines.map((line, index) => {
      if (line.startsWith('# ')) {
        return (
          <Text key={index} style={styles.heading1}>
            {line.slice(2)}
          </Text>
        );
      }
      if (line.startsWith('## ')) {
        return (
          <Text key={index} style={styles.heading2}>
            {line.slice(3)}
          </Text>
        );
      }
      if (line.startsWith('### ')) {
        return (
          <Text key={index} style={styles.heading3}>
            {line.slice(4)}
          </Text>
        );
      }
      if (line.startsWith('- [ ] ')) {
        return (
          <View key={index} style={styles.checkboxRow}>
            <Text style={styles.checkbox}>☐</Text>
            <Text style={styles.checkboxText}>{line.slice(6)}</Text>
          </View>
        );
      }
      if (line.startsWith('- [x] ') || line.startsWith('- [X] ')) {
        return (
          <View key={index} style={styles.checkboxRow}>
            <Text style={styles.checkboxChecked}>☑</Text>
            <Text style={[styles.checkboxText, styles.checkboxTextChecked]}>
              {line.slice(6)}
            </Text>
          </View>
        );
      }
      if (line.startsWith('- ') || line.startsWith('* ')) {
        return (
          <View key={index} style={styles.listItem}>
            <Text style={styles.bullet}>•</Text>
            <Text style={styles.listText}>{line.slice(2)}</Text>
          </View>
        );
      }
      if (/^\d+\. /.test(line)) {
        const match = line.match(/^(\d+)\. (.*)$/);
        if (match) {
          return (
            <View key={index} style={styles.listItem}>
              <Text style={styles.bullet}>{match[1]}.</Text>
              <Text style={styles.listText}>{match[2]}</Text>
            </View>
          );
        }
      }
      if (line.startsWith('> ')) {
        return (
          <View key={index} style={styles.blockquote}>
            <Text style={styles.blockquoteText}>{line.slice(2)}</Text>
          </View>
        );
      }
      if (line.trim() === '') {
        return <View key={index} style={styles.emptyLine} />;
      }
      if (line.startsWith('**') && line.endsWith('**')) {
        return (
          <Text key={index} style={styles.boldLine}>
            {line.slice(2, -2)}
          </Text>
        );
      }

      return (
        <Text key={index} style={styles.paragraph}>
          {line}
        </Text>
      );
    });
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <Text style={styles.loadingText}>Loading note...</Text>
      </View>
    );
  }

  if (!note) {
    return (
      <View style={styles.container}>
        <Text style={styles.loadingText}>Note not found</Text>
      </View>
    );
  }

  const hasEntities = note.project_ids.length > 0 || note.board_ids.length > 0 || note.task_ids.length > 0;

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={theme.accent.primary}
        />
      }
    >
      <View style={styles.header}>
        <View style={styles.typeRow}>
          <View style={styles.typePill}>
            <Text style={styles.typeIcon}>{NOTE_TYPE_ICONS[note.note_type]}</Text>
            <Text style={styles.typeLabel}>{NOTE_TYPE_LABELS[note.note_type]}</Text>
          </View>
        </View>
        <Text style={styles.title}>{note.title}</Text>
        <Text style={styles.date}>Updated {formatDate(note.updated_at)}</Text>

        {note.tags.length > 0 && (
          <View style={styles.tagsRow}>
            {note.tags.map(tag => (
              <View key={tag} style={styles.tag}>
                <Text style={styles.tagText}>#{tag}</Text>
              </View>
            ))}
          </View>
        )}

        {hasEntities && (
          <View style={styles.entitiesSection}>
            <Text style={styles.entitiesSectionLabel}>Connected to</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.entityChipsContainer}>
                {note.project_ids.map(id => (
                  <EntityChip
                    key={id}
                    entityType="project"
                    entityId={id}
                    entityName={entityNames.projects.get(id) || id}
                    showRemove={false}
                  />
                ))}
                {note.board_ids.map(id => (
                  <EntityChip
                    key={id}
                    entityType="board"
                    entityId={id}
                    entityName={entityNames.boards.get(id) || id}
                    showRemove={false}
                  />
                ))}
                {note.task_ids.map(id => (
                  <EntityChip
                    key={id}
                    entityType="task"
                    entityId={id}
                    entityName={entityNames.tasks.get(id) || id}
                    showRemove={false}
                  />
                ))}
              </View>
            </ScrollView>
          </View>
        )}
      </View>

      <View style={styles.content}>
        {renderMarkdown(note.content)}
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>
          {note.wordCount} words • Created {formatDate(note.created_at)}
        </Text>
      </View>

      <View style={styles.bottomPadding} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background.primary,
  },
  loadingText: {
    color: theme.text.secondary,
    textAlign: 'center',
    marginTop: spacing.xl,
  },
  headerButtons: {
    flexDirection: 'row',
    marginRight: spacing.md,
    gap: spacing.sm,
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.glass.tint.neutral,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.glass.border,
  },
  editButtonText: {
    fontSize: 18,
  },
  deleteButtonText: {
    fontSize: 18,
  },
  header: {
    padding: spacing.xl,
  },
  typeRow: {
    marginBottom: spacing.md,
  },
  typePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.glass.tint.blue,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: 12,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: theme.accent.primary + '40',
  },
  typeIcon: {
    fontSize: 16,
    marginRight: spacing.sm,
  },
  typeLabel: {
    color: theme.accent.primary,
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  title: {
    color: theme.text.primary,
    fontSize: 28,
    fontWeight: '700',
    marginBottom: spacing.sm,
    lineHeight: 36,
  },
  date: {
    color: theme.text.muted,
    fontSize: 13,
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: spacing.md,
  },
  tag: {
    backgroundColor: theme.accent.primary + '20',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: 8,
    marginRight: spacing.sm,
    marginBottom: spacing.sm,
  },
  tagText: {
    color: theme.accent.primary,
    fontSize: 13,
    fontWeight: '500',
  },
  entitiesSection: {
    marginTop: spacing.lg,
  },
  entitiesSectionLabel: {
    color: theme.text.secondary,
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.sm,
  },
  entityChipsContainer: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  content: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.lg,
  },
  heading1: {
    color: theme.text.primary,
    fontSize: 26,
    fontWeight: '700',
    marginTop: spacing.lg,
    marginBottom: spacing.md,
    lineHeight: 34,
  },
  heading2: {
    color: theme.text.primary,
    fontSize: 22,
    fontWeight: '600',
    marginTop: spacing.lg,
    marginBottom: spacing.md,
    lineHeight: 30,
  },
  heading3: {
    color: theme.text.primary,
    fontSize: 18,
    fontWeight: '600',
    marginTop: spacing.md,
    marginBottom: spacing.sm,
    lineHeight: 26,
  },
  paragraph: {
    color: theme.text.secondary,
    fontSize: 16,
    lineHeight: 26,
    marginBottom: spacing.sm,
  },
  boldLine: {
    color: theme.text.primary,
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 26,
    marginBottom: spacing.sm,
  },
  listItem: {
    flexDirection: 'row',
    marginBottom: spacing.sm,
    paddingLeft: spacing.md,
  },
  bullet: {
    color: theme.text.secondary,
    fontSize: 16,
    width: 24,
    lineHeight: 26,
  },
  listText: {
    color: theme.text.secondary,
    fontSize: 16,
    flex: 1,
    lineHeight: 26,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
    paddingLeft: spacing.md,
  },
  checkbox: {
    color: theme.text.muted,
    fontSize: 20,
    width: 28,
    lineHeight: 26,
  },
  checkboxChecked: {
    color: theme.accent.success,
    fontSize: 20,
    width: 28,
    lineHeight: 26,
  },
  checkboxText: {
    color: theme.text.secondary,
    fontSize: 16,
    flex: 1,
    lineHeight: 26,
  },
  checkboxTextChecked: {
    textDecorationLine: 'line-through',
    color: theme.text.muted,
  },
  blockquote: {
    borderLeftWidth: 4,
    borderLeftColor: theme.accent.primary,
    backgroundColor: theme.glass.tint.neutral,
    paddingLeft: spacing.md,
    paddingVertical: spacing.sm,
    paddingRight: spacing.md,
    marginVertical: spacing.md,
    borderTopRightRadius: 8,
    borderBottomRightRadius: 8,
  },
  blockquoteText: {
    color: theme.text.secondary,
    fontSize: 16,
    fontStyle: 'italic',
    lineHeight: 26,
  },
  emptyLine: {
    height: spacing.md,
  },
  footer: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: theme.border.primary,
  },
  footerText: {
    color: theme.text.muted,
    fontSize: 13,
    textAlign: 'center',
  },
  bottomPadding: {
    height: spacing.xxl,
  },
});
