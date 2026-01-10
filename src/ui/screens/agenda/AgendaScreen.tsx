import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import theme from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { getAgendaService, getProjectService } from '../../../core/DependencyContainer';
import { ScheduledAgendaItem, DayAgenda } from '../../../services/AgendaService';
import { AgendaStackParamList } from '../../navigation/TabNavigator';
import { AgendaItemCard } from '../../components/AgendaItemCard';
import { AgendaItemFormModal, AgendaFormData } from '../../components/AgendaItemFormModal';
import { Project } from '../../../domain/entities/Project';
import { Board } from '../../../domain/entities/Board';
import { getBoardService } from '../../../core/DependencyContainer';

type AgendaScreenNavProp = StackNavigationProp<AgendaStackParamList, 'AgendaMain'>;

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function AgendaScreen() {
  const navigation = useNavigation<AgendaScreenNavProp>();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [weekStart, setWeekStart] = useState(getMonday(new Date()));
  const [weekData, setWeekData] = useState<Map<string, DayAgenda>>(new Map());
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showFormModal, setShowFormModal] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);

  const loadWeekData = useCallback(async () => {
    try {
      const agendaService = getAgendaService();
      const data = await agendaService.getAgendaForWeek(weekStart.toISOString().split('T')[0]);
      setWeekData(data);
    } catch (error) {
      console.error('Failed to load week data:', error);
    } finally {
      setLoading(false);
    }
  }, [weekStart]);

  const loadProjects = async () => {
    try {
      const projectService = getProjectService();
      const allProjects = await projectService.getAllProjects();
      setProjects(allProjects);
    } catch (error) {
      console.error('Failed to load projects:', error);
    }
  };

  useEffect(() => {
    loadWeekData();
    loadProjects();
  }, [loadWeekData]);

  useFocusEffect(
    useCallback(() => {
      loadWeekData();
    }, [loadWeekData])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadWeekData();
    setRefreshing(false);
  }, [loadWeekData]);

  const goToPreviousWeek = () => {
    const prev = new Date(weekStart);
    prev.setDate(prev.getDate() - 7);
    setWeekStart(prev);
    setSelectedDate(prev);
  };

  const goToNextWeek = () => {
    const next = new Date(weekStart);
    next.setDate(next.getDate() + 7);
    setWeekStart(next);
    setSelectedDate(next);
  };

  const goToToday = () => {
    const today = new Date();
    setWeekStart(getMonday(today));
    setSelectedDate(today);
  };

  const getWeekDays = (): Date[] => {
    const days: Date[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(weekStart);
      d.setDate(d.getDate() + i);
      days.push(d);
    }
    return days;
  };

  const isToday = (date: Date): boolean => {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  const isSelected = (date: Date): boolean => {
    return date.toDateString() === selectedDate.toDateString();
  };

  const formatDateKey = (date: Date): string => {
    return date.toISOString().split('T')[0];
  };

  const getSelectedDayAgenda = (): DayAgenda | undefined => {
    return weekData.get(formatDateKey(selectedDate));
  };

  const handleAgendaItemPress = (scheduledItem: ScheduledAgendaItem) => {
    navigation.navigate('AgendaItemDetail', {
      agendaItemId: scheduledItem.agendaItem.id,
    });
  };

  const handleLoadBoards = async (projectId: string): Promise<Board[]> => {
    try {
      const boardService = getBoardService();
      const project = projects.find(p => p.id === projectId);
      if (!project) return [];

      const boards = await boardService.getAllBoards(project.slug);
      return boards;
    } catch (error) {
      console.error('Failed to load boards:', error);
      return [];
    }
  };

  const handleCreateAgendaItem = async (data: AgendaFormData) => {
    try {
      const agendaService = getAgendaService();
      await agendaService.createAgendaItem(
        data.projectId,
        data.boardId,
        data.taskId,
        data.date,
        data.time,
        data.durationMinutes,
        data.taskType,
        data.location || data.attendees ? {
          location: data.location,
          attendees: data.attendees,
        } : undefined
      );
      await loadWeekData();
    } catch (error) {
      throw error;
    }
  };

  const renderWeekHeader = () => {
    const weekDays = getWeekDays();
    const monthYear = selectedDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

    return (
      <View style={styles.weekHeader}>
        <View style={styles.monthRow}>
          <TouchableOpacity onPress={goToPreviousWeek} style={styles.navButton}>
            <Text style={styles.navButtonText}>‹</Text>
          </TouchableOpacity>
          <View style={styles.monthCenter}>
            <TouchableOpacity onPress={goToToday}>
              <Text style={styles.monthText}>{monthYear}</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity onPress={goToNextWeek} style={styles.navButton}>
            <Text style={styles.navButtonText}>›</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.daysRow}>
          {weekDays.map((date, index) => {
            const dateStr = formatDateKey(date);
            const dayAgenda = weekData.get(dateStr);
            const hasItems = dayAgenda && dayAgenda.items.length > 0;

            return (
              <TouchableOpacity
                key={index}
                style={[
                  styles.dayCell,
                  isSelected(date) && styles.dayCellSelected,
                  isToday(date) && styles.dayCellToday,
                ]}
                onPress={() => setSelectedDate(date)}
              >
                <Text style={[
                  styles.dayName,
                  isSelected(date) && styles.dayNameSelected,
                ]}>
                  {DAYS[index]}
                </Text>
                <Text style={[
                  styles.dayNumber,
                  isSelected(date) && styles.dayNumberSelected,
                  isToday(date) && styles.dayNumberToday,
                ]}>
                  {date.getDate()}
                </Text>
                {hasItems && <View style={styles.dayDot} />}
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    );
  };

  const renderDaySection = (title: string, items: ScheduledAgendaItem[], icon: string) => {
    if (items.length === 0) return null;

    return (
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionIcon}>{icon}</Text>
          <Text style={styles.sectionTitle}>{title}</Text>
          <Text style={styles.sectionCount}>{items.length}</Text>
        </View>
        {items.map(item => (
          <AgendaItemCard
            key={item.agendaItem.id}
            scheduledItem={item}
            onPress={() => handleAgendaItemPress(item)}
          />
        ))}
      </View>
    );
  };

  const renderDayContent = () => {
    const dayAgenda = getSelectedDayAgenda();
    const selectedDateStr = selectedDate.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    });

    if (!dayAgenda || dayAgenda.items.length === 0) {
      return (
        <View style={styles.emptyDay}>
          <Text style={styles.emptyIcon}>📅</Text>
          <Text style={styles.emptyTitle}>No tasks scheduled</Text>
          <Text style={styles.emptySubtitle}>{selectedDateStr}</Text>
          <TouchableOpacity
            style={styles.scheduleButton}
            onPress={() => setShowFormModal(true)}
          >
            <Text style={styles.scheduleButtonText}>+ Schedule a task</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <ScrollView
        style={styles.dayContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.accent.primary}
          />
        }
      >
        <Text style={styles.dayDateLabel}>{selectedDateStr}</Text>
        {renderDaySection('Meetings', dayAgenda.meetings, '👥')}
        {renderDaySection('Tasks', dayAgenda.regularTasks, '📋')}
        {renderDaySection('Milestones', dayAgenda.milestones, '🎯')}
        {dayAgenda.orphanedItems.length > 0 && (
          renderDaySection('Orphaned Items', dayAgenda.orphanedItems, '⚠️')
        )}
        <View style={styles.bottomPadding} />
      </ScrollView>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.accent.primary} />
          <Text style={styles.loadingText}>Loading agenda...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {renderWeekHeader()}
      {renderDayContent()}

      <TouchableOpacity
        style={styles.fab}
        onPress={() => setShowFormModal(true)}
      >
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>

      <AgendaItemFormModal
        visible={showFormModal}
        onClose={() => setShowFormModal(false)}
        onSubmit={handleCreateAgendaItem}
        projects={projects}
        onLoadBoards={handleLoadBoards}
        prefilledDate={formatDateKey(selectedDate)}
      />
    </SafeAreaView>
  );
}

function getMonday(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background.primary,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: theme.text.secondary,
    marginTop: spacing.md,
  },
  weekHeader: {
    backgroundColor: theme.background.secondary,
    paddingTop: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.border.primary,
  },
  monthRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
  },
  navButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  navButtonText: {
    color: theme.accent.primary,
    fontSize: 28,
    fontWeight: '300',
  },
  monthText: {
    color: theme.text.primary,
    fontSize: 18,
    fontWeight: '600',
  },
  monthCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  daysRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: spacing.xs,
    paddingBottom: spacing.sm,
  },
  dayCell: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius: 12,
    minWidth: 44,
  },
  dayCellSelected: {
    backgroundColor: theme.accent.primary,
  },
  dayCellToday: {
    borderWidth: 1,
    borderColor: theme.accent.primary,
  },
  dayName: {
    color: theme.text.secondary,
    fontSize: 12,
    fontWeight: '500',
    marginBottom: spacing.xs,
  },
  dayNameSelected: {
    color: theme.background.primary,
  },
  dayNumber: {
    color: theme.text.primary,
    fontSize: 16,
    fontWeight: '600',
  },
  dayNumberSelected: {
    color: theme.background.primary,
  },
  dayNumberToday: {
    color: theme.accent.primary,
  },
  dayDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: theme.accent.primary,
    marginTop: spacing.xs,
  },
  dayContent: {
    flex: 1,
  },
  dayDateLabel: {
    color: theme.text.secondary,
    fontSize: 14,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  section: {
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
  },
  sectionIcon: {
    fontSize: 16,
    marginRight: spacing.sm,
  },
  sectionTitle: {
    color: theme.text.secondary,
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
  sectionCount: {
    color: theme.text.muted,
    fontSize: 12,
    backgroundColor: theme.background.elevated,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: 10,
  },
  emptyDay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: spacing.md,
  },
  emptyTitle: {
    color: theme.text.primary,
    fontSize: 18,
    fontWeight: '600',
    marginBottom: spacing.xs,
  },
  emptySubtitle: {
    color: theme.text.secondary,
    fontSize: 14,
    marginBottom: spacing.lg,
  },
  scheduleButton: {
    backgroundColor: theme.accent.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: 8,
  },
  scheduleButtonText: {
    color: theme.background.primary,
    fontSize: 15,
    fontWeight: '600',
  },
  bottomPadding: {
    height: 100,
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
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
    color: theme.background.primary,
    fontSize: 32,
    fontWeight: '300',
    lineHeight: 32,
  },
});
