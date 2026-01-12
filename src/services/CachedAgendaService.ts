import { AgendaItem } from '../domain/entities/AgendaItem';
import { AgendaService, DayAgenda, ScheduledAgendaItem } from './AgendaService';
import { TaskId, BoardId, ProjectId } from '../core/types';
import { TaskType, MeetingData } from '../domain/entities/Task';
import { getCacheManager } from '../infrastructure/cache/CacheManager';
import { EntityCache } from '../infrastructure/cache/EntityCache';
import { getEventBus, EventSubscription, FileChangeEventPayload } from '../core/EventBus';

export class CachedAgendaService {
  private cache: EntityCache<DayAgenda>;
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
    getEventBus().publishSync('agenda_invalidated', { timestamp: new Date() });
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
    this.invalidateCache();
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
    return this.baseService.getAgendaForWeek(weekStart);
  }

  async getAgendaForDateRange(startDate: string, endDate: string): Promise<Map<string, DayAgenda>> {
    return this.baseService.getAgendaForDateRange(startDate, endDate);
  }

  async getUpcomingAgendaItems(limit: number = 10): Promise<ScheduledAgendaItem[]> {
    return this.baseService.getUpcomingAgendaItems(limit);
  }

  async getOverdueAgendaItems(): Promise<ScheduledAgendaItem[]> {
    return this.baseService.getOverdueAgendaItems();
  }

  async getAgendaItemById(itemId: string): Promise<ScheduledAgendaItem | null> {
    return this.baseService.getAgendaItemById(itemId);
  }

  async scheduleTask(
    projectId: ProjectId,
    boardId: BoardId,
    taskId: TaskId,
    date: string,
    time?: string,
    durationMinutes?: number,
    taskType?: TaskType,
    meetingData?: MeetingData
  ): Promise<void> {
    await this.baseService.scheduleTask(projectId, boardId, taskId, date, time, durationMinutes, taskType, meetingData);
    this.invalidateCache();
  }

  async rescheduleAgendaItem(
    itemId: string,
    newDate: string,
    newTime?: string,
    newDuration?: number
  ): Promise<AgendaItem | null> {
    const item = await this.baseService.rescheduleAgendaItem(itemId, newDate, newTime, newDuration);
    this.invalidateCache();
    return item;
  }

  async updateAgendaItem(itemId: string, updates: Partial<AgendaItem>): Promise<AgendaItem | null> {
    const item = await this.baseService.updateAgendaItem(itemId, updates);
    this.invalidateCache();
    return item;
  }

  async deleteAgendaItem(item: AgendaItem): Promise<boolean> {
    const result = await this.baseService.deleteAgendaItem(item);
    this.invalidateCache();
    return result;
  }

  async getOrphanedAgendaItems(): Promise<ScheduledAgendaItem[]> {
    return this.baseService.getOrphanedAgendaItems();
  }

  async setTaskType(itemId: string, taskType: TaskType): Promise<AgendaItem | null> {
    const item = await this.baseService.setTaskType(itemId, taskType);
    this.invalidateCache();
    return item;
  }

  async updateMeetingData(itemId: string, meetingData: MeetingData): Promise<AgendaItem | null> {
    const item = await this.baseService.updateMeetingData(itemId, meetingData);
    this.invalidateCache();
    return item;
  }

  destroy(): void {
    this.eventSubscriptions.forEach((sub) => sub.unsubscribe());
    this.eventSubscriptions = [];
  }
}
