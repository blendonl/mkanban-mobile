import { TimeLog, WeeklySummary, MonthlySummary, TimeSource, DailySummary } from '../domain/entities/TimeLog';
import { TimeLogRepository } from '../domain/repositories/TimeLogRepository';
import { ProjectId } from '../core/types';

export interface ProjectTimeSummary {
  projectId: ProjectId;
  totalMinutes: number;
  thisWeekMinutes: number;
  thisMonthMinutes: number;
  averageDailyMinutes: number;
  bySource: Record<TimeSource, number>;
}

export interface OverallTimeSummary {
  todayMinutes: number;
  thisWeekMinutes: number;
  thisMonthMinutes: number;
  byProject: Record<string, number>;
  bySource: Record<TimeSource, number>;
  recentDays: DailySummary[];
}

export class TimeTrackingService {
  constructor(private repository: TimeLogRepository) {}

  async getAllTimeLogs(): Promise<TimeLog[]> {
    return this.repository.loadAllTimeLogs();
  }

  async getTimeLogsForProject(projectId: ProjectId): Promise<TimeLog[]> {
    return this.repository.loadTimeLogsForProject(projectId);
  }

  async getTimeLogForDate(projectId: ProjectId, date: string): Promise<TimeLog | null> {
    return this.repository.loadTimeLogForDate(projectId, date);
  }

  async getTimeLogsForDateRange(
    projectId: ProjectId,
    startDate: string,
    endDate: string
  ): Promise<TimeLog[]> {
    return this.repository.loadTimeLogsForDateRange(projectId, startDate, endDate);
  }

  async getWeeklySummary(projectId: ProjectId, weekStartDate?: string): Promise<WeeklySummary> {
    const start = weekStartDate || this.getMonday(new Date());
    return this.repository.getWeeklySummary(projectId, start);
  }

  async getMonthlySummary(projectId: ProjectId, yearMonth?: string): Promise<MonthlySummary> {
    const month = yearMonth || this.getCurrentYearMonth();
    return this.repository.getMonthlySummary(projectId, month);
  }

  async getProjectTimeSummary(projectId: ProjectId): Promise<ProjectTimeSummary> {
    const today = new Date().toISOString().split('T')[0];
    const weekStart = this.getMonday(new Date());
    const monthStart = today.slice(0, 7);

    const [allLogs, weeklySummary, monthlySummary] = await Promise.all([
      this.repository.loadTimeLogsForProject(projectId),
      this.repository.getWeeklySummary(projectId, weekStart),
      this.repository.getMonthlySummary(projectId, monthStart),
    ]);

    const totalMinutes = allLogs.reduce((sum, log) => sum + log.total_minutes, 0);
    const daysWithActivity = allLogs.filter(log => log.total_minutes > 0).length;

    const bySource: Record<TimeSource, number> = { manual: 0, git: 0, tmux: 0, calendar: 0 };
    for (const log of allLogs) {
      const breakdown = log.getSourceBreakdown();
      for (const [source, minutes] of Object.entries(breakdown)) {
        bySource[source as TimeSource] += minutes;
      }
    }

    return {
      projectId,
      totalMinutes,
      thisWeekMinutes: weeklySummary.total_minutes,
      thisMonthMinutes: monthlySummary.total_minutes,
      averageDailyMinutes: daysWithActivity > 0 ? Math.round(totalMinutes / daysWithActivity) : 0,
      bySource,
    };
  }

  async getOverallTimeSummary(): Promise<OverallTimeSummary> {
    const today = new Date().toISOString().split('T')[0];
    const weekStart = this.getMonday(new Date());
    const monthStart = today.slice(0, 7) + '-01';

    const allLogs = await this.repository.loadAllTimeLogs();

    let todayMinutes = 0;
    let thisWeekMinutes = 0;
    let thisMonthMinutes = 0;
    const byProject: Record<string, number> = {};
    const bySource: Record<TimeSource, number> = { manual: 0, git: 0, tmux: 0, calendar: 0 };
    const recentDays: DailySummary[] = [];

    const recentDates = this.getRecentDates(7);
    const dailyMap = new Map<string, DailySummary>();

    for (const log of allLogs) {
      byProject[log.project_id] = (byProject[log.project_id] || 0) + log.total_minutes;

      const breakdown = log.getSourceBreakdown();
      for (const [source, minutes] of Object.entries(breakdown)) {
        bySource[source as TimeSource] += minutes;
      }

      if (log.date === today) {
        todayMinutes += log.total_minutes;
      }

      if (log.date >= weekStart) {
        thisWeekMinutes += log.total_minutes;
      }

      if (log.date >= monthStart) {
        thisMonthMinutes += log.total_minutes;
      }

      if (recentDates.includes(log.date)) {
        const existing = dailyMap.get(log.date);
        if (existing) {
          existing.total_minutes += log.total_minutes;
          existing.entry_count += log.entries.length;
          for (const [source, mins] of Object.entries(log.getSourceBreakdown())) {
            existing.by_source[source as TimeSource] += mins;
          }
        } else {
          dailyMap.set(log.date, log.getDailySummary());
        }
      }
    }

    for (const date of recentDates) {
      const summary = dailyMap.get(date) || {
        date,
        total_minutes: 0,
        by_source: { manual: 0, git: 0, tmux: 0, calendar: 0 },
        by_task: {},
        entry_count: 0,
      };
      recentDays.push(summary);
    }

    return {
      todayMinutes,
      thisWeekMinutes,
      thisMonthMinutes,
      byProject,
      bySource,
      recentDays,
    };
  }

  async getTodaysSummary(): Promise<DailySummary> {
    const today = new Date().toISOString().split('T')[0];
    const allLogs = await this.repository.loadAllTimeLogs();
    const todayLogs = allLogs.filter(log => log.date === today);

    const summary: DailySummary = {
      date: today,
      total_minutes: 0,
      by_source: { manual: 0, git: 0, tmux: 0, calendar: 0 },
      by_task: {},
      entry_count: 0,
    };

    for (const log of todayLogs) {
      summary.total_minutes += log.total_minutes;
      summary.entry_count += log.entries.length;

      const breakdown = log.getSourceBreakdown();
      for (const [source, minutes] of Object.entries(breakdown)) {
        summary.by_source[source as TimeSource] += minutes;
      }

      for (const entry of log.entries) {
        if (entry.task_id) {
          summary.by_task[entry.task_id] = (summary.by_task[entry.task_id] || 0) + entry.duration_minutes;
        }
      }
    }

    return summary;
  }

  async getTimeBySource(): Promise<Record<TimeSource, number>> {
    const allLogs = await this.repository.loadAllTimeLogs();
    const bySource: Record<TimeSource, number> = { manual: 0, git: 0, tmux: 0, calendar: 0 };

    for (const log of allLogs) {
      const breakdown = log.getSourceBreakdown();
      for (const [source, minutes] of Object.entries(breakdown)) {
        bySource[source as TimeSource] += minutes;
      }
    }

    return bySource;
  }

  private getMonday(date: Date): string {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    d.setDate(diff);
    return d.toISOString().split('T')[0];
  }

  private getCurrentYearMonth(): string {
    return new Date().toISOString().slice(0, 7);
  }

  private getRecentDates(days: number): string[] {
    const dates: string[] = [];
    const today = new Date();

    for (let i = 0; i < days; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      dates.push(d.toISOString().split('T')[0]);
    }

    return dates;
  }
}
