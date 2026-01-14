import React, { useState, useEffect, useCallback, useLayoutEffect, useRef } from 'react';
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
import { Screen } from '../../components/Screen';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import theme from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { uiConstants } from '../../theme/uiConstants';
import { useDebounce } from '../../hooks/useDebounce';
import { getNoteService, getProjectService, getBoardService, getTaskService } from '../../../core/DependencyContainer';
import { Note, NoteType } from '../../../domain/entities/Note';
import { NotesStackParamList } from '../../navigation/TabNavigator';
import AutoSaveIndicator, { SaveStatus } from '../../components/AutoSaveIndicator';
import EntityChip from '../../components/EntityChip';
import EntityPicker from '../../components/EntityPicker';
import { ProjectId, BoardId, TaskId } from '../../../core/types';

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
  const { noteId, projectIds: initialProjectIds, boardIds: initialBoardIds, taskIds: initialTaskIds } = route.params || {};

  const [note, setNote] = useState<Note | null>(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [noteType, setNoteType] = useState<NoteType>('general');
  const [tags, setTags] = useState<string[]>([]);
  const [selectedProjects, setSelectedProjects] = useState<ProjectId[]>(initialProjectIds || []);
  const [selectedBoards, setSelectedBoards] = useState<BoardId[]>(initialBoardIds || []);
  const [selectedTasks, setSelectedTasks] = useState<TaskId[]>(initialTaskIds || []);
  const [tagInput, setTagInput] = useState('');
  const [loading, setLoading] = useState(!!noteId);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [showEntityPicker, setShowEntityPicker] = useState(false);

  const [entityNames, setEntityNames] = useState<{
    projects: Map<string, string>;
    boards: Map<string, string>;
    tasks: Map<string, string>;
  }>({
    projects: new Map(),
    boards: new Map(),
    tasks: new Map(),
  });

  const isInitialMount = useRef(true);

  const debouncedTitle = useDebounce(title, uiConstants.AUTO_SAVE_DEBOUNCE_TIME);
  const debouncedContent = useDebounce(content, uiConstants.AUTO_SAVE_DEBOUNCE_TIME);
  const debouncedTags = useDebounce(tags, uiConstants.AUTO_SAVE_DEBOUNCE_TIME);

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
        setTags(loadedNote.tags);
        setSelectedProjects(loadedNote.project_ids);
        setSelectedBoards(loadedNote.board_ids);
        setSelectedTasks(loadedNote.task_ids);
      }
    } catch (error) {
      console.error('Failed to load note:', error);
    } finally {
      setLoading(false);
    }
  }, [noteId]);

  const loadEntityNames = useCallback(async () => {
    try {
      const projectService = getProjectService();
      const boardService = getBoardService();
      const taskService = getTaskService();

      const newEntityNames = {
        projects: new Map<string, string>(),
        boards: new Map<string, string>(),
        tasks: new Map<string, string>(),
      };

      for (const projectId of selectedProjects) {
        try {
          const project = await projectService.getProjectById(projectId);
          if (project) newEntityNames.projects.set(projectId, project.name);
        } catch (e) { }
      }

      for (const boardId of selectedBoards) {
        try {
          const board = await boardService.getBoardById(boardId);
          if (board) newEntityNames.boards.set(boardId, board.name);
        } catch (e) { }
      }

      for (const taskId of selectedTasks) {
        try {
          // const task = await taskService.getTask(taskId);
          // if (task) newEntityNames.tasks.set(taskId, task.title);
        } catch (e) { }
      }

      setEntityNames(newEntityNames);
    } catch (error) {
      console.error('Failed to load entity names:', error);
    }
  }, [selectedProjects, selectedBoards, selectedTasks]);

  useEffect(() => {
    loadNote();
  }, [loadNote]);

  useEffect(() => {
    loadEntityNames();
  }, [loadEntityNames]);

  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }

    if (!debouncedTitle.trim()) {
      return;
    }

    saveNote();
  }, [debouncedTitle, debouncedContent, debouncedTags, selectedProjects, selectedBoards, selectedTasks]);

  useLayoutEffect(() => {
    navigation.setOptions({
      title: noteId ? 'Edit Note' : 'New Note',
      headerLeft: () => (
        <TouchableOpacity
          style={styles.headerButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.headerButtonText}>Close</Text>
        </TouchableOpacity>
      ),
      headerRight: noteId ? () => (
        <TouchableOpacity
          style={styles.headerButton}
          onPress={handleDelete}
        >
          <Text style={[styles.headerButtonText, { color: theme.accent.error }]}>Delete</Text>
        </TouchableOpacity>
      ) : undefined,
    });
  }, [navigation, noteId]);

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
              if (noteId) {
                await noteService.deleteNote(noteId);
              }
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

  const saveNote = async () => {
    if (!title.trim()) return;

    setSaveStatus('saving');
    try {
      const noteService = getNoteService();

      if (note) {
        await noteService.updateNote(note.id, {
          title: title.trim(),
          content,
          tags,
          projectIds: selectedProjects,
          boardIds: selectedBoards,
          taskIds: selectedTasks,
        });
      } else {
        const newNote = await noteService.createNote(title.trim(), content, {
          noteType,
          projectIds: selectedProjects,
          boardIds: selectedBoards,
          taskIds: selectedTasks,
          tags,
        });
        setNote(newNote);
      }

      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch (error) {
      console.error('Failed to save note:', error);
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 3000);
    }
  };

  const insertTemplate = (template: string) => {
    setContent(prev => prev + template);
  };

  const handleAddTag = () => {
    if (tagInput.trim() && !tags.includes(tagInput.trim().toLowerCase())) {
      setTags([...tags, tagInput.trim().toLowerCase()]);
      setTagInput('');
    }
  };

  const handleRemoveTag = (tag: string) => {
    setTags(tags.filter(t => t !== tag));
  };

  const handleRemoveProject = (projectId: string) => {
    setSelectedProjects(selectedProjects.filter(id => id !== projectId));
  };

  const handleRemoveBoard = (boardId: string) => {
    setSelectedBoards(selectedBoards.filter(id => id !== boardId));
  };

  const handleRemoveTask = (taskId: string) => {
    setSelectedTasks(selectedTasks.filter(id => id !== taskId));
  };

  const handleEntitySelectionChange = (
    projects: ProjectId[],
    boards: BoardId[],
    tasks: TaskId[]
  ) => {
    setSelectedProjects(projects);
    setSelectedBoards(boards);
    setSelectedTasks(tasks);
  };

  if (loading) {
    return (
      <Screen>
        <View style={styles.container}>
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </Screen>
    );
  }

  return (
    <Screen style={styles.container} scrollable={false}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={88}
      >
        <AutoSaveIndicator status={saveStatus} />

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
                    activeOpacity={0.8}
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
              placeholder="Untitled note"
              placeholderTextColor={theme.text.muted}
              value={title}
              onChangeText={setTitle}
              autoFocus={!noteId}
            />
          </View>

          <View style={styles.entitiesSection}>
            <Text style={styles.sectionLabel}>Connected To</Text>
            <View style={styles.entityChipsContainer}>
              {selectedProjects.map(id => (
                <EntityChip
                  key={id}
                  entityType="project"
                  entityId={id}
                  entityName={entityNames.projects.get(id) || id}
                  onRemove={handleRemoveProject}
                />
              ))}
              {selectedBoards.map(id => (
                <EntityChip
                  key={id}
                  entityType="board"
                  entityId={id}
                  entityName={entityNames.boards.get(id) || id}
                  onRemove={handleRemoveBoard}
                />
              ))}
              {selectedTasks.map(id => (
                <EntityChip
                  key={id}
                  entityType="task"
                  entityId={id}
                  entityName={entityNames.tasks.get(id) || id}
                  onRemove={handleRemoveTask}
                />
              ))}
              <TouchableOpacity
                style={styles.addEntityButton}
                onPress={() => setShowEntityPicker(true)}
              >
                <Text style={styles.addEntityButtonText}>+ Add</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.tagsSection}>
            <Text style={styles.sectionLabel}>Tags</Text>
            <View style={styles.tagsContainer}>
              {tags.map(tag => (
                <View key={tag} style={styles.tagChip}>
                  <Text style={styles.tagText}>#{tag}</Text>
                  <TouchableOpacity
                    onPress={() => handleRemoveTag(tag)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Text style={styles.tagRemove}>×</Text>
                  </TouchableOpacity>
                </View>
              ))}
              <TextInput
                style={styles.tagInput}
                placeholder="Add tags..."
                placeholderTextColor={theme.text.muted}
                value={tagInput}
                onChangeText={setTagInput}
                onSubmitEditing={handleAddTag}
                returnKeyType="done"
              />
            </View>
          </View>

          <View style={styles.toolbar}>
            <TouchableOpacity style={styles.toolButton} onPress={() => insertTemplate('\n## ')}>
              <Text style={styles.toolButtonText}>H</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.toolButton} onPress={() => insertTemplate('\n- ')}>
              <Text style={styles.toolButtonText}>•</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.toolButton} onPress={() => insertTemplate('\n- [ ] ')}>
              <Text style={styles.toolButtonText}>☐</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.toolButton} onPress={() => insertTemplate('\n> ')}>
              <Text style={styles.toolButtonText}>"</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.editorContainer}>
            <TextInput
              style={styles.contentInput}
              placeholder="Start writing your note..."
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

        <EntityPicker
          visible={showEntityPicker}
          onClose={() => setShowEntityPicker(false)}
          selectedProjects={selectedProjects}
          selectedBoards={selectedBoards}
          selectedTasks={selectedTasks}
          onSelectionChange={handleEntitySelectionChange}
        />
      </KeyboardAvoidingView>
    </Screen>
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
    color: theme.accent.primary,
    fontSize: 16,
    fontWeight: '500',
  },
  typeSelector: {
    padding: spacing.lg,
  },
  sectionLabel: {
    color: theme.text.secondary,
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.md,
  },
  typeButtons: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  typeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.glass.tint.neutral,
    borderRadius: 12,
    padding: spacing.md,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  typeButtonActive: {
    borderColor: theme.accent.primary,
    backgroundColor: theme.accent.primary + '20',
  },
  typeIcon: {
    fontSize: 20,
    marginRight: spacing.sm,
  },
  typeLabel: {
    color: theme.text.primary,
    fontSize: 15,
    fontWeight: '500',
  },
  typeLabelActive: {
    color: theme.accent.primary,
    fontWeight: '600',
  },
  titleContainer: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  titleInput: {
    color: theme.text.primary,
    fontSize: 28,
    fontWeight: '700',
  },
  entitiesSection: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  entityChipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  addEntityButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    backgroundColor: theme.glass.tint.blue,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.accent.primary,
    marginRight: spacing.xs,
    marginBottom: spacing.xs,
  },
  addEntityButtonText: {
    color: theme.accent.primary,
    fontSize: 13,
    fontWeight: '600',
  },
  tagsSection: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    backgroundColor: theme.input.background,
    borderRadius: 12,
    padding: spacing.sm,
    minHeight: 44,
  },
  tagChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.accent.primary + '20',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: spacing.xs,
    marginBottom: spacing.xs,
  },
  tagText: {
    color: theme.accent.primary,
    fontSize: 13,
    fontWeight: '500',
  },
  tagRemove: {
    color: theme.accent.primary,
    fontSize: 18,
    fontWeight: '300',
    marginLeft: spacing.xs,
  },
  tagInput: {
    flex: 1,
    color: theme.text.primary,
    fontSize: 14,
    minWidth: 100,
    paddingVertical: 4,
  },
  toolbar: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
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
    paddingHorizontal: spacing.lg,
    minHeight: 400,
  },
  contentInput: {
    color: theme.text.primary,
    fontSize: 17,
    lineHeight: 28,
    minHeight: 400,
  },
  bottomPadding: {
    height: spacing.xxxl * 2,
  },
});
