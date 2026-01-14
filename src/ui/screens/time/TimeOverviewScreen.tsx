import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { Screen } from '../../components/Screen';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import theme from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { getTimeTrackingService } from '../../../core/DependencyContainer';
import { DailySummary } from '../../../domain/entities/TimeLog';
import { OverallTimeSummary, TimeSource } from '../../../services/TimeTrackingService';
import { TimeStackParamList } from '../../navigation/TabNavigator';

type TimeOverviewNavProp = StackNavigationProp<TimeStackParamList, 'TimeOverview'>;

const SOURCE_ICONS: Record<TimeSource, string> = {
  manual: '✍️',
  git: '📦',
  tmux: '💻',
  calendar: '📅',
};

const SOURCE_LABELS: Record<TimeSource, string> = {
  manual: 'Manual',
  git: 'Git',
  tmux: 'Terminal',
  calendar: 'Calendar',
};

const SOURCE_COLORS: Record<TimeSource, string> = {
  manual: theme.accent.primary,
  git: theme.accent.success,
  tmux: theme.accent.warning,
  calendar: theme.accent.info,
};

export default function TimeOverviewScreen() {
  const navigation = useNavigation<TimeOverviewNavProp>();
  const [summary, setSummary] = useState<OverallTimeSummary | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    try {
      const timeService = getTimeTrackingService();
      const overallSummary = await timeService.getOverallTimeSummary();
      setSummary(overallSummary);
    } catch (error) {
      console.error('Failed to load time data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

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

  const formatHours = (minutes: number): string => {
    return (minutes / 60).toFixed(1) + 'h';
  };

  const getMaxMinutes = (days: DailySummary[]): number => {
    return Math.max(...days.map(d => d.total_minutes), 60);
  };

  const renderSummaryCards = () => {
    if (!summary) return null;

    return (
      <View style={styles.summaryCards}>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Today</Text>
          <Text style={styles.summaryValue}>{formatDuration(summary.todayMinutes)}</Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>This Week</Text>
          <Text style={styles.summaryValue}>{formatDuration(summary.thisWeekMinutes)}</Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>This Month</Text>
          <Text style={styles.summaryValue}>{formatDuration(summary.thisMonthMinutes)}</Text>
        </View>
      </View>
    );
  };

  const renderWeekChart = () => {
    if (!summary || summary.recentDays.length === 0) return null;

    const days = [...summary.recentDays].reverse();
    const maxMinutes = getMaxMinutes(days);

    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Last 7 Days</Text>
        <View style={styles.chartContainer}>
          {days.map((day, index) => {
            const barHeight = maxMinutes > 0
              ? (day.total_minutes / maxMinutes) * 100
              : 0;
            const date = new Date(day.date);
            const dayLabel = date.toLocaleDateString('en-US', { weekday: 'short' });
            const isToday = day.date === new Date().toISOString().split('T')[0];

            return (
              <TouchableOpacity
                key={day.date}
                style={styles.barColumn}
                onPress={() => navigation.navigate('TimeLogDetail', { date: day.date })}
              >
                <View style={styles.barWrapper}>
                  <View
                    style={[
                      styles.bar,
                      { height: `${Math.max(barHeight, 2)}%` },
                      isToday && styles.barToday,
                    ]}
                  />
                </View>
                <Text style={[styles.barLabel, isToday && styles.barLabelToday]}>
                  {dayLabel}
                </Text>
                <Text style={styles.barValue}>
                  {day.total_minutes > 0 ? formatHours(day.total_minutes) : '-'}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    );
  };

  const renderSourceBreakdown = () => {
    if (!summary) return null;

    const totalMinutes = Object.values(summary.bySource).reduce((a, b) => a + b, 0);
    if (totalMinutes === 0) return null;

    const sources = Object.entries(summary.bySource)
      .filter(([_, minutes]) => minutes > 0)
      .sort(([, a], [, b]) => b - a);

    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Time by Source</Text>
        <View style={styles.sourceList}>
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
    if (!summary) return null;

    const projects = Object.entries(summary.byProject)
      .filter(([_, minutes]) => minutes > 0)
      .sort(([, a], [, b]) => b - a);

    if (projects.length === 0) return null;

    const totalMinutes = projects.reduce((sum, [, mins]) => sum + mins, 0);

    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Time by Project</Text>
        <View style={styles.projectList}>
          {projects.map(([projectId, minutes]) => {
            const percentage = Math.round((minutes / totalMinutes) * 100);

            return (
              <View key={projectId} style={styles.projectRow}>
                <View style={styles.projectInfo}>
                  <Text style={styles.projectName}>{projectId}</Text>
                  <Text style={styles.projectPercentage}>{percentage}%</Text>
                </View>
                <View style={styles.projectBarContainer}>
                  <View
                    style={[
                      styles.projectBar,
                      { width: `${percentage}%` },
                    ]}
                  />
                </View>
                <Text style={styles.projectValue}>{formatDuration(minutes)}</Text>
              </View>
            );
          })}
        </View>
      </View>
    );
  };

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyIcon}>⏱️</Text>
      <Text style={styles.emptyTitle}>No Time Data Yet</Text>
      <Text style={styles.emptyText}>
        Time logs from the desktop daemon will appear here once synced via Syncthing.
      </Text>
      <View style={styles.infoBox}>
        <Text style={styles.infoTitle}>How it works</Text>
        <Text style={styles.infoText}>
          • Git commits are automatically tracked{'\n'}
          • Terminal sessions are logged{'\n'}
          • Calendar events sync from Google{'\n'}
          • Data syncs via Syncthing
        </Text>
      </View>
    </View>
  );

  if (loading) {
    return (
      <Screen hasTabBar>
        <Text style={styles.loadingText}>Loading time data...</Text>
      </Screen>
    );
  }

  const hasData = summary && (
    summary.todayMinutes > 0 ||
    summary.thisWeekMinutes > 0 ||
    summary.thisMonthMinutes > 0
  );

  return (
    <Screen hasTabBar>
      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.accent.primary}
          />
        }
        contentContainerStyle={styles.scrollContent}
      >
        {hasData ? (
          <>
            {renderSummaryCards()}
            {renderWeekChart()}
            {renderSourceBreakdown()}
            {renderProjectBreakdown()}
            <View style={styles.bottomPadding} />
          </>
        ) : (
          renderEmpty()
        )}
      </ScrollView>
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
  scrollContent: {
    paddingBottom: 100,
  },
  loadingText: {
    color: theme.text.secondary,
    textAlign: 'center',
    marginTop: spacing.xl,
  },
  summaryCards: {
    flexDirection: 'row',
    padding: spacing.md,
    gap: spacing.sm,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: theme.glass.tint.neutral,
    borderRadius: 12,
    padding: spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.glass.border,
  },
  summaryLabel: {
    color: theme.text.secondary,
    fontSize: 12,
    fontWeight: '500',
    marginBottom: spacing.xs,
  },
  summaryValue: {
    color: theme.text.primary,
    fontSize: 20,
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
  chartContainer: {
    flexDirection: 'row',
    backgroundColor: theme.glass.tint.neutral,
    borderRadius: 12,
    padding: spacing.md,
    height: 180,
    borderWidth: 1,
    borderColor: theme.glass.border,
  },
  barColumn: {
    flex: 1,
    alignItems: 'center',
  },
  barWrapper: {
    flex: 1,
    width: '100%',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingHorizontal: spacing.xs,
  },
  bar: {
    width: '60%',
    backgroundColor: theme.accent.primary,
    borderRadius: 4,
    minHeight: 4,
  },
  barToday: {
    backgroundColor: theme.accent.success,
  },
  barLabel: {
    color: theme.text.muted,
    fontSize: 11,
    marginTop: spacing.xs,
  },
  barLabelToday: {
    color: theme.accent.success,
    fontWeight: '600',
  },
  barValue: {
    color: theme.text.secondary,
    fontSize: 10,
    marginTop: 2,
  },
  sourceList: {
    backgroundColor: theme.glass.tint.neutral,
    borderRadius: 12,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: theme.glass.border,
  },
  sourceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  sourceInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    width: 90,
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
  projectList: {
    backgroundColor: theme.glass.tint.neutral,
    borderRadius: 12,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: theme.glass.border,
  },
  projectRow: {
    marginBottom: spacing.md,
  },
  projectInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  projectName: {
    color: theme.text.primary,
    fontSize: 14,
    fontWeight: '500',
  },
  projectPercentage: {
    color: theme.text.muted,
    fontSize: 12,
  },
  projectBarContainer: {
    height: 6,
    backgroundColor: theme.background.elevated,
    borderRadius: 3,
    marginBottom: spacing.xs,
  },
  projectBar: {
    height: '100%',
    backgroundColor: theme.accent.primary,
    borderRadius: 3,
  },
  projectValue: {
    color: theme.text.secondary,
    fontSize: 12,
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
    marginBottom: spacing.lg,
  },
  infoBox: {
    backgroundColor: theme.card.background,
    borderRadius: 12,
    padding: spacing.lg,
    width: '100%',
  },
  infoTitle: {
    color: theme.text.primary,
    fontSize: 14,
    fontWeight: '600',
    marginBottom: spacing.sm,
  },
  infoText: {
    color: theme.text.secondary,
    fontSize: 13,
    lineHeight: 22,
  },
  bottomPadding: {
    height: 20,
  },
});
