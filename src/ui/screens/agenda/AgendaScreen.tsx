import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SectionList,
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
type AgendaSection = { title: string; icon: AppIconName; data: ScheduledAgendaItem[] };

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
  const [lastRefreshTime, setLastRefreshTime] = useState(0);

  const CACHE_FRESHNESS_MS = 30000;
  const fabBottom = uiConstants.TAB_BAR_HEIGHT + uiConstants.TAB_BAR_BOTTOM_MARGIN + insets.bottom + 24;

  const loadWeekData = useCallback(async (priorityDate?: string) => {
    try {
      const agendaService = getAgendaService();
      const weekStartStr = weekStart.toISOString().split('T')[0];

      if (priorityDate) {
        console.log(`[AgendaScreen] Loading priority date: ${priorityDate}`);
        const priorityAgenda = await agendaService.getAgendaForDate(priorityDate);
        setWeekData(prev => new Map(prev).set(priorityDate, priorityAgenda));
        setLoading(false);
      }

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

  const loadSingleDay = useCallback(async (date: string) => {
    try {
      const agendaService = getAgendaService();
      const dayAgenda = await agendaService.getAgendaForDate(date);

      setWeekData(prev => {
        const newMap = new Map(prev);
        newMap.set(date, dayAgenda);
        return newMap;
      });

      if (viewMode === 'month') {
        setMonthData(prev => {
          const newMap = new Map(prev);
          newMap.set(date, dayAgenda);
          return newMap;
        });
      }
    } catch (error) {
      console.error(`Failed to reload day ${date}:`, error);
    }
  }, [viewMode]);

  const refreshAgendaData = useCallback(async () => {
    await loadWeekData();
    if (viewMode === 'month') {
      await loadMonthData();
    }
    setLastRefreshTime(Date.now());
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
    const selectedDateStr = selectedDate.toISOString().split('T')[0];
    loadWeekData(selectedDateStr);
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
      const now = Date.now();
      const cacheAge = now - lastRefreshTime;

      if (cacheAge > CACHE_FRESHNESS_MS) {
        refreshAgendaData();
      }
    }, [refreshAgendaData, lastRefreshTime, CACHE_FRESHNESS_MS])
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

  const weekDays = useMemo((): Date[] => {
    const days: Date[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(weekStart);
      d.setDate(d.getDate() + i);
      days.push(d);
    }
    return days;
  }, [weekStart]);

  const monthGridDays = useMemo((): Date[] => {
    const start = getMonthStart(monthAnchor);
    const gridStart = getMonday(start);
    const days: Date[] = [];
    for (let i = 0; i < 42; i++) {
      const day = new Date(gridStart);
      day.setDate(gridStart.getDate() + i);
      days.push(day);
    }
    return days;
  }, [monthAnchor]);

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

  const handleAgendaItemPress = useCallback((scheduledItem: ScheduledAgendaItem) => {
    navigation.navigate('AgendaItemDetail', {
      agendaItemId: scheduledItem.agendaItem.id,
    });
  }, [navigation]);

  const handleAgendaItemLongPress = useCallback((scheduledItem: ScheduledAgendaItem) => {
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
                      const itemDate = scheduledItem.agendaItem.scheduled_date;
                      await agendaService.deleteAgendaItem(scheduledItem.agendaItem);
                      await loadSingleDay(itemDate);
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
  }, [navigation, handleAgendaItemPress, loadSingleDay]);

  const handleToggleComplete = useCallback(async (scheduledItem: ScheduledAgendaItem) => {
    try {
      const agendaService = getAgendaService();
      const agendaItem = scheduledItem.agendaItem;
      if (agendaItem.completed_at) {
        agendaItem.markIncomplete();
      } else {
        agendaItem.markComplete();
      }
      await agendaService.updateAgendaItem(agendaItem);
      await loadSingleDay(agendaItem.scheduled_date);
    } catch (error) {
      console.error('Failed to update agenda item status:', error);
      Alert.alert('Error', 'Failed to update agenda item status');
    }
  }, [loadSingleDay]);

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

  const handleViewModeToggle = () => {
    const nextMode = viewMode === 'week' ? 'month' : 'week';
    setViewMode(nextMode);
    if (nextMode === 'week') {
      setWeekStart(getMonday(selectedDate));
    } else {
      setMonthAnchor(getMonthStart(selectedDate));
    }
  };

  const renderWeekHeader = () => {
    const monthYear = (viewMode === 'month' ? monthAnchor : selectedDate).toLocaleDateString('en-US', {
      month: 'long',
      year: 'numeric',
    });
    const goPrev = viewMode === 'month' ? goToPreviousMonth : goToPreviousWeek;
    const goNext = viewMode === 'month' ? goToNextMonth : goToNextWeek;

    return (
      <View style={styles.calendarCard}>
        <View style={styles.calendarTopRow}>
          <TouchableOpacity onPress={goPrev} style={styles.navButton}>
            <AppIcon name="arrow-left" size={16} color={theme.text.secondary} />
          </TouchableOpacity>
          <TouchableOpacity onPress={goToToday} style={styles.monthButton}>
            <Text style={styles.monthText}>{monthYear}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={goNext} style={styles.navButton}>
            <AppIcon name="arrow-right" size={16} color={theme.text.secondary} />
          </TouchableOpacity>
        </View>
        <View style={styles.calendarControls}>
          <TouchableOpacity onPress={handleViewModeToggle} style={styles.viewToggleButton}>
            <AppIcon name="calendar" size={14} color={theme.text.secondary} />
            <Text style={styles.viewToggleText}>
              {viewMode === 'week' ? 'Week view' : 'Month view'}
            </Text>
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
                {monthGridDays.map((date, index) => {
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

  const renderAgendaItem = useCallback(({ item }: { item: ScheduledAgendaItem }) => (
    <AgendaItemCard
      scheduledItem={item}
      onPress={() => handleAgendaItemPress(item)}
      onLongPress={() => handleAgendaItemLongPress(item)}
      onToggleComplete={() => handleToggleComplete(item)}
    />
  ), [handleAgendaItemPress, handleAgendaItemLongPress, handleToggleComplete]);

  const renderSectionHeader = useCallback(({ section }: { section: AgendaSection }) => (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionTitleRow}>
        <View style={styles.sectionIcon}>
          <AppIcon name={section.icon} size={14} color={theme.text.secondary} />
        </View>
        <Text style={styles.sectionTitle}>{section.title}</Text>
        <View style={styles.sectionCountPill}>
          <Text style={styles.sectionCountText}>{section.data.length}</Text>
        </View>
      </View>
    </View>
  ), []);

  const renderDayContent = () => {
    const dayAgenda = getSelectedDayAgenda();
    const selectedDateStr = selectedDate.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    });
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

    const sections: AgendaSection[] = [
      { title: 'Meetings', icon: 'users', data: dayAgenda.meetings },
      { title: 'Tasks', icon: 'task', data: dayAgenda.regularTasks },
      { title: 'Milestones', icon: 'milestone', data: dayAgenda.milestones },
      { title: 'Orphaned Items', icon: 'alert', data: dayAgenda.orphanedItems },
    ].filter(section => section.data.length > 0);

    return (
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.agendaItem.id}
        renderItem={renderAgendaItem}
        renderSectionHeader={renderSectionHeader}
        initialNumToRender={10}
        maxToRenderPerBatch={10}
        windowSize={5}
        removeClippedSubviews={true}
        ListHeaderComponent={(
          <View style={styles.dayHeader}>
            <View style={styles.dayHeaderRow}>
            </View>
          </View>
        )}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.accent.primary}
          />
        }
        contentContainerStyle={styles.dayListContent}
        stickySectionHeadersEnabled={false}
        showsVerticalScrollIndicator={false}
      />
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
  calendarCard: {
    backgroundColor: theme.background.secondary,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: theme.border.primary,
    paddingVertical: spacing.sm,
  },
  calendarTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
  },
  navButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  monthButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: theme.background.elevated,
    borderWidth: 1,
    borderColor: theme.border.secondary,
  },
  monthText: {
    color: theme.text.primary,
    fontSize: 16,
    fontWeight: '700',
  },
  calendarControls: {
    alignItems: 'flex-end',
    paddingHorizontal: spacing.md,
    marginTop: spacing.sm,
  },
  viewToggleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.border.secondary,
    backgroundColor: theme.background.elevated,
  },
  viewToggleText: {
    fontSize: 12,
    color: theme.text.secondary,
    fontWeight: '600',
  },
  daysRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.sm,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
  },
  dayCell: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius: 14,
    minWidth: 44,
    backgroundColor: theme.background.elevated,
    borderWidth: 1,
    borderColor: theme.border.secondary,
  },
  dayCellSelected: {
    backgroundColor: theme.accent.primary,
    borderColor: theme.accent.primary,
  },
  dayCellToday: {
    borderColor: theme.accent.primary,
  },
  dayName: {
    color: theme.text.secondary,
    fontSize: 11,
    fontWeight: '600',
    marginBottom: spacing.xs,
    textTransform: 'uppercase',
  },
  dayNameSelected: {
    color: theme.background.primary,
  },
  dayNumber: {
    color: theme.text.primary,
    fontSize: 16,
    fontWeight: '700',
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
    backgroundColor: theme.background.primary,
  },
  dayCountSelected: {
    backgroundColor: theme.background.primary,
  },
  dayCountText: {
    fontSize: 10,
    color: theme.text.secondary,
    fontWeight: '700',
  },
  dayCountTextSelected: {
    color: theme.text.primary,
  },
  monthGridContainer: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    paddingTop: spacing.sm,
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
    opacity: 0.4,
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
    fontSize: 13,
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
  dayListContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  dayHeader: {
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
  },
  dayHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  sectionHeader: {
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  sectionIcon: {
    width: 22,
    height: 22,
    borderRadius: 8,
    backgroundColor: theme.background.elevated,
    borderWidth: 1,
    borderColor: theme.border.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: {
    color: theme.text.secondary,
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
  sectionCountPill: {
    backgroundColor: theme.background.elevated,
    borderWidth: 1,
    borderColor: theme.border.secondary,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: 12,
  },
  sectionCountText: {
    color: theme.text.muted,
    fontSize: 12,
    fontWeight: '600',
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
