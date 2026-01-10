import { CalendarEvent, SyncStatus } from '../domain/entities/CalendarEvent';
import { CalendarRepository } from '../domain/repositories/CalendarRepository';
import { Task } from '../domain/entities/Task';
import { MarkdownBoardRepository } from '../infrastructure/storage/MarkdownBoardRepository';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEYS = {
  LAST_SYNC: 'calendar_last_sync',
  SYNC_ENABLED: 'calendar_sync_enabled',
  CALENDAR_EVENTS: 'calendar_events_cache',
};

export interface SyncResult {
  success: boolean;
  eventsCreated: number;
  eventsUpdated: number;
  eventsDeleted: number;
  tasksUpdated: number;
  conflicts: ConflictInfo[];
  error?: string;
}

export interface ConflictInfo {
  eventId: string;
  taskId?: string;
  localVersion: CalendarEvent;
  remoteVersion: CalendarEvent;
  resolvedWith: 'local' | 'remote' | 'unresolved';
}

export type SyncDirection = 'both' | 'to_calendar' | 'from_calendar';

export class CalendarSyncService {
  private syncInProgress = false;
  private syncListeners: Set<(status: SyncStatus) => void> = new Set();

  constructor(
    private calendarRepository: CalendarRepository,
    private boardRepository: MarkdownBoardRepository
  ) {}

  async isAuthenticated(): Promise<boolean> {
    return this.calendarRepository.isAuthenticated();
  }

  async connect(): Promise<boolean> {
    return this.calendarRepository.authenticate();
  }

  async disconnect(): Promise<void> {
    await this.calendarRepository.logout();
    await AsyncStorage.removeItem(STORAGE_KEYS.LAST_SYNC);
    await AsyncStorage.removeItem(STORAGE_KEYS.CALENDAR_EVENTS);
  }

  async isSyncEnabled(): Promise<boolean> {
    const enabled = await AsyncStorage.getItem(STORAGE_KEYS.SYNC_ENABLED);
    return enabled === 'true';
  }

  async setSyncEnabled(enabled: boolean): Promise<void> {
    await AsyncStorage.setItem(STORAGE_KEYS.SYNC_ENABLED, enabled.toString());
  }

  async getLastSyncTime(): Promise<Date | null> {
    const timestamp = await AsyncStorage.getItem(STORAGE_KEYS.LAST_SYNC);
    return timestamp ? new Date(timestamp) : null;
  }

  async sync(direction: SyncDirection = 'both'): Promise<SyncResult> {
    if (this.syncInProgress) {
      return {
        success: false,
        eventsCreated: 0,
        eventsUpdated: 0,
        eventsDeleted: 0,
        tasksUpdated: 0,
        conflicts: [],
        error: 'Sync already in progress',
      };
    }

    this.syncInProgress = true;
    this.notifyListeners('pending');

    try {
      const isAuth = await this.isAuthenticated();
      if (!isAuth) {
        throw new Error('Not authenticated with Google Calendar');
      }

      const result: SyncResult = {
        success: true,
        eventsCreated: 0,
        eventsUpdated: 0,
        eventsDeleted: 0,
        tasksUpdated: 0,
        conflicts: [],
      };

      const now = new Date();
      const startDate = new Date(now);
      startDate.setDate(startDate.getDate() - 7);
      const endDate = new Date(now);
      endDate.setDate(endDate.getDate() + 30);

      if (direction === 'both' || direction === 'from_calendar') {
        const pullResult = await this.pullFromCalendar(startDate, endDate);
        result.tasksUpdated += pullResult.tasksUpdated;
        result.conflicts.push(...pullResult.conflicts);
      }

      if (direction === 'both' || direction === 'to_calendar') {
        const pushResult = await this.pushToCalendar();
        result.eventsCreated += pushResult.eventsCreated;
        result.eventsUpdated += pushResult.eventsUpdated;
        result.conflicts.push(...pushResult.conflicts);
      }

      await AsyncStorage.setItem(STORAGE_KEYS.LAST_SYNC, new Date().toISOString());
      this.notifyListeners('synced');

      return result;
    } catch (error) {
      this.notifyListeners('conflict');
      return {
        success: false,
        eventsCreated: 0,
        eventsUpdated: 0,
        eventsDeleted: 0,
        tasksUpdated: 0,
        conflicts: [],
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    } finally {
      this.syncInProgress = false;
    }
  }

  private async pullFromCalendar(
    startDate: Date,
    endDate: Date
  ): Promise<{ tasksUpdated: number; conflicts: ConflictInfo[] }> {
    const events = await this.calendarRepository.getEvents(startDate, endDate);
    let tasksUpdated = 0;
    const conflicts: ConflictInfo[] = [];

    for (const event of events) {
      if (event.description?.includes('[mkanban:')) {
        const match = event.description.match(/\[mkanban:([^:]+):([^\]]+)\]/);
        if (match) {
          const [, boardId, taskId] = match;
          const board = await this.boardRepository.loadBoardById(boardId);
          if (board) {
            const task = this.findTaskInBoard(board, taskId);
            if (task) {
              const needsUpdate = this.taskNeedsUpdateFromEvent(task, event);
              if (needsUpdate) {
                task.scheduled_date = event.dateString;
                task.scheduled_time = event.all_day ? null : event.startTimeString;
                task.time_block_minutes = event.durationMinutes;
                task.calendar_event_id = event.google_event_id;
                await this.boardRepository.saveBoard(board);
                tasksUpdated++;
              }
            }
          }
        }
      }
    }

    await this.cacheEvents(events);

    return { tasksUpdated, conflicts };
  }

  private async pushToCalendar(): Promise<{
    eventsCreated: number;
    eventsUpdated: number;
    conflicts: ConflictInfo[];
  }> {
    let eventsCreated = 0;
    let eventsUpdated = 0;
    const conflicts: ConflictInfo[] = [];

    const boards = await this.boardRepository.loadAllBoards();

    for (const board of boards) {
      if (!board) continue;

      for (const column of board.columns) {
        for (const task of column.tasks) {
          if (task.scheduled_date && task.task_type === 'meeting') {
            if (task.calendar_event_id) {
              const result = await this.updateTaskEvent(task, board.id);
              if (result === 'updated') eventsUpdated++;
            } else {
              const result = await this.createTaskEvent(task, board.id);
              if (result) {
                task.calendar_event_id = result.google_event_id;
                await this.boardRepository.saveBoard(board);
                eventsCreated++;
              }
            }
          }
        }
      }
    }

    return { eventsCreated, eventsUpdated, conflicts };
  }

  private async createTaskEvent(task: Task, boardId: string): Promise<CalendarEvent | null> {
    const event = this.taskToCalendarEvent(task, boardId);
    try {
      return await this.calendarRepository.createEvent(event);
    } catch (error) {
      console.error('Failed to create calendar event:', error);
      return null;
    }
  }

  private async updateTaskEvent(task: Task, boardId: string): Promise<'updated' | 'skipped' | 'error'> {
    if (!task.calendar_event_id) return 'skipped';

    try {
      const existingEvent = await this.calendarRepository.getEvent(task.calendar_event_id);
      if (!existingEvent) return 'skipped';

      const updatedEvent = this.taskToCalendarEvent(task, boardId);
      updatedEvent.google_event_id = task.calendar_event_id;

      await this.calendarRepository.updateEvent(updatedEvent);
      return 'updated';
    } catch (error) {
      console.error('Failed to update calendar event:', error);
      return 'error';
    }
  }

  private taskToCalendarEvent(task: Task, boardId: string): CalendarEvent {
    const startDate = new Date(task.scheduled_date + 'T00:00:00');

    if (task.scheduled_time) {
      const [hours, minutes] = task.scheduled_time.split(':').map(Number);
      startDate.setHours(hours, minutes, 0, 0);
    }

    const durationMinutes = task.time_block_minutes || 60;
    const endDate = new Date(startDate.getTime() + durationMinutes * 60000);

    const description = [
      task.description || '',
      '',
      `[mkanban:${boardId}:${task.id}]`,
    ].join('\n').trim();

    return new CalendarEvent({
      google_event_id: task.calendar_event_id ?? undefined,
      title: task.title,
      start_time: startDate,
      end_time: endDate,
      all_day: !task.scheduled_time,
      description,
      location: task.meeting_data?.location ?? undefined,
      attendees: task.meeting_data?.attendees,
      task_id: task.id,
      board_id: boardId,
      sync_status: 'pending',
    });
  }

  private taskNeedsUpdateFromEvent(task: Task, event: CalendarEvent): boolean {
    if (task.scheduled_date !== event.dateString) return true;
    if (!event.all_day && task.scheduled_time !== event.startTimeString) return true;
    if (task.time_block_minutes !== event.durationMinutes) return true;
    return false;
  }

  private findTaskInBoard(board: any, taskId: string): Task | null {
    for (const column of board.columns) {
      for (const task of column.tasks) {
        if (task.id === taskId) return task;
      }
    }
    return null;
  }

  private async cacheEvents(events: CalendarEvent[]): Promise<void> {
    const serialized = events.map(e => e.toDict());
    await AsyncStorage.setItem(STORAGE_KEYS.CALENDAR_EVENTS, JSON.stringify(serialized));
  }

  async getCachedEvents(): Promise<CalendarEvent[]> {
    const cached = await AsyncStorage.getItem(STORAGE_KEYS.CALENDAR_EVENTS);
    if (!cached) return [];

    try {
      const parsed = JSON.parse(cached);
      return parsed.map((e: any) => CalendarEvent.fromDict(e));
    } catch {
      return [];
    }
  }

  async getEventsForDate(date: string): Promise<CalendarEvent[]> {
    const cached = await this.getCachedEvents();
    return cached.filter(e => e.dateString === date);
  }

  async getEventsForDateRange(startDate: Date, endDate: Date): Promise<CalendarEvent[]> {
    const isAuth = await this.isAuthenticated();
    if (isAuth) {
      return this.calendarRepository.getEvents(startDate, endDate);
    }
    return this.getCachedEvents().then(events =>
      events.filter(e => e.start_time >= startDate && e.start_time <= endDate)
    );
  }

  onSyncStatusChange(listener: (status: SyncStatus) => void): () => void {
    this.syncListeners.add(listener);
    return () => this.syncListeners.delete(listener);
  }

  private notifyListeners(status: SyncStatus): void {
    this.syncListeners.forEach(listener => listener(status));
  }

  async deleteTaskEvent(task: Task): Promise<boolean> {
    if (!task.calendar_event_id) return true;

    try {
      await this.calendarRepository.deleteEvent(task.calendar_event_id);
      return true;
    } catch (error) {
      console.error('Failed to delete calendar event:', error);
      return false;
    }
  }
}
