import { TimeLog, WeeklySummary, MonthlySummary } from '../entities/TimeLog';
import { ProjectId } from '../../core/types';

export interface TimeLogRepository {
  loadTimeLogsForProject(projectId: ProjectId): Promise<TimeLog[]>;

  loadTimeLogForDate(projectId: ProjectId, date: string): Promise<TimeLog | null>;

  loadTimeLogsForDateRange(
    projectId: ProjectId,
    startDate: string,
    endDate: string
  ): Promise<TimeLog[]>;

  loadTimeLogsForMonth(projectId: ProjectId, yearMonth: string): Promise<TimeLog[]>;

  loadAllTimeLogs(): Promise<TimeLog[]>;

  getWeeklySummary(projectId: ProjectId, weekStartDate: string): Promise<WeeklySummary>;

  getMonthlySummary(projectId: ProjectId, yearMonth: string): Promise<MonthlySummary>;

  getProjectTimeDirectory(projectId: ProjectId): string;
}
