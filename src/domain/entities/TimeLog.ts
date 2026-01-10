import { TimeLogId, ProjectId, TaskId, FilePath } from "../../core/types";

export type TimeSource = 'manual' | 'git' | 'tmux' | 'calendar';

export interface TimeEntry {
  id: string;
  source: TimeSource;
  start_time: string;
  end_time?: string;
  duration_minutes: number;
  task_id?: TaskId;
  description?: string;
  metadata?: Record<string, any>;
}

export interface TimeLogProps {
  id?: TimeLogId;
  project_id: ProjectId;
  date: string;
  entries?: TimeEntry[];
  total_minutes?: number;
  file_path?: FilePath | null;
}

export interface DailySummary {
  date: string;
  total_minutes: number;
  by_source: Record<TimeSource, number>;
  by_task: Record<string, number>;
  entry_count: number;
}

export interface WeeklySummary {
  week_start: string;
  week_end: string;
  total_minutes: number;
  daily_totals: Record<string, number>;
  by_source: Record<TimeSource, number>;
  by_project: Record<string, number>;
}

export interface MonthlySummary {
  month: string;
  total_minutes: number;
  weekly_totals: number[];
  by_source: Record<TimeSource, number>;
  by_project: Record<string, number>;
  average_daily_minutes: number;
}

export class TimeLog {
  id: TimeLogId;
  project_id: ProjectId;
  date: string;
  entries: TimeEntry[];
  total_minutes: number;
  file_path: FilePath | null;

  constructor(props: TimeLogProps) {
    this.project_id = props.project_id;
    this.date = props.date;
    this.entries = props.entries || [];
    this.file_path = props.file_path !== undefined ? props.file_path : null;

    this.id = props.id || `${props.project_id}-${props.date}`;

    this.total_minutes = props.total_minutes !== undefined
      ? props.total_minutes
      : this.calculateTotalMinutes();
  }

  private calculateTotalMinutes(): number {
    return this.entries.reduce((sum, entry) => sum + entry.duration_minutes, 0);
  }

  get totalHours(): number {
    return Math.round((this.total_minutes / 60) * 10) / 10;
  }

  get formattedDuration(): string {
    const hours = Math.floor(this.total_minutes / 60);
    const minutes = this.total_minutes % 60;
    if (hours === 0) return `${minutes}m`;
    if (minutes === 0) return `${hours}h`;
    return `${hours}h ${minutes}m`;
  }

  getEntriesBySource(source: TimeSource): TimeEntry[] {
    return this.entries.filter(e => e.source === source);
  }

  getMinutesBySource(source: TimeSource): number {
    return this.getEntriesBySource(source)
      .reduce((sum, e) => sum + e.duration_minutes, 0);
  }

  getEntriesByTask(taskId: TaskId): TimeEntry[] {
    return this.entries.filter(e => e.task_id === taskId);
  }

  getMinutesByTask(taskId: TaskId): number {
    return this.getEntriesByTask(taskId)
      .reduce((sum, e) => sum + e.duration_minutes, 0);
  }

  getSourceBreakdown(): Record<TimeSource, number> {
    const breakdown: Record<TimeSource, number> = {
      manual: 0,
      git: 0,
      tmux: 0,
      calendar: 0,
    };

    for (const entry of this.entries) {
      breakdown[entry.source] += entry.duration_minutes;
    }

    return breakdown;
  }

  getDailySummary(): DailySummary {
    const byTask: Record<string, number> = {};

    for (const entry of this.entries) {
      if (entry.task_id) {
        byTask[entry.task_id] = (byTask[entry.task_id] || 0) + entry.duration_minutes;
      }
    }

    return {
      date: this.date,
      total_minutes: this.total_minutes,
      by_source: this.getSourceBreakdown(),
      by_task: byTask,
      entry_count: this.entries.length,
    };
  }

  toDict(): Record<string, any> {
    return {
      id: this.id,
      project_id: this.project_id,
      date: this.date,
      total_minutes: this.total_minutes,
      entries: this.entries,
    };
  }

  static fromDict(data: Record<string, any>): TimeLog {
    return new TimeLog({
      id: data.id,
      project_id: data.project_id,
      date: data.date,
      entries: data.entries || [],
      total_minutes: data.total_minutes,
      file_path: data.file_path,
    });
  }

  static formatMinutes(minutes: number): string {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours === 0) return `${mins}m`;
    if (mins === 0) return `${hours}h`;
    return `${hours}h ${mins}m`;
  }

  static formatHoursDecimal(minutes: number): string {
    return (minutes / 60).toFixed(1) + 'h';
  }
}
