import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Screen } from '../../components/Screen';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import theme from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { getAgendaService, getProjectService } from '../../../core/DependencyContainer';
import { ScheduledAgendaItem, DayAgenda } from '../../../services/AgendaService';
import { AgendaStackParamList } from '../../navigation/TabNavigator';
import { AgendaItemCard } from '../../components/AgendaItemCard';
import { AgendaItemFormModal, AgendaFormData } from '../../components/AgendaItemFormModal';
import AppIcon, { AppIconName } from '../../components/icons/AppIcon';
import { Project } from '../../../domain/entities/Project';
import { Board } from '../../../domain/entities/Board';
import { getBoardService } from '../../../core/DependencyContainer';
import { useAutoRefresh } from '../../hooks/useAutoRefresh';

type AgendaScreenNavProp = StackNavigationProp<AgendaStackParamList, 'AgendaMain'>;

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

import { useSafeAreaInsets } from 'react-native-safe-area-context';
import uiConstants from '../../theme/uiConstants';

export default function AgendaScreen() {
  const navigation = useNavigation<AgendaScreenNavProp>();
  const insets = useSafeAreaInsets();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [weekStart, setWeekStart] = useState(getMonday(new Date()));
  const [monthAnchor, setMonthAnchor] = useState(getMonthStart(new Date()));
  const [weekData, setWeekData] = useState<Map<string, DayAgenda>>(new Map());
  const [monthData, setMonthData] = useState<Map<string, DayAgenda>>(new Map());
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [monthLoading, setMonthLoading] = useState(false);
  const [showFormModal, setShowFormModal] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [viewMode, setViewMode] = useState<'week' | 'month'>('week');

  const fabBottom = uiConstants.TAB_BAR_HEIGHT + uiConstants.TAB_BAR_BOTTOM_MARGIN + insets.bottom + 24;

  const loadWeekData = useCallback(async () => {
    try {
      const agendaService = getAgendaService();
      const weekStartStr = weekStart.toISOString().split('T')[0];
      console.log(`[AgendaScreen] Loading week data starting from: ${weekStartStr}`);
      const data = await agendaService.getAgendaForWeek(weekStartStr);
      console.log(`[AgendaScreen] Loaded week data, map size: ${data.size}`);
      setWeekData(data);
    } catch (error) {
      console.error('Failed to load week data:', error);
    } finally {
      setLoading(false);
    }
  }, [weekStart]);

  const loadMonthData = useCallback(async () => {
    try {
      setMonthLoading(true);
      const agendaService = getAgendaService();
      const monthStart = getMonthStart(monthAnchor);
      const monthEnd = getMonthEnd(monthAnchor);
      const monthStartStr = formatDateKey(monthStart);
      const monthEndStr = formatDateKey(monthEnd);
      const data = await agendaService.getAgendaForDateRange(monthStartStr, monthEndStr);
      setMonthData(data);
    } catch (error) {
      console.error('Failed to load month data:', error);
    } finally {
      setMonthLoading(false);
    }
  }, [monthAnchor]);

  const refreshAgendaData = useCallback(async () => {
    await loadWeekData();
    if (viewMode === 'month') {
      await loadMonthData();
    }
  }, [loadWeekData, loadMonthData, viewMode]);

  const loadProjects = async () => {
    try {
      console.log('Loading projects...');
      const projectService = getProjectService();
      const allProjects = await projectService.getAllProjects();
      console.log('Loaded projects:', allProjects.length);
      setProjects(allProjects);
    } catch (error) {
      console.error('Failed to load projects:', error);
    }
  };

  useEffect(() => {
    loadWeekData();
    loadProjects();
  }, [loadWeekData]);

  useEffect(() => {
    if (viewMode === 'month') {
      loadMonthData();
    }
  }, [viewMode, loadMonthData]);

  useAutoRefresh(['agenda_invalidated'], refreshAgendaData);

  useFocusEffect(
    useCallback(() => {
      refreshAgendaData();
    }, [refreshAgendaData])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refreshAgendaData();
    setRefreshing(false);
  }, [refreshAgendaData]);

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
    setMonthAnchor(getMonthStart(today));
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
    const dateKey = formatDateKey(selectedDate);
    return viewMode === 'month' ? monthData.get(dateKey) : weekData.get(dateKey);
  };

  const handleAgendaItemPress = (scheduledItem: ScheduledAgendaItem) => {
    navigation.navigate('AgendaItemDetail', {
      agendaItemId: scheduledItem.agendaItem.id,
    });
  };

  const handleAgendaItemLongPress = (scheduledItem: ScheduledAgendaItem) => {
    Alert.alert(
      scheduledItem.task?.title || 'Agenda Item',
      'Choose an action',
      [
        {
          text: 'View Details',
          onPress: () => handleAgendaItemPress(scheduledItem),
        },
        {
          text: 'Reschedule',
          onPress: () => {
            navigation.navigate('AgendaItemDetail', {
              agendaItemId: scheduledItem.agendaItem.id,
            });
          },
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            Alert.alert(
              'Delete Agenda Item',
              'Are you sure you want to delete this scheduled item?',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Delete',
                  style: 'destructive',
                  onPress: async () => {
                    try {
                      const agendaService = getAgendaService();
                      await agendaService.deleteAgendaItem(scheduledItem.agendaItem);
                      await loadWeekData();
                    } catch (error) {
                      console.error('Failed to delete agenda item:', error);
                      Alert.alert('Error', 'Failed to delete agenda item');
                    }
                  },
                },
              ]
            );
          },
        },
        {
          text: 'Cancel',
          style: 'cancel',
        },
      ]
    );
  };

  const handleLoadBoards = async (projectId: string): Promise<Board[]> => {
    try {
      const boardService = getBoardService();
      const project = projects.find(p => p.id === projectId);
      if (!project) return [];

      const boards = await boardService.getBoardsByProject(project.id);
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

  const goToPreviousMonth = () => {
    const prev = new Date(monthAnchor);
    prev.setMonth(prev.getMonth() - 1);
    setMonthAnchor(getMonthStart(prev));
    setSelectedDate(new Date(prev.getFullYear(), prev.getMonth(), 1));
  };

  const goToNextMonth = () => {
    const next = new Date(monthAnchor);
    next.setMonth(next.getMonth() + 1);
    setMonthAnchor(getMonthStart(next));
    setSelectedDate(new Date(next.getFullYear(), next.getMonth(), 1));
  };

  const handleViewModeChange = (mode: 'week' | 'month') => {
    setViewMode(mode);
    if (mode === 'week') {
      setWeekStart(getMonday(selectedDate));
    } else {
      setMonthAnchor(getMonthStart(selectedDate));
    }
  };

  const renderWeekHeader = () => {
    const weekDays = getWeekDays();
    const monthYear = (viewMode === 'month' ? monthAnchor : selectedDate).toLocaleDateString('en-US', {
      month: 'long',
      year: 'numeric',
    });
    const goPrev = viewMode === 'month' ? goToPreviousMonth : goToPreviousWeek;
    const goNext = viewMode === 'month' ? goToNextMonth : goToNextWeek;

    return (
      <View style={styles.calendarHeader}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={goPrev} style={styles.navButton}>
            <AppIcon name="arrow-left" size={16} color={theme.text.secondary} />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <View style={styles.monthRow}>
              <TouchableOpacity onPress={goToToday}>
                <Text style={styles.monthText}>{monthYear}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={goToToday} style={styles.todayButton}>
                <Text style={styles.todayButtonText}>Today</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.viewToggle}>
              <TouchableOpacity
                style={[styles.viewToggleButton, viewMode === 'week' && styles.viewToggleButtonActive]}
                onPress={() => handleViewModeChange('week')}
              >
                <Text style={[styles.viewToggleText, viewMode === 'week' && styles.viewToggleTextActive]}>
                  Week
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.viewToggleButton, viewMode === 'month' && styles.viewToggleButtonActive]}
                onPress={() => handleViewModeChange('month')}
              >
                <Text style={[styles.viewToggleText, viewMode === 'month' && styles.viewToggleTextActive]}>
                  Month
                </Text>
              </TouchableOpacity>
            </View>
          </View>
          <TouchableOpacity onPress={goNext} style={styles.navButton}>
            <AppIcon name="arrow-right" size={16} color={theme.text.secondary} />
          </TouchableOpacity>
        </View>
        {viewMode === 'week' ? (
          <View style={styles.daysRow}>
            {weekDays.map((date, index) => {
              const dateStr = formatDateKey(date);
              const dayAgenda = weekData.get(dateStr);
              const itemCount = dayAgenda?.items.length || 0;
              const hasItems = itemCount > 0;

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
                  {hasItems && (
                    <View style={[styles.dayCount, isSelected(date) && styles.dayCountSelected]}>
                      <Text style={[styles.dayCountText, isSelected(date) && styles.dayCountTextSelected]}>
                        {itemCount > 9 ? '9+' : itemCount}
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        ) : (
          <View style={styles.monthGridContainer}>
            <View style={styles.monthWeekdayRow}>
              {DAYS.map(day => (
                <Text key={day} style={styles.monthWeekdayText}>{day}</Text>
              ))}
            </View>
            {monthLoading ? (
              <View style={styles.monthLoading}>
                <ActivityIndicator size="small" color={theme.accent.primary} />
                <Text style={styles.monthLoadingText}>Loading month...</Text>
              </View>
            ) : (
              <View style={styles.monthGrid}>
                {getMonthGridDays(monthAnchor).map((date, index) => {
                  const dateKey = formatDateKey(date);
                  const dayAgenda = monthData.get(dateKey);
                  const itemCount = dayAgenda?.items.length || 0;
                  const isOutside = date.getMonth() !== monthAnchor.getMonth();

                  return (
                    <TouchableOpacity
                      key={`${dateKey}-${index}`}
                      style={[
                        styles.monthDayCell,
                        isOutside && styles.monthDayCellOutside,
                        isSelected(date) && styles.monthDayCellSelected,
                        isToday(date) && styles.monthDayCellToday,
                      ]}
                      onPress={() => {
                        setSelectedDate(date);
                        if (isOutside) {
                          setMonthAnchor(getMonthStart(date));
                        }
                      }}
                    >
                      <Text style={[
                        styles.monthDayNumber,
                        isOutside && styles.monthDayNumberOutside,
                        isSelected(date) && styles.monthDayNumberSelected,
                      ]}>
                        {date.getDate()}
                      </Text>
                      {itemCount > 0 && (
                        <View style={[
                          styles.monthDayBadge,
                          isSelected(date) && styles.monthDayBadgeSelected,
                        ]}>
                          <Text style={[
                            styles.monthDayBadgeText,
                            isSelected(date) && styles.monthDayBadgeTextSelected,
                          ]}>
                            {itemCount > 9 ? '9+' : itemCount}
                          </Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </View>
        )}
      </View>
    );
  };

  const renderDaySection = (title: string, items: ScheduledAgendaItem[], icon: AppIconName) => {
    if (items.length === 0) return null;

    return (
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionIcon}>
            <AppIcon name={icon} size={16} color={theme.text.secondary} />
          </View>
          <Text style={styles.sectionTitle}>{title}</Text>
          <Text style={styles.sectionCount}>{items.length}</Text>
        </View>
        {items.map(item => (
          <AgendaItemCard
            key={item.agendaItem.id}
            scheduledItem={item}
            onPress={() => handleAgendaItemPress(item)}
            onLongPress={() => handleAgendaItemLongPress(item)}
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
    const itemCount = dayAgenda?.items.length || 0;
    const meetingCount = dayAgenda?.meetings.length || 0;
    const taskCount = dayAgenda?.regularTasks.length || 0;
    const milestoneCount = dayAgenda?.milestones.length || 0;
    const orphanedCount = dayAgenda?.orphanedItems.length || 0;

    if (!dayAgenda || dayAgenda.items.length === 0) {
      return (
        <View style={styles.emptyDay}>
          <AppIcon name="calendar" size={28} color={theme.text.muted} />
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
        <View style={styles.dayHeader}>
          <View style={styles.daySummaryCard}>
            <View style={styles.daySummaryHeader}>
              <View>
                <Text style={styles.dayDateLabel}>{selectedDateStr}</Text>
                <Text style={styles.daySummarySubtitle}>{itemCount} items scheduled</Text>
              </View>
              <TouchableOpacity
                style={styles.inlineScheduleButton}
                onPress={() => setShowFormModal(true)}
              >
                <Text style={styles.inlineScheduleText}>Schedule</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.summaryChips}>
              <View style={[styles.summaryChip, { borderColor: theme.accent.success, backgroundColor: `${theme.accent.success}22` }]}>
                <View style={[styles.summaryDot, { backgroundColor: theme.accent.success }]} />
                <Text style={styles.summaryChipText}>Meetings</Text>
                <Text style={styles.summaryChipCount}>{meetingCount}</Text>
              </View>
              <View style={[styles.summaryChip, { borderColor: theme.accent.primary, backgroundColor: `${theme.accent.primary}22` }]}>
                <View style={[styles.summaryDot, { backgroundColor: theme.accent.primary }]} />
                <Text style={styles.summaryChipText}>Tasks</Text>
                <Text style={styles.summaryChipCount}>{taskCount}</Text>
              </View>
              <View style={[styles.summaryChip, { borderColor: theme.accent.secondary, backgroundColor: `${theme.accent.secondary}22` }]}>
                <View style={[styles.summaryDot, { backgroundColor: theme.accent.secondary }]} />
                <Text style={styles.summaryChipText}>Milestones</Text>
                <Text style={styles.summaryChipCount}>{milestoneCount}</Text>
              </View>
              {orphanedCount > 0 && (
                <View style={[styles.summaryChip, { borderColor: theme.accent.warning, backgroundColor: `${theme.accent.warning}22` }]}>
                  <View style={[styles.summaryDot, { backgroundColor: theme.accent.warning }]} />
                  <Text style={styles.summaryChipText}>Orphaned</Text>
                  <Text style={styles.summaryChipCount}>{orphanedCount}</Text>
                </View>
              )}
            </View>
          </View>
        </View>
        {renderDaySection('Meetings', dayAgenda.meetings, 'users')}
        {renderDaySection('Tasks', dayAgenda.regularTasks, 'task')}
        {renderDaySection('Milestones', dayAgenda.milestones, 'milestone')}
        {dayAgenda.orphanedItems.length > 0 && (
          renderDaySection('Orphaned Items', dayAgenda.orphanedItems, 'alert')
        )}
        <View style={styles.bottomPadding} />
      </ScrollView>
    );
  };

  if (loading) {
    return (
      <Screen hasTabBar>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.accent.primary} />
          <Text style={styles.loadingText}>Loading agenda...</Text>
        </View>
      </Screen>
    );
  }

  return (
    <Screen hasTabBar>
      {renderWeekHeader()}
      {renderDayContent()}

      <TouchableOpacity
        style={[styles.fab, { bottom: fabBottom }]}
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
    </Screen>
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

function getMonthStart(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function getMonthEnd(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

function getMonthGridDays(date: Date): Date[] {
  const start = getMonthStart(date);
  const gridStart = getMonday(start);
  const days: Date[] = [];
  for (let i = 0; i < 42; i++) {
    const day = new Date(gridStart);
    day.setDate(gridStart.getDate() + i);
    days.push(day);
  }
  return days;
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
  calendarHeader: {
    backgroundColor: theme.background.secondary,
    paddingTop: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.border.primary,
  },
  headerRow: {
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
  monthText: {
    color: theme.text.primary,
    fontSize: 18,
    fontWeight: '600',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  monthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  todayButton: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.border.secondary,
    backgroundColor: theme.background.elevated,
  },
  todayButtonText: {
    fontSize: 12,
    color: theme.text.secondary,
    fontWeight: '600',
  },
  viewToggle: {
    flexDirection: 'row',
    backgroundColor: theme.background.elevated,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.border.secondary,
    padding: 2,
  },
  viewToggleButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: 12,
  },
  viewToggleButtonActive: {
    backgroundColor: theme.accent.primary,
  },
  viewToggleText: {
    fontSize: 12,
    color: theme.text.secondary,
    fontWeight: '600',
  },
  viewToggleTextActive: {
    color: theme.background.primary,
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
  dayCount: {
    marginTop: spacing.xs,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    backgroundColor: theme.background.elevated,
    borderWidth: 1,
    borderColor: theme.border.secondary,
  },
  dayCountSelected: {
    backgroundColor: theme.background.primary,
    borderColor: theme.background.primary,
  },
  dayCountText: {
    fontSize: 10,
    color: theme.text.secondary,
    fontWeight: '600',
  },
  dayCountTextSelected: {
    color: theme.text.primary,
  },
  monthGridContainer: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
  monthWeekdayRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingBottom: spacing.xs,
  },
  monthWeekdayText: {
    width: '14.28%',
    textAlign: 'center',
    fontSize: 11,
    color: theme.text.muted,
    fontWeight: '600',
  },
  monthGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  monthDayCell: {
    width: '14.28%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    borderRadius: 12,
    marginVertical: 2,
  },
  monthDayCellOutside: {
    opacity: 0.45,
  },
  monthDayCellSelected: {
    backgroundColor: theme.accent.primary,
  },
  monthDayCellToday: {
    borderWidth: 1,
    borderColor: theme.accent.primary,
  },
  monthDayNumber: {
    color: theme.text.primary,
    fontSize: 14,
    fontWeight: '600',
  },
  monthDayNumberOutside: {
    color: theme.text.muted,
  },
  monthDayNumberSelected: {
    color: theme.background.primary,
  },
  monthDayBadge: {
    marginTop: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    backgroundColor: theme.background.elevated,
    borderWidth: 1,
    borderColor: theme.border.secondary,
  },
  monthDayBadgeSelected: {
    backgroundColor: theme.background.primary,
    borderColor: theme.background.primary,
  },
  monthDayBadgeText: {
    fontSize: 10,
    color: theme.text.secondary,
    fontWeight: '600',
  },
  monthDayBadgeTextSelected: {
    color: theme.text.primary,
  },
  monthLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  monthLoadingText: {
    color: theme.text.secondary,
    fontSize: 12,
  },
  dayContent: {
    flex: 1,
  },
  dayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  daySummaryCard: {
    flex: 1,
    backgroundColor: theme.background.elevated,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.border.secondary,
    padding: spacing.md,
  },
  daySummaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  dayDateLabel: {
    color: theme.text.primary,
    fontSize: 16,
    fontWeight: '600',
  },
  daySummarySubtitle: {
    color: theme.text.tertiary,
    fontSize: 12,
    marginTop: 2,
  },
  inlineScheduleButton: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.border.secondary,
    backgroundColor: theme.background.primary,
  },
  inlineScheduleText: {
    color: theme.text.secondary,
    fontSize: 12,
    fontWeight: '600',
  },
  summaryChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  summaryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    gap: 6,
  },
  summaryDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  summaryChipText: {
    color: theme.text.secondary,
    fontSize: 11,
    fontWeight: '600',
  },
  summaryChipCount: {
    color: theme.text.primary,
    fontSize: 11,
    fontWeight: '700',
  },
  section: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.md,
    backgroundColor: theme.card.background,
    borderRadius: 12,
    marginHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: theme.card.border,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
  },
  sectionIcon: {
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
