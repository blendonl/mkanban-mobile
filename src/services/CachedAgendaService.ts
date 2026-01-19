import { AgendaItem } from '../domain/entities/AgendaItem';
import { AgendaService, DayAgenda, ScheduledAgendaItem, ScheduledTask } from './AgendaService';
import { TaskId, BoardId, ProjectId } from '../core/types';
import { TaskType, MeetingData, RecurrenceRule } from '../domain/entities/Task';
import { getCacheManager } from '../infrastructure/cache/CacheManager';
import { EntityCache } from '../infrastructure/cache/EntityCache';
import { getEventBus, EventSubscription, FileChangeEventPayload } from '../core/EventBus';

export class CachedAgendaService {
  private cache: EntityCache<DayAgenda>;
  private weekCache: Map<string, Map<string, DayAgenda>> = new Map();
  private weekCacheTTL: Map<string, number> = new Map();
  private readonly WEEK_CACHE_TTL_MS = 5 * 60 * 1000;
  private eventSubscriptions: EventSubscription[] = [];

  constructor(private baseService: AgendaService) {
    this.cache = getCacheManager().getCache('agenda');
    this.subscribeToInvalidation();
  }

  private subscribeToInvalidation(): void {
    const eventBus = getEventBus();

    const fileChangedSub = eventBus.subscribe('file_changed', (payload: FileChangeEventPayload) => {
      if (payload.entityType === 'agenda' || payload.entityType === 'board') {
        this.invalidateCache();
      }
    });

    this.eventSubscriptions.push(fileChangedSub);
  }

  private invalidateCache(): void {
    this.cache.clear();
    this.weekCache.clear();
    this.weekCacheTTL.clear();
    getEventBus().publishSync('agenda_invalidated', { timestamp: new Date() });
  }

  private invalidateDate(date: string): void {
    this.cache.invalidate(date);
    this.invalidateWeekCachesContainingDate(date);
    getEventBus().publishSync('agenda_invalidated', { timestamp: new Date() });
  }

  private invalidateDateRange(startDate: string, endDate: string): void {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const current = new Date(start);

    while (current <= end) {
      const dateKey = current.toISOString().split('T')[0];
      this.cache.invalidate(dateKey);
      current.setDate(current.getDate() + 1);
    }

    this.invalidateWeekCachesContainingDate(startDate);
    this.invalidateWeekCachesContainingDate(endDate);
    getEventBus().publishSync('agenda_invalidated', { timestamp: new Date() });
  }

  private invalidateWeekCachesContainingDate(date: string): void {
    const targetDate = new Date(date);
    const keysToDelete: string[] = [];

    for (const [weekKey, weekData] of this.weekCache.entries()) {
      if (weekData.has(date)) {
        keysToDelete.push(weekKey);
      }
    }

    keysToDelete.forEach(key => {
      this.weekCache.delete(key);
      this.weekCacheTTL.delete(key);
    });
  }

  private isWeekCacheValid(weekKey: string): boolean {
    const timestamp = this.weekCacheTTL.get(weekKey);
    if (!timestamp) return false;
    return Date.now() - timestamp < this.WEEK_CACHE_TTL_MS;
  }

  async createAgendaItem(
    projectId: ProjectId,
    boardId: BoardId,
    taskId: TaskId,
    date: string,
    time?: string,
    durationMinutes?: number,
    taskType?: TaskType,
    meetingData?: MeetingData
  ): Promise<AgendaItem> {
    const item = await this.baseService.createAgendaItem(
      projectId,
      boardId,
      taskId,
      date,
      time,
      durationMinutes,
      taskType,
      meetingData
    );
    this.invalidateDate(date);
    return item;
  }

  async getAgendaForDate(date: string): Promise<DayAgenda> {
    const cached = this.cache.get(date);
    if (cached) {
      return cached;
    }

    const agenda = await this.baseService.getAgendaForDate(date);
    this.cache.set(date, agenda);
    return agenda;
  }

  async getAgendaForWeek(weekStart: string): Promise<Map<string, DayAgenda>> {
    const weekKey = `week:${weekStart}`;

    if (this.isWeekCacheValid(weekKey)) {
      const cached = this.weekCache.get(weekKey);
      if (cached) {
        return cached;
      }
    }

    const weekData = await this.baseService.getAgendaForWeek(weekStart);
    this.weekCache.set(weekKey, weekData);
    this.weekCacheTTL.set(weekKey, Date.now());

    return weekData;
  }

  async getAgendaForDateRange(startDate: string, endDate: string): Promise<Map<string, DayAgenda>> {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 6) {
      return this.getAgendaForWeek(startDate);
    }

    return this.baseService.getAgendaForDateRange(startDate, endDate);
  }

  async getTasksForDate(date: string): Promise<DayAgenda> {
    return this.getAgendaForDate(date);
  }

  async getAgendaForDateFiltered(
    date: string,
    projectId?: ProjectId,
    goalId?: string
  ): Promise<DayAgenda> {
    const dayAgenda = await this.getAgendaForDate(date);

    if (!projectId && !goalId) {
      return dayAgenda;
    }

    const filtered = dayAgenda.items.filter(item => {
      if (projectId && item.agendaItem.project_id !== projectId) {
        return false;
      }
      if (goalId && item.task?.goal_id !== goalId) {
        return false;
      }
      return true;
    });

    return {
      date,
      items: filtered,
      regularTasks: filtered.filter(si => si.agendaItem.task_type === 'regular'),
      meetings: filtered.filter(si => si.agendaItem.task_type === 'meeting'),
      milestones: filtered.filter(si => si.agendaItem.task_type === 'milestone'),
      orphanedItems: filtered.filter(si => si.isOrphaned),
      tasks: filtered.filter(si => si.agendaItem.task_type === 'regular'),
    };
  }

  async getUnfinishedItems(date?: string): Promise<ScheduledAgendaItem[]> {
    return this.baseService.getUnfinishedItems(date);
  }

  async getUpcomingAgendaItems(limit: number = 10): Promise<ScheduledAgendaItem[]> {
    return this.baseService.getUpcomingAgendaItems(limit);
  }

  async getOverdueAgendaItems(): Promise<ScheduledAgendaItem[]> {
    return this.baseService.getOverdueAgendaItems();
  }

  async getAgendaItemById(itemId: string): Promise<AgendaItem | null> {
    return this.baseService.getAgendaItemById(itemId);
  }

  async markAsUnfinished(agendaItemId: string): Promise<void> {
    const item = await this.baseService.getAgendaItemById(agendaItemId);
    await this.baseService.markAsUnfinished(agendaItemId);
    if (item) {
      this.invalidateDate(item.scheduled_date);
    } else {
      this.invalidateCache();
    }
  }

  async updateActualValue(agendaItemId: string, value: number): Promise<void> {
    const item = await this.baseService.getAgendaItemById(agendaItemId);
    await this.baseService.updateActualValue(agendaItemId, value);
    if (item) {
      this.invalidateDate(item.scheduled_date);
    } else {
      this.invalidateCache();
    }
  }

  async getAllSchedulableTasks(projectId?: ProjectId, goalId?: string): Promise<ScheduledTask[]> {
    return this.baseService.getAllSchedulableTasks(projectId, goalId);
  }

  async scheduleTask(
    boardId: BoardId,
    taskId: TaskId,
    date: string,
    time?: string,
    durationMinutes?: number,
    recurrence?: RecurrenceRule | null
  ): Promise<AgendaItem> {
    const item = await this.baseService.scheduleTask(boardId, taskId, date, time, durationMinutes, recurrence);
    this.invalidateDate(date);
    return item;
  }

  async rescheduleAgendaItem(
    item: AgendaItem,
    newDate: string,
    newTime?: string
  ): Promise<AgendaItem> {
    const oldDate = item.scheduled_date;
    const updated = await this.baseService.rescheduleAgendaItem(item, newDate, newTime);
    this.invalidateDate(oldDate);
    this.invalidateDate(newDate);
    return updated;
  }

  async updateAgendaItem(item: AgendaItem): Promise<void> {
    await this.baseService.updateAgendaItem(item);
    this.invalidateDate(item.scheduled_date);
  }

  async deleteAgendaItem(item: AgendaItem): Promise<boolean> {
    const result = await this.baseService.deleteAgendaItem(item);
    this.invalidateDate(item.scheduled_date);
    return result;
  }

  async getOrphanedAgendaItems(): Promise<ScheduledAgendaItem[]> {
    return this.baseService.getOrphanedAgendaItems();
  }

  async setTaskType(boardId: BoardId, taskId: TaskId, taskType: TaskType): Promise<void> {
    const { projectId } = await this.baseService.getTaskFromBoard(boardId, taskId);
    if (!projectId) {
      await this.baseService.setTaskType(boardId, taskId, taskType);
      this.invalidateCache();
      return;
    }

    const items = await this.baseService.getAgendaItemsByTask(projectId, boardId, taskId);
    await this.baseService.setTaskType(boardId, taskId, taskType);
    items.forEach(item => this.invalidateDate(item.scheduled_date));
  }

  async updateMeetingData(boardId: BoardId, taskId: TaskId, meetingData: MeetingData): Promise<void> {
    const { projectId } = await this.baseService.getTaskFromBoard(boardId, taskId);
    if (!projectId) {
      await this.baseService.updateMeetingData(boardId, taskId, meetingData);
      this.invalidateCache();
      return;
    }

    const items = await this.baseService.getAgendaItemsByTask(projectId, boardId, taskId);
    await this.baseService.updateMeetingData(boardId, taskId, meetingData);
    items.forEach(item => this.invalidateDate(item.scheduled_date));
  }

  async unscheduleTask(boardId: BoardId, taskId: TaskId): Promise<void> {
    const { projectId } = await this.baseService.getTaskFromBoard(boardId, taskId);
    if (!projectId) {
      await this.baseService.unscheduleTask(boardId, taskId);
      this.invalidateCache();
      return;
    }

    const items = await this.baseService.getAgendaItemsByTask(projectId, boardId, taskId);
    await this.baseService.unscheduleTask(boardId, taskId);
    items.forEach(item => this.invalidateDate(item.scheduled_date));
  }

  destroy(): void {
    this.eventSubscriptions.forEach((sub) => sub.unsubscribe());
    this.eventSubscriptions = [];
  }
}
