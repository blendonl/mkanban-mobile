import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Alert,
} from 'react-native';
import { Project } from '../../domain/entities/Project';
import { Board } from '../../domain/entities/Board';
import { Task, TaskType } from '../../domain/entities/Task';
import { ProjectId, BoardId, TaskId } from '../../core/types';
import BaseModal from './BaseModal';
import theme from '../theme';

interface AgendaItemFormModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (data: AgendaFormData) => Promise<void>;
  projects: Project[];
  onLoadBoards: (projectId: ProjectId) => Promise<Board[]>;
  prefilledProjectId?: ProjectId;
  prefilledBoardId?: BoardId;
  prefilledTaskId?: TaskId;
  prefilledDate?: string;
}

export interface AgendaFormData {
  projectId: ProjectId;
  boardId: BoardId;
  taskId: TaskId;
  date: string;
  time?: string;
  durationMinutes?: number;
  taskType: TaskType;
  location?: string;
  attendees?: string[];
}

export const AgendaItemFormModal: React.FC<AgendaItemFormModalProps> = ({
  visible,
  onClose,
  onSubmit,
  projects,
  onLoadBoards,
  prefilledProjectId,
  prefilledBoardId,
  prefilledTaskId,
  prefilledDate,
}) => {
  const [step, setStep] = useState<'project' | 'board' | 'task' | 'details'>('project');
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [selectedBoard, setSelectedBoard] = useState<Board | null>(null);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [boards, setBoards] = useState<Board[]>([]);
  const [loading, setLoading] = useState(false);

  const [date, setDate] = useState(prefilledDate || new Date().toISOString().split('T')[0]);
  const [time, setTime] = useState('09:00');
  const [duration, setDuration] = useState<number | undefined>(60);
  const [taskType, setTaskType] = useState<TaskType>('regular');
  const [location, setLocation] = useState('');
  const [attendees, setAttendees] = useState('');

  useEffect(() => {
    if (visible) {
      if (prefilledProjectId) {
        const project = projects.find(p => p.id === prefilledProjectId);
        if (project) {
          setSelectedProject(project);
          setStep('board');
          loadBoards(project.id);
        }
      }
    } else {
      resetForm();
    }
  }, [visible, prefilledProjectId]);

  const resetForm = () => {
    setStep('project');
    setSelectedProject(null);
    setSelectedBoard(null);
    setSelectedTask(null);
    setBoards([]);
    setDate(new Date().toISOString().split('T')[0]);
    setTime('09:00');
    setDuration(60);
    setTaskType('regular');
    setLocation('');
    setAttendees('');
  };

  const loadBoards = async (projectId: ProjectId) => {
    setLoading(true);
    try {
      const loadedBoards = await onLoadBoards(projectId);
      setBoards(loadedBoards);

      if (prefilledBoardId) {
        const board = loadedBoards.find(b => b.id === prefilledBoardId);
        if (board) {
          setSelectedBoard(board);
          setStep('task');

          if (prefilledTaskId) {
            const task = findTaskInBoard(board, prefilledTaskId);
            if (task) {
              setSelectedTask(task);
              setStep('details');
            }
          }
        }
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to load boards');
    } finally {
      setLoading(false);
    }
  };

  const findTaskInBoard = (board: Board, taskId: TaskId): Task | null => {
    for (const column of board.columns) {
      const task = column.tasks.find(t => t.id === taskId);
      if (task) return task;
    }
    return null;
  };

  const handleProjectSelect = (project: Project) => {
    setSelectedProject(project);
    setStep('board');
    loadBoards(project.id);
  };

  const handleBoardSelect = (board: Board) => {
    setSelectedBoard(board);
    setStep('task');
  };

  const handleTaskSelect = (task: Task) => {
    setSelectedTask(task);
    setStep('details');
  };

  const handleSubmit = async () => {
    if (!selectedProject || !selectedBoard || !selectedTask) {
      Alert.alert('Error', 'Please select a task');
      return;
    }

    const formData: AgendaFormData = {
      projectId: selectedProject.id,
      boardId: selectedBoard.id,
      taskId: selectedTask.id,
      date,
      time: time || undefined,
      durationMinutes: duration,
      taskType,
      location: taskType === 'meeting' && location ? location : undefined,
      attendees: taskType === 'meeting' && attendees ? attendees.split(',').map(a => a.trim()) : undefined,
    };

    try {
      await onSubmit(formData);
      onClose();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to create agenda item');
    }
  };

  const renderProjectStep = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>Select Project</Text>
      <Text style={{ color: 'red', fontSize: 16, marginBottom: 10 }}>
        DEBUG: Projects count: {projects.length}
      </Text>
      {projects.length === 0 && (
        <Text style={{ color: theme.text.secondary, textAlign: 'center', marginTop: 20 }}>
          No projects found. Please create a project first.
        </Text>
      )}
      {projects.map(project => (
        <TouchableOpacity
          key={project.id}
          style={styles.listItem}
          onPress={() => handleProjectSelect(project)}
        >
          <View style={[styles.colorBadge, { backgroundColor: project.color }]} />
          <View style={styles.listItemContent}>
            <Text style={styles.listItemTitle}>{project.name}</Text>
            <Text style={styles.listItemSubtitle}>{project.status}</Text>
          </View>
          <Text style={styles.arrow}>›</Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  const renderBoardStep = () => (
    <View style={styles.stepContainer}>
      <TouchableOpacity style={styles.backButton} onPress={() => setStep('project')}>
        <Text style={styles.backButtonText}>‹ Back to Projects</Text>
      </TouchableOpacity>
      <Text style={styles.stepTitle}>Select Board</Text>
      <Text style={styles.stepSubtitle}>{selectedProject?.name}</Text>
      {loading ? (
        <Text style={styles.loadingText}>Loading boards...</Text>
      ) : (
        boards.map(board => (
          <TouchableOpacity
            key={board.id}
            style={styles.listItem}
            onPress={() => handleBoardSelect(board)}
          >
            <View style={styles.listItemContent}>
              <Text style={styles.listItemTitle}>{board.name}</Text>
              <Text style={styles.listItemSubtitle}>
                {board.columns.reduce((sum, col) => sum + col.tasks.length, 0)} tasks
              </Text>
            </View>
            <Text style={styles.arrow}>›</Text>
          </TouchableOpacity>
        ))
      )}
    </View>
  );

  const renderTaskStep = () => {
    const allTasks: Task[] = [];
    selectedBoard?.columns.forEach(column => {
      column.tasks.forEach(task => allTasks.push(task));
    });

    return (
      <View style={styles.stepContainer}>
        <TouchableOpacity style={styles.backButton} onPress={() => setStep('board')}>
          <Text style={styles.backButtonText}>‹ Back to Boards</Text>
        </TouchableOpacity>
        <Text style={styles.stepTitle}>Select Task</Text>
        <Text style={styles.stepSubtitle}>{selectedBoard?.name}</Text>
        {allTasks.map(task => (
          <TouchableOpacity
            key={task.id}
            style={styles.listItem}
            onPress={() => handleTaskSelect(task)}
          >
            <View style={styles.listItemContent}>
              <Text style={styles.listItemTitle} numberOfLines={1}>{task.title}</Text>
              <Text style={styles.listItemSubtitle}>{task.column_id}</Text>
            </View>
            <Text style={styles.arrow}>›</Text>
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  const renderDetailsStep = () => (
    <View style={styles.stepContainer}>
      <TouchableOpacity style={styles.backButton} onPress={() => setStep('task')}>
        <Text style={styles.backButtonText}>‹ Back to Tasks</Text>
      </TouchableOpacity>
      <Text style={styles.stepTitle}>Schedule Details</Text>
      <Text style={styles.stepSubtitle}>{selectedTask?.title}</Text>

      <View style={styles.formSection}>
        <Text style={styles.label}>Date</Text>
        <TextInput
          style={styles.input}
          value={date}
          onChangeText={setDate}
          placeholder="YYYY-MM-DD"
          placeholderTextColor={theme.text.tertiary}
        />
      </View>

      <View style={styles.formSection}>
        <Text style={styles.label}>Time (optional)</Text>
        <TextInput
          style={styles.input}
          value={time}
          onChangeText={setTime}
          placeholder="HH:MM"
          placeholderTextColor={theme.text.tertiary}
        />
      </View>

      <View style={styles.formSection}>
        <Text style={styles.label}>Duration (minutes)</Text>
        <TextInput
          style={styles.input}
          value={duration?.toString() || ''}
          onChangeText={(text) => setDuration(text ? parseInt(text) : undefined)}
          placeholder="60"
          keyboardType="numeric"
          placeholderTextColor={theme.text.tertiary}
        />
      </View>

      <View style={styles.formSection}>
        <Text style={styles.label}>Task Type</Text>
        <View style={styles.taskTypeRow}>
          {(['regular', 'meeting', 'milestone'] as TaskType[]).map(type => (
            <TouchableOpacity
              key={type}
              style={[
                styles.taskTypeButton,
                taskType === type && styles.taskTypeButtonActive,
              ]}
              onPress={() => setTaskType(type)}
            >
              <Text style={[
                styles.taskTypeText,
                taskType === type && styles.taskTypeTextActive,
              ]}>
                {type === 'regular' && '📋 Regular'}
                {type === 'meeting' && '👥 Meeting'}
                {type === 'milestone' && '🎯 Milestone'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {taskType === 'meeting' && (
        <>
          <View style={styles.formSection}>
            <Text style={styles.label}>Location</Text>
            <TextInput
              style={styles.input}
              value={location}
              onChangeText={setLocation}
              placeholder="Conference Room A"
              placeholderTextColor={theme.text.tertiary}
            />
          </View>

          <View style={styles.formSection}>
            <Text style={styles.label}>Attendees (comma-separated)</Text>
            <TextInput
              style={styles.input}
              value={attendees}
              onChangeText={setAttendees}
              placeholder="person@example.com, person2@example.com"
              placeholderTextColor={theme.text.tertiary}
            />
          </View>
        </>
      )}

      <TouchableOpacity style={styles.submitButton} onPress={handleSubmit}>
        <Text style={styles.submitButtonText}>Create Agenda Item</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <BaseModal
      visible={visible}
      onClose={onClose}
      title="Schedule Task"
      scrollable={true}
    >
      {step === 'project' && renderProjectStep()}
      {step === 'board' && renderBoardStep()}
      {step === 'task' && renderTaskStep()}
      {step === 'details' && renderDetailsStep()}
    </BaseModal>
  );
};

const styles = StyleSheet.create({
  stepContainer: {
    flex: 1,
  },
  stepTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.text.primary,
    marginBottom: 4,
  },
  stepSubtitle: {
    fontSize: 14,
    color: theme.text.tertiary,
    marginBottom: 16,
  },
  backButton: {
    marginBottom: 12,
  },
  backButtonText: {
    fontSize: 16,
    color: theme.accent.primary,
    fontWeight: '600',
  },
  loadingText: {
    fontSize: 14,
    color: theme.text.tertiary,
    textAlign: 'center',
    marginTop: 20,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: theme.card.background,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: theme.card.border,
  },
  colorBadge: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 12,
  },
  listItemContent: {
    flex: 1,
  },
  listItemTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.text.primary,
    marginBottom: 2,
  },
  listItemSubtitle: {
    fontSize: 12,
    color: theme.text.tertiary,
  },
  arrow: {
    fontSize: 24,
    color: theme.text.tertiary,
    marginLeft: 8,
  },
  formSection: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.text.secondary,
    marginBottom: 8,
  },
  input: {
    backgroundColor: theme.input.background,
    borderWidth: 1,
    borderColor: theme.input.border,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: theme.text.primary,
  },
  taskTypeRow: {
    flexDirection: 'row',
    gap: 8,
  },
  taskTypeButton: {
    flex: 1,
    padding: 12,
    backgroundColor: theme.card.background,
    borderWidth: 1,
    borderColor: theme.card.border,
    borderRadius: 8,
    alignItems: 'center',
  },
  taskTypeButtonActive: {
    backgroundColor: theme.accent.primary,
    borderColor: theme.accent.primary,
  },
  taskTypeText: {
    fontSize: 14,
    color: theme.text.primary,
  },
  taskTypeTextActive: {
    color: theme.background.primary,
    fontWeight: '600',
  },
  submitButton: {
    backgroundColor: theme.accent.primary,
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 20,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.background.primary,
  },
});
