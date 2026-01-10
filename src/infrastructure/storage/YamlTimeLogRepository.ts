import * as yaml from 'js-yaml';
import { FileSystemManager } from './FileSystemManager';
import { TimeLogRepository } from '../../domain/repositories/TimeLogRepository';
import { TimeLog, TimeEntry, WeeklySummary, MonthlySummary, TimeSource } from '../../domain/entities/TimeLog';
import { ProjectId } from '../../core/types';

export class YamlTimeLogRepository implements TimeLogRepository {
  constructor(private fileSystem: FileSystemManager) {}

  async loadAllTimeLogs(): Promise<TimeLog[]> {
    const logs: TimeLog[] = [];

    const projectSlugs = await this.fileSystem.listProjects();
    for (const slug of projectSlugs) {
      const projectLogs = await this.loadTimeLogsForProject(slug);
      logs.push(...projectLogs);
    }

    return logs.sort((a, b) => b.date.localeCompare(a.date));
  }

  async loadTimeLogsForProject(projectId: ProjectId): Promise<TimeLog[]> {
    const logs: TimeLog[] = [];
    const timeDir = this.fileSystem.getProjectTimeDirectory(projectId);

    try {
      const exists = await this.fileSystem.directoryExists(timeDir);
      if (!exists) return logs;

      const files = await this.fileSystem.listFiles(timeDir, '*.yml');

      for (const filePath of files) {
        try {
          const monthLogs = await this.loadTimeLogsFromFile(filePath, projectId);
          logs.push(...monthLogs);
        } catch (error) {
          console.warn(`Failed to load time logs from ${filePath}:`, error);
        }
      }
    } catch (error) {
      console.warn(`Failed to list time logs for project ${projectId}:`, error);
    }

    return logs.sort((a, b) => b.date.localeCompare(a.date));
  }

  private async loadTimeLogsFromFile(filePath: string, projectId: ProjectId): Promise<TimeLog[]> {
    const logs: TimeLog[] = [];

    try {
      const content = await this.fileSystem.readFile(filePath);
      const data = yaml.load(content) as Record<string, any>;

      if (!data || typeof data !== 'object') return logs;

      for (const [date, dayData] of Object.entries(data)) {
        if (!this.isValidDate(date)) continue;

        const entries = this.parseEntries(dayData);
        const log = new TimeLog({
          project_id: projectId,
          date,
          entries,
          file_path: filePath,
        });

        logs.push(log);
      }
    } catch (error) {
      console.error(`Failed to parse time log file ${filePath}:`, error);
    }

    return logs;
  }

  private parseEntries(dayData: any): TimeEntry[] {
    const entries: TimeEntry[] = [];

    if (!dayData) return entries;

    if (Array.isArray(dayData)) {
      for (const entry of dayData) {
        const parsed = this.parseEntry(entry);
        if (parsed) entries.push(parsed);
      }
    } else if (typeof dayData === 'object') {
      if (dayData.entries && Array.isArray(dayData.entries)) {
        for (const entry of dayData.entries) {
          const parsed = this.parseEntry(entry);
          if (parsed) entries.push(parsed);
        }
      } else {
        for (const [source, sourceEntries] of Object.entries(dayData)) {
          if (Array.isArray(sourceEntries)) {
            for (const entry of sourceEntries) {
              const parsed = this.parseEntry(entry, source as TimeSource);
              if (parsed) entries.push(parsed);
            }
          }
        }
      }
    }

    return entries;
  }

  private parseEntry(entry: any, defaultSource?: TimeSource): TimeEntry | null {
    if (!entry || typeof entry !== 'object') return null;

    const id = entry.id || `entry-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const source = (entry.source || defaultSource || 'manual') as TimeSource;

    let durationMinutes = 0;
    if (entry.duration_minutes !== undefined) {
      durationMinutes = entry.duration_minutes;
    } else if (entry.duration !== undefined) {
      durationMinutes = this.parseDuration(entry.duration);
    } else if (entry.start_time && entry.end_time) {
      durationMinutes = this.calculateDuration(entry.start_time, entry.end_time);
    }

    return {
      id,
      source,
      start_time: entry.start_time || entry.start || '',
      end_time: entry.end_time || entry.end,
      duration_minutes: durationMinutes,
      task_id: entry.task_id || entry.task,
      description: entry.description || entry.desc,
      metadata: entry.metadata,
    };
  }

  private parseDuration(duration: string | number): number {
    if (typeof duration === 'number') return duration;

    const hourMatch = duration.match(/(\d+(?:\.\d+)?)\s*h/i);
    const minMatch = duration.match(/(\d+)\s*m/i);

    let minutes = 0;
    if (hourMatch) minutes += parseFloat(hourMatch[1]) * 60;
    if (minMatch) minutes += parseInt(minMatch[1], 10);

    return Math.round(minutes);
  }

  private calculateDuration(startTime: string, endTime: string): number {
    try {
      const [startH, startM] = startTime.split(':').map(Number);
      const [endH, endM] = endTime.split(':').map(Number);

      const startMinutes = startH * 60 + startM;
      const endMinutes = endH * 60 + endM;

      return endMinutes - startMinutes;
    } catch {
      return 0;
    }
  }

  private isValidDate(date: string): boolean {
    return /^\d{4}-\d{2}-\d{2}$/.test(date);
  }

  async loadTimeLogForDate(projectId: ProjectId, date: string): Promise<TimeLog | null> {
    const yearMonth = date.slice(0, 7);
    const logs = await this.loadTimeLogsForMonth(projectId, yearMonth);
    return logs.find(log => log.date === date) || null;
  }

  async loadTimeLogsForDateRange(
    projectId: ProjectId,
    startDate: string,
    endDate: string
  ): Promise<TimeLog[]> {
    const logs = await this.loadTimeLogsForProject(projectId);
    return logs.filter(log => log.date >= startDate && log.date <= endDate);
  }

  async loadTimeLogsForMonth(projectId: ProjectId, yearMonth: string): Promise<TimeLog[]> {
    const timeDir = this.fileSystem.getProjectTimeDirectory(projectId);
    const filePath = `${timeDir}${yearMonth}.yml`;

    try {
      const exists = await this.fileSystem.fileExists(filePath);
      if (!exists) return [];

      return this.loadTimeLogsFromFile(filePath, projectId);
    } catch (error) {
      console.warn(`Failed to load time logs for ${yearMonth}:`, error);
      return [];
    }
  }

  async getWeeklySummary(projectId: ProjectId, weekStartDate: string): Promise<WeeklySummary> {
    const weekEnd = new Date(weekStartDate);
    weekEnd.setDate(weekEnd.getDate() + 6);
    const weekEndDate = weekEnd.toISOString().split('T')[0];

    const logs = await this.loadTimeLogsForDateRange(projectId, weekStartDate, weekEndDate);

    const dailyTotals: Record<string, number> = {};
    const bySource: Record<TimeSource, number> = { manual: 0, git: 0, tmux: 0, calendar: 0 };
    let totalMinutes = 0;

    for (const log of logs) {
      dailyTotals[log.date] = log.total_minutes;
      totalMinutes += log.total_minutes;

      const sourceBreakdown = log.getSourceBreakdown();
      for (const [source, minutes] of Object.entries(sourceBreakdown)) {
        bySource[source as TimeSource] += minutes;
      }
    }

    return {
      week_start: weekStartDate,
      week_end: weekEndDate,
      total_minutes: totalMinutes,
      daily_totals: dailyTotals,
      by_source: bySource,
      by_project: { [projectId]: totalMinutes },
    };
  }

  async getMonthlySummary(projectId: ProjectId, yearMonth: string): Promise<MonthlySummary> {
    const logs = await this.loadTimeLogsForMonth(projectId, yearMonth);

    const bySource: Record<TimeSource, number> = { manual: 0, git: 0, tmux: 0, calendar: 0 };
    const weeklyTotals: number[] = [0, 0, 0, 0, 0];
    let totalMinutes = 0;
    let daysWithActivity = 0;

    for (const log of logs) {
      totalMinutes += log.total_minutes;
      if (log.total_minutes > 0) daysWithActivity++;

      const dayOfMonth = parseInt(log.date.split('-')[2], 10);
      const weekIndex = Math.min(Math.floor((dayOfMonth - 1) / 7), 4);
      weeklyTotals[weekIndex] += log.total_minutes;

      const sourceBreakdown = log.getSourceBreakdown();
      for (const [source, minutes] of Object.entries(sourceBreakdown)) {
        bySource[source as TimeSource] += minutes;
      }
    }

    const daysInMonth = new Date(
      parseInt(yearMonth.split('-')[0], 10),
      parseInt(yearMonth.split('-')[1], 10),
      0
    ).getDate();

    return {
      month: yearMonth,
      total_minutes: totalMinutes,
      weekly_totals: weeklyTotals,
      by_source: bySource,
      by_project: { [projectId]: totalMinutes },
      average_daily_minutes: daysWithActivity > 0
        ? Math.round(totalMinutes / daysWithActivity)
        : 0,
    };
  }

  getProjectTimeDirectory(projectId: ProjectId): string {
    return this.fileSystem.getProjectTimeDirectory(projectId);
  }
}
