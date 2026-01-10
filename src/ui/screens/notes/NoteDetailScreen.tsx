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
import { getNoteService } from '../../../core/DependencyContainer';
import { Note, NoteType } from '../../../domain/entities/Note';
import { NotesStackParamList } from '../../navigation/TabNavigator';

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

  const loadNote = useCallback(async () => {
    try {
      const noteService = getNoteService();
      const loadedNote = await noteService.getNoteById(noteId);
      setNote(loadedNote);
    } catch (error) {
      console.error('Failed to load note:', error);
    } finally {
      setLoading(false);
    }
  }, [noteId]);

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
            <Text style={styles.headerButtonText}>Edit</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={handleDelete}
          >
            <Text style={[styles.headerButtonText, styles.deleteText]}>Delete</Text>
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
          {renderInlineFormatting(line)}
        </Text>
      );
    });
  };

  const renderInlineFormatting = (text: string) => {
    return text
      .replace(/\*\*(.+?)\*\*/g, '**$1**')
      .replace(/__(.+?)__/g, '__$1__');
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
          <Text style={styles.typeIcon}>{NOTE_TYPE_ICONS[note.note_type]}</Text>
          <Text style={styles.typeLabel}>{NOTE_TYPE_LABELS[note.note_type]}</Text>
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
  },
  headerButton: {
    marginLeft: spacing.md,
  },
  headerButtonText: {
    color: theme.accent.primary,
    fontSize: 16,
    fontWeight: '500',
  },
  deleteText: {
    color: theme.accent.error,
  },
  header: {
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: theme.border.primary,
  },
  typeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  typeIcon: {
    fontSize: 16,
    marginRight: spacing.sm,
  },
  typeLabel: {
    color: theme.text.secondary,
    fontSize: 13,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  title: {
    color: theme.text.primary,
    fontSize: 24,
    fontWeight: '700',
    marginBottom: spacing.xs,
  },
  date: {
    color: theme.text.muted,
    fontSize: 13,
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: spacing.sm,
  },
  tag: {
    backgroundColor: theme.accent.primary + '20',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: 4,
    marginRight: spacing.xs,
    marginBottom: spacing.xs,
  },
  tagText: {
    color: theme.accent.primary,
    fontSize: 12,
    fontWeight: '500',
  },
  content: {
    padding: spacing.lg,
  },
  heading1: {
    color: theme.text.primary,
    fontSize: 22,
    fontWeight: '700',
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  heading2: {
    color: theme.text.primary,
    fontSize: 18,
    fontWeight: '600',
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  heading3: {
    color: theme.text.primary,
    fontSize: 16,
    fontWeight: '600',
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },
  paragraph: {
    color: theme.text.secondary,
    fontSize: 15,
    lineHeight: 24,
    marginBottom: spacing.xs,
  },
  boldLine: {
    color: theme.text.primary,
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 24,
    marginBottom: spacing.xs,
  },
  listItem: {
    flexDirection: 'row',
    marginBottom: spacing.xs,
    paddingLeft: spacing.sm,
  },
  bullet: {
    color: theme.text.secondary,
    fontSize: 15,
    width: 20,
  },
  listText: {
    color: theme.text.secondary,
    fontSize: 15,
    flex: 1,
    lineHeight: 22,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing.xs,
    paddingLeft: spacing.sm,
  },
  checkbox: {
    color: theme.text.muted,
    fontSize: 16,
    width: 24,
  },
  checkboxChecked: {
    color: theme.accent.success,
    fontSize: 16,
    width: 24,
  },
  checkboxText: {
    color: theme.text.secondary,
    fontSize: 15,
    flex: 1,
    lineHeight: 22,
  },
  checkboxTextChecked: {
    textDecorationLine: 'line-through',
    color: theme.text.muted,
  },
  blockquote: {
    borderLeftWidth: 3,
    borderLeftColor: theme.accent.primary,
    paddingLeft: spacing.md,
    marginVertical: spacing.sm,
  },
  blockquoteText: {
    color: theme.text.secondary,
    fontSize: 15,
    fontStyle: 'italic',
    lineHeight: 22,
  },
  emptyLine: {
    height: spacing.sm,
  },
  footer: {
    padding: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: theme.border.primary,
  },
  footerText: {
    color: theme.text.muted,
    fontSize: 12,
    textAlign: 'center',
  },
  bottomPadding: {
    height: spacing.xxl,
  },
});
