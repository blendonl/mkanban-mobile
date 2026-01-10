import React, { useState, useEffect, useCallback, useLayoutEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import theme from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { getNoteService } from '../../../core/DependencyContainer';
import { Note, NoteType } from '../../../domain/entities/Note';
import { NotesStackParamList } from '../../navigation/TabNavigator';

type NoteEditorRouteProp = RouteProp<NotesStackParamList, 'NoteEditor'>;
type NoteEditorNavProp = StackNavigationProp<NotesStackParamList, 'NoteEditor'>;

const NOTE_TYPES: { value: NoteType; label: string; icon: string }[] = [
  { value: 'general', label: 'Note', icon: '📝' },
  { value: 'meeting', label: 'Meeting', icon: '👥' },
  { value: 'daily', label: 'Daily', icon: '📅' },
];

export default function NoteEditorScreen() {
  const route = useRoute<NoteEditorRouteProp>();
  const navigation = useNavigation<NoteEditorNavProp>();
  const { noteId, projectId, taskId } = route.params || {};

  const [note, setNote] = useState<Note | null>(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [noteType, setNoteType] = useState<NoteType>('general');
  const [tagsInput, setTagsInput] = useState('');
  const [loading, setLoading] = useState(!!noteId);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  const loadNote = useCallback(async () => {
    if (!noteId) {
      setLoading(false);
      return;
    }

    try {
      const noteService = getNoteService();
      const loadedNote = await noteService.getNoteById(noteId);
      if (loadedNote) {
        setNote(loadedNote);
        setTitle(loadedNote.title);
        setContent(loadedNote.content);
        setNoteType(loadedNote.note_type);
        setTagsInput(loadedNote.tags.join(', '));
      }
    } catch (error) {
      console.error('Failed to load note:', error);
      Alert.alert('Error', 'Failed to load note');
    } finally {
      setLoading(false);
    }
  }, [noteId]);

  useEffect(() => {
    loadNote();
  }, [loadNote]);

  useEffect(() => {
    if (note) {
      const changed =
        title !== note.title ||
        content !== note.content ||
        noteType !== note.note_type ||
        tagsInput !== note.tags.join(', ');
      setHasChanges(changed);
    } else {
      setHasChanges(title.length > 0 || content.length > 0);
    }
  }, [note, title, content, noteType, tagsInput]);

  useLayoutEffect(() => {
    navigation.setOptions({
      title: noteId ? 'Edit Note' : 'New Note',
      headerLeft: () => (
        <TouchableOpacity
          style={styles.headerButton}
          onPress={handleCancel}
        >
          <Text style={styles.headerButtonText}>Cancel</Text>
        </TouchableOpacity>
      ),
      headerRight: () => (
        <TouchableOpacity
          style={styles.headerButton}
          onPress={handleSave}
          disabled={saving || !title.trim()}
        >
          <Text style={[
            styles.headerButtonText,
            styles.saveButtonText,
            (!title.trim() || saving) && styles.disabledText,
          ]}>
            {saving ? 'Saving...' : 'Save'}
          </Text>
        </TouchableOpacity>
      ),
    });
  }, [navigation, noteId, title, saving, hasChanges]);

  const handleCancel = () => {
    if (hasChanges) {
      Alert.alert(
        'Discard Changes',
        'You have unsaved changes. Are you sure you want to discard them?',
        [
          { text: 'Keep Editing', style: 'cancel' },
          { text: 'Discard', style: 'destructive', onPress: () => navigation.goBack() },
        ]
      );
    } else {
      navigation.goBack();
    }
  };

  const handleSave = async () => {
    if (!title.trim()) {
      Alert.alert('Error', 'Please enter a title for your note');
      return;
    }

    setSaving(true);
    try {
      const noteService = getNoteService();
      const tags = tagsInput
        .split(',')
        .map(t => t.trim().toLowerCase())
        .filter(t => t.length > 0);

      if (note) {
        await noteService.updateNote(note.id, {
          title: title.trim(),
          content,
          tags,
        });
      } else {
        await noteService.createNote(title.trim(), content, {
          noteType,
          projectId: projectId || undefined,
          taskId: taskId || undefined,
          tags,
        });
      }

      navigation.goBack();
    } catch (error) {
      console.error('Failed to save note:', error);
      Alert.alert('Error', 'Failed to save note');
    } finally {
      setSaving(false);
    }
  };

  const insertTemplate = (template: string) => {
    setContent(prev => prev + template);
  };

  const handleInsertHeading = () => {
    insertTemplate('\n## ');
  };

  const handleInsertList = () => {
    insertTemplate('\n- ');
  };

  const handleInsertCheckbox = () => {
    insertTemplate('\n- [ ] ');
  };

  const handleInsertQuote = () => {
    insertTemplate('\n> ');
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={88}
    >
      <ScrollView style={styles.scrollView} keyboardShouldPersistTaps="handled">
        {!noteId && (
          <View style={styles.typeSelector}>
            <Text style={styles.sectionLabel}>Note Type</Text>
            <View style={styles.typeButtons}>
              {NOTE_TYPES.map(type => (
                <TouchableOpacity
                  key={type.value}
                  style={[
                    styles.typeButton,
                    noteType === type.value && styles.typeButtonActive,
                  ]}
                  onPress={() => setNoteType(type.value)}
                >
                  <Text style={styles.typeIcon}>{type.icon}</Text>
                  <Text style={[
                    styles.typeLabel,
                    noteType === type.value && styles.typeLabelActive,
                  ]}>
                    {type.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        <View style={styles.titleContainer}>
          <TextInput
            style={styles.titleInput}
            placeholder="Note title"
            placeholderTextColor={theme.text.muted}
            value={title}
            onChangeText={setTitle}
            autoFocus={!noteId}
          />
        </View>

        <View style={styles.tagsContainer}>
          <TextInput
            style={styles.tagsInput}
            placeholder="Tags (comma separated)"
            placeholderTextColor={theme.text.muted}
            value={tagsInput}
            onChangeText={setTagsInput}
          />
        </View>

        <View style={styles.toolbar}>
          <TouchableOpacity style={styles.toolButton} onPress={handleInsertHeading}>
            <Text style={styles.toolButtonText}>H</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.toolButton} onPress={handleInsertList}>
            <Text style={styles.toolButtonText}>•</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.toolButton} onPress={handleInsertCheckbox}>
            <Text style={styles.toolButtonText}>☐</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.toolButton} onPress={handleInsertQuote}>
            <Text style={styles.toolButtonText}>"</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.editorContainer}>
          <TextInput
            style={styles.contentInput}
            placeholder="Start writing..."
            placeholderTextColor={theme.text.muted}
            value={content}
            onChangeText={setContent}
            multiline
            textAlignVertical="top"
            scrollEnabled={false}
          />
        </View>

        <View style={styles.bottomPadding} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background.primary,
  },
  scrollView: {
    flex: 1,
  },
  loadingText: {
    color: theme.text.secondary,
    textAlign: 'center',
    marginTop: spacing.xl,
  },
  headerButton: {
    marginHorizontal: spacing.md,
  },
  headerButtonText: {
    color: theme.text.secondary,
    fontSize: 16,
  },
  saveButtonText: {
    color: theme.accent.primary,
    fontWeight: '600',
  },
  disabledText: {
    opacity: 0.5,
  },
  typeSelector: {
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.border.primary,
  },
  sectionLabel: {
    color: theme.text.secondary,
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.sm,
  },
  typeButtons: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  typeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.card.background,
    borderRadius: 8,
    padding: spacing.sm,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  typeButtonActive: {
    borderColor: theme.accent.primary,
    backgroundColor: theme.accent.primary + '20',
  },
  typeIcon: {
    fontSize: 16,
    marginRight: spacing.xs,
  },
  typeLabel: {
    color: theme.text.primary,
    fontSize: 14,
    fontWeight: '500',
  },
  typeLabelActive: {
    color: theme.accent.primary,
  },
  titleContainer: {
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.border.primary,
  },
  titleInput: {
    color: theme.text.primary,
    fontSize: 22,
    fontWeight: '600',
  },
  tagsContainer: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.border.primary,
  },
  tagsInput: {
    color: theme.text.secondary,
    fontSize: 14,
  },
  toolbar: {
    flexDirection: 'row',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.border.primary,
    backgroundColor: theme.background.secondary,
  },
  toolButton: {
    width: 40,
    height: 36,
    borderRadius: 6,
    backgroundColor: theme.card.background,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.sm,
  },
  toolButtonText: {
    color: theme.text.primary,
    fontSize: 18,
    fontWeight: '600',
  },
  editorContainer: {
    padding: spacing.md,
    minHeight: 300,
  },
  contentInput: {
    color: theme.text.primary,
    fontSize: 16,
    lineHeight: 24,
    minHeight: 300,
  },
  bottomPadding: {
    height: spacing.xxxl,
  },
});
