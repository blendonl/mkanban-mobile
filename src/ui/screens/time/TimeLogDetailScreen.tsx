import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
} from 'react-native';
import { RouteProp, useRoute } from '@react-navigation/native';
import theme from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { getTimeTrackingService } from '../../../core/DependencyContainer';
import { TimeLog, TimeEntry, TimeSource } from '../../../domain/entities/TimeLog';
import { TimeStackParamList } from '../../navigation/TabNavigator';

type TimeLogDetailRouteProp = RouteProp<TimeStackParamList, 'TimeLogDetail'>;

const SOURCE_ICONS: Record<TimeSource, string> = {
  manual: '✍️',
  git: '📦',
  tmux: '💻',
  calendar: '📅',
};

const SOURCE_LABELS: Record<TimeSource, string> = {
  manual: 'Manual',
  git: 'Git Commits',
  tmux: 'Terminal Sessions',
  calendar: 'Calendar Events',
};

const SOURCE_COLORS: Record<TimeSource, string> = {
  manual: theme.accent.primary,
  git: theme.accent.success,
  tmux: theme.accent.warning,
  calendar: theme.accent.info,
};

interface DayData {
  date: string;
  totalMinutes: number;
  entries: TimeEntry[];
  bySource: Record<TimeSource, number>;
  byProject: Record<string, { minutes: number; entries: TimeEntry[] }>;
}

export default function TimeLogDetailScreen() {
  const route = useRoute<TimeLogDetailRouteProp>();
  const { date } = route.params;

  const [dayData, setDayData] = useState<DayData | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    try {
      const timeService = getTimeTrackingService();
      const allLogs = await timeService.getAllTimeLogs();
      const dayLogs = allLogs.filter(log => log.date === date);

      let totalMinutes = 0;
      const allEntries: TimeEntry[] = [];
      const bySource: Record<TimeSource, number> = { manual: 0, git: 0, tmux: 0, calendar: 0 };
      const byProject: Record<string, { minutes: number; entries: TimeEntry[] }> = {};

      for (const log of dayLogs) {
        totalMinutes += log.total_minutes;
        allEntries.push(...log.entries);

        const breakdown = log.getSourceBreakdown();
        for (const [source, minutes] of Object.entries(breakdown)) {
          bySource[source as TimeSource] += minutes;
        }

        if (!byProject[log.project_id]) {
          byProject[log.project_id] = { minutes: 0, entries: [] };
        }
        byProject[log.project_id].minutes += log.total_minutes;
        byProject[log.project_id].entries.push(...log.entries);
      }

      allEntries.sort((a, b) => {
        if (a.start_time && b.start_time) {
          return a.start_time.localeCompare(b.start_time);
        }
        return 0;
      });

      setDayData({
        date,
        totalMinutes,
        entries: allEntries,
        bySource,
        byProject,
      });
    } catch (error) {
      console.error('Failed to load time data:', error);
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  const formatDuration = (minutes: number): string => {
    if (minutes === 0) return '0m';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours === 0) return `${mins}m`;
    if (mins === 0) return `${hours}h`;
    return `${hours}h ${mins}m`;
  };

  const formatTime = (time: string): string => {
    if (!time) return '';
    const [hours, minutes] = time.split(':');
    const h = parseInt(hours, 10);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 || 12;
    return `${h12}:${minutes} ${ampm}`;
  };

  const formatDate = (dateStr: string): string => {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const renderSourceBreakdown = () => {
    if (!dayData) return null;

    const totalMinutes = dayData.totalMinutes;
    if (totalMinutes === 0) return null;

    const sources = Object.entries(dayData.bySource)
      .filter(([_, minutes]) => minutes > 0)
      .sort(([, a], [, b]) => b - a);

    if (sources.length === 0) return null;

    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Time by Source</Text>
        <View style={styles.card}>
          {sources.map(([source, minutes]) => {
            const percentage = Math.round((minutes / totalMinutes) * 100);
            const typedSource = source as TimeSource;

            return (
              <View key={source} style={styles.sourceRow}>
                <View style={styles.sourceInfo}>
                  <Text style={styles.sourceIcon}>{SOURCE_ICONS[typedSource]}</Text>
                  <Text style={styles.sourceLabel}>{SOURCE_LABELS[typedSource]}</Text>
                </View>
                <View style={styles.sourceBarContainer}>
                  <View
                    style={[
                      styles.sourceBar,
                      {
                        width: `${percentage}%`,
                        backgroundColor: SOURCE_COLORS[typedSource],
                      },
                    ]}
                  />
                </View>
                <Text style={styles.sourceValue}>{formatDuration(minutes)}</Text>
              </View>
            );
          })}
        </View>
      </View>
    );
  };

  const renderProjectBreakdown = () => {
    if (!dayData) return null;

    const projects = Object.entries(dayData.byProject)
      .filter(([_, data]) => data.minutes > 0)
      .sort(([, a], [, b]) => b.minutes - a.minutes);

    if (projects.length === 0) return null;

    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Time by Project</Text>
        <View style={styles.card}>
          {projects.map(([projectId, data]) => (
            <View key={projectId} style={styles.projectRow}>
              <Text style={styles.projectName}>{projectId}</Text>
              <Text style={styles.projectValue}>{formatDuration(data.minutes)}</Text>
            </View>
          ))}
        </View>
      </View>
    );
  };

  const renderEntries = () => {
    if (!dayData || dayData.entries.length === 0) return null;

    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          All Entries ({dayData.entries.length})
        </Text>
        <View style={styles.card}>
          {dayData.entries.map((entry, index) => {
            const typedSource = entry.source as TimeSource;

            return (
              <View
                key={entry.id || index}
                style={[
                  styles.entryRow,
                  index < dayData.entries.length - 1 && styles.entryRowBorder,
                ]}
              >
                <View style={styles.entryHeader}>
                  <View style={styles.entrySourceInfo}>
                    <Text style={styles.entrySourceIcon}>
                      {SOURCE_ICONS[typedSource]}
                    </Text>
                    <Text style={styles.entrySource}>
                      {SOURCE_LABELS[typedSource]}
                    </Text>
                  </View>
                  <Text style={styles.entryDuration}>
                    {formatDuration(entry.duration_minutes)}
                  </Text>
                </View>

                {entry.start_time && (
                  <Text style={styles.entryTime}>
                    {formatTime(entry.start_time)}
                    {entry.end_time && ` - ${formatTime(entry.end_time)}`}
                  </Text>
                )}

                {entry.description && (
                  <Text style={styles.entryDescription} numberOfLines={2}>
                    {entry.description}
                  </Text>
                )}

                {entry.task_id && (
                  <View style={styles.entryTaskBadge}>
                    <Text style={styles.entryTaskText}>{entry.task_id}</Text>
                  </View>
                )}
              </View>
            );
          })}
        </View>
      </View>
    );
  };

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyIcon}>📭</Text>
      <Text style={styles.emptyTitle}>No Time Logged</Text>
      <Text style={styles.emptyText}>
        No time entries were recorded for this date.
      </Text>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.container}>
        <Text style={styles.loadingText}>Loading time data...</Text>
      </View>
    );
  }

  const hasData = dayData && dayData.totalMinutes > 0;

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
        <Text style={styles.dateText}>{formatDate(date)}</Text>
        {dayData && (
          <Text style={styles.totalTime}>
            {formatDuration(dayData.totalMinutes)}
          </Text>
        )}
      </View>

      {hasData ? (
        <>
          {renderSourceBreakdown()}
          {renderProjectBreakdown()}
          {renderEntries()}
          <View style={styles.bottomPadding} />
        </>
      ) : (
        renderEmpty()
      )}
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
  header: {
    padding: spacing.lg,
    backgroundColor: theme.card.background,
    borderBottomWidth: 1,
    borderBottomColor: theme.border.primary,
    alignItems: 'center',
  },
  dateText: {
    color: theme.text.secondary,
    fontSize: 14,
    marginBottom: spacing.xs,
  },
  totalTime: {
    color: theme.text.primary,
    fontSize: 36,
    fontWeight: '700',
  },
  section: {
    padding: spacing.md,
  },
  sectionTitle: {
    color: theme.text.secondary,
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.md,
  },
  card: {
    backgroundColor: theme.card.background,
    borderRadius: 12,
    padding: spacing.md,
  },
  sourceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  sourceInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    width: 130,
  },
  sourceIcon: {
    fontSize: 16,
    marginRight: spacing.sm,
  },
  sourceLabel: {
    color: theme.text.primary,
    fontSize: 14,
  },
  sourceBarContainer: {
    flex: 1,
    height: 8,
    backgroundColor: theme.background.elevated,
    borderRadius: 4,
    marginHorizontal: spacing.sm,
  },
  sourceBar: {
    height: '100%',
    borderRadius: 4,
  },
  sourceValue: {
    color: theme.text.secondary,
    fontSize: 13,
    width: 50,
    textAlign: 'right',
  },
  projectRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.border.primary,
  },
  projectName: {
    color: theme.text.primary,
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
  },
  projectValue: {
    color: theme.text.secondary,
    fontSize: 14,
  },
  entryRow: {
    paddingVertical: spacing.md,
  },
  entryRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: theme.border.primary,
  },
  entryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  entrySourceInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  entrySourceIcon: {
    fontSize: 14,
    marginRight: spacing.xs,
  },
  entrySource: {
    color: theme.text.primary,
    fontSize: 14,
    fontWeight: '500',
  },
  entryDuration: {
    color: theme.accent.primary,
    fontSize: 14,
    fontWeight: '600',
  },
  entryTime: {
    color: theme.text.muted,
    fontSize: 12,
    marginBottom: spacing.xs,
  },
  entryDescription: {
    color: theme.text.secondary,
    fontSize: 13,
    marginTop: spacing.xs,
  },
  entryTaskBadge: {
    backgroundColor: theme.background.elevated,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: 4,
    alignSelf: 'flex-start',
    marginTop: spacing.xs,
  },
  entryTaskText: {
    color: theme.text.muted,
    fontSize: 11,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
    paddingTop: spacing.xxxl,
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
  },
  bottomPadding: {
    height: spacing.xxl,
  },
});
