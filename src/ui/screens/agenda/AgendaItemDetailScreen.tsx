import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AgendaStackParamList } from '../../navigation/TabNavigator';
import { getAgendaService, getBoardService, getProjectService } from '../../../core/DependencyContainer';
import { ScheduledAgendaItem } from '../../../services/AgendaService';
import { AgendaItem } from '../../../domain/entities/AgendaItem';
import { OrphanedItemBadge } from '../../components/OrphanedItemBadge';
import { theme } from '../../theme/colors';

import { Screen } from '../../components/Screen';

type Props = NativeStackScreenProps<AgendaStackParamList, 'AgendaItemDetail'>;

export const AgendaItemDetailScreen: React.FC<Props> = ({ route, navigation }) => {
  const { agendaItemId } = route.params;
  const [loading, setLoading] = useState(true);
  const [scheduledItem, setScheduledItem] = useState<ScheduledAgendaItem | null>(null);
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [notes, setNotes] = useState('');

  useEffect(() => {
    loadAgendaItem();
  }, [agendaItemId]);

  const loadAgendaItem = async () => {
    setLoading(true);
    try {
      const agendaService = getAgendaService();
      const item = await agendaService.getAgendaItemById(agendaItemId);

      if (!item) {
        Alert.alert('Error', 'Agenda item not found');
        navigation.goBack();
        return;
      }

      const boardService = getBoardService();
      const projectService = getProjectService();
      const board = await boardService.getBoardById(item.board_id);

      let task = null;
      let columnName = null;
      let isOrphaned = true;

      if (board) {
        for (const column of board.columns) {
          const foundTask = column.tasks.find(t => t.id === item.task_id);
          if (foundTask) {
            task = foundTask;
            columnName = column.name;
            isOrphaned = false;
            break;
          }
        }
      }

      const project = await projectService.getProjectById(item.project_id);

      const scheduled: ScheduledAgendaItem = {
        agendaItem: item,
        task,
        boardId: item.board_id,
        boardName: board?.name || 'Unknown Board',
        projectName: project?.name || 'Unknown Project',
        columnName,
        isOrphaned,
      };

      setScheduledItem(scheduled);
      setNotes(item.notes || '');
    } catch (error) {
      console.error('Failed to load agenda item:', error);
      Alert.alert('Error', 'Failed to load agenda item');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete Agenda Item',
      'Are you sure you want to delete this agenda item?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const agendaService = getAgendaService();
              await agendaService.deleteAgendaItem(scheduledItem!.agendaItem);
              navigation.goBack();
            } catch (error) {
              Alert.alert('Error', 'Failed to delete agenda item');
            }
          },
        },
      ]
    );
  };

  const handleReschedule = () => {
    Alert.prompt(
      'Reschedule',
      'Enter new date (YYYY-MM-DD):',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reschedule',
          onPress: async (newDate) => {
            if (!newDate) return;
            try {
              const agendaService = getAgendaService();
              await agendaService.rescheduleAgendaItem(
                scheduledItem!.agendaItem,
                newDate
              );
              await loadAgendaItem();
              Alert.alert('Success', 'Agenda item rescheduled');
            } catch (error) {
              Alert.alert('Error', 'Failed to reschedule');
            }
          },
        },
      ],
      'plain-text',
      scheduledItem?.agendaItem.scheduled_date
    );
  };

  const handleSaveNotes = async () => {
    try {
      const agendaItem = scheduledItem!.agendaItem;
      agendaItem.addNotes(notes);

      const agendaService = getAgendaService();
      await agendaService.updateAgendaItem(agendaItem);

      setIsEditingNotes(false);
      Alert.alert('Success', 'Notes saved');
    } catch (error) {
      Alert.alert('Error', 'Failed to save notes');
    }
  };

  const handleNavigateToTask = () => {
    if (scheduledItem?.task && !scheduledItem.isOrphaned) {
      navigation.getParent()?.navigate('BoardsTab', {
        screen: 'ItemDetail',
        params: {
          boardId: scheduledItem.boardId,
          itemId: scheduledItem.task.id,
        },
      });
    }
  };

  const formatTime = (time: string | null) => {
    if (!time) return 'No time set';
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours);
    const period = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
    return `${displayHour}:${minutes} ${period}`;
  };

  const formatDuration = (minutes: number | null) => {
    if (!minutes) return 'No duration';
    if (minutes < 60) return `${minutes} minutes`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours} hour${hours > 1 ? 's' : ''}`;
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.accent.primary} />
      </View>
    );
  }

  if (!scheduledItem) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Agenda item not found</Text>
      </View>
    );
  }

  const { agendaItem, task, projectName, boardName, columnName, isOrphaned } = scheduledItem;

  return (
    <Screen
      scrollable
      hasTabBar
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
    >
      <View style={styles.header}>
        <Text style={styles.title}>{task?.title || agendaItem.task_id}</Text>
        {isOrphaned && (
          <View style={styles.orphanedBadge}>
            <OrphanedItemBadge />
          </View>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Schedule</Text>
        <View style={styles.infoRow}>
          <Text style={styles.label}>Date:</Text>
          <Text style={styles.value}>{agendaItem.scheduled_date}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.label}>Time:</Text>
          <Text style={styles.value}>{formatTime(agendaItem.scheduled_time)}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.label}>Duration:</Text>
          <Text style={styles.value}>{formatDuration(agendaItem.duration_minutes)}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.label}>Type:</Text>
          <Text style={styles.value}>
            {agendaItem.task_type === 'meeting' && '👥 Meeting'}
            {agendaItem.task_type === 'milestone' && '🎯 Milestone'}
            {agendaItem.task_type === 'regular' && '📋 Regular'}
          </Text>
        </View>
      </View>

      {agendaItem.meeting_data && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Meeting Details</Text>
          {agendaItem.meeting_data.location && (
            <View style={styles.infoRow}>
              <Text style={styles.label}>Location:</Text>
              <Text style={styles.value}>{agendaItem.meeting_data.location}</Text>
            </View>
          )}
          {agendaItem.meeting_data.attendees && agendaItem.meeting_data.attendees.length > 0 && (
            <View style={styles.infoColumn}>
              <Text style={styles.label}>Attendees:</Text>
              {agendaItem.meeting_data.attendees.map((attendee, index) => (
                <Text key={index} style={styles.attendee}>• {attendee}</Text>
              ))}
            </View>
          )}
        </View>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Source</Text>
        <View style={styles.infoRow}>
          <Text style={styles.label}>Project:</Text>
          <Text style={styles.value}>{projectName}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.label}>Board:</Text>
          <Text style={styles.value}>{boardName}</Text>
        </View>
        {columnName && (
          <View style={styles.infoRow}>
            <Text style={styles.label}>Column:</Text>
            <Text style={styles.value}>{columnName}</Text>
          </View>
        )}
      </View>

      {!isOrphaned && task && (
        <TouchableOpacity style={styles.actionButton} onPress={handleNavigateToTask}>
          <Text style={styles.actionButtonText}>View Task Details</Text>
        </TouchableOpacity>
      )}

      <View style={styles.section}>
        <View style={styles.notesHeader}>
          <Text style={styles.sectionTitle}>Notes</Text>
          {!isEditingNotes ? (
            <TouchableOpacity onPress={() => setIsEditingNotes(true)}>
              <Text style={styles.editButton}>Edit</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.notesActions}>
              <TouchableOpacity onPress={() => {
                setNotes(agendaItem.notes || '');
                setIsEditingNotes(false);
              }}>
                <Text style={styles.cancelButton}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleSaveNotes}>
                <Text style={styles.saveButton}>Save</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
        {isEditingNotes ? (
          <TextInput
            style={styles.notesInput}
            value={notes}
            onChangeText={setNotes}
            placeholder="Add notes about this agenda item..."
            placeholderTextColor={theme.text.tertiary}
            multiline
            numberOfLines={6}
            textAlignVertical="top"
          />
        ) : (
          <Text style={styles.notesText}>
            {notes || 'No notes yet. Tap Edit to add notes.'}
          </Text>
        )}
      </View>

      <View style={styles.actions}>
        <TouchableOpacity style={styles.rescheduleButton} onPress={handleReschedule}>
          <Text style={styles.rescheduleButtonText}>📅 Reschedule</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.deleteButton} onPress={handleDelete}>
          <Text style={styles.deleteButtonText}>🗑️ Delete</Text>
        </TouchableOpacity>
      </View>
    </Screen>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.background.primary,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.background.primary,
  },
  errorText: {
    fontSize: 16,
    color: theme.text.tertiary,
  },
  header: {
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: theme.text.primary,
    marginBottom: 12,
  },
  orphanedBadge: {
    marginTop: 8,
  },
  section: {
    backgroundColor: theme.card.background,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: theme.card.border,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.text.primary,
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  infoColumn: {
    marginBottom: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.text.secondary,
  },
  value: {
    fontSize: 14,
    color: theme.text.primary,
  },
  attendee: {
    fontSize: 14,
    color: theme.text.primary,
    marginTop: 4,
  },
  actionButton: {
    backgroundColor: theme.accent.primary,
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 16,
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.background.primary,
  },
  notesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  editButton: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.accent.primary,
  },
  notesActions: {
    flexDirection: 'row',
    gap: 16,
  },
  cancelButton: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.text.tertiary,
  },
  saveButton: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.accent.primary,
  },
  notesInput: {
    backgroundColor: theme.input.background,
    borderWidth: 1,
    borderColor: theme.input.border,
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: theme.text.primary,
    minHeight: 120,
  },
  notesText: {
    fontSize: 14,
    color: theme.text.primary,
    lineHeight: 20,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
    marginBottom: 32,
  },
  rescheduleButton: {
    flex: 1,
    backgroundColor: theme.card.background,
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.accent.primary,
  },
  rescheduleButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.accent.primary,
  },
  deleteButton: {
    flex: 1,
    backgroundColor: theme.card.background,
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.accent.error,
  },
  deleteButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.accent.error,
  },
});
