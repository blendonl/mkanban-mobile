import { Task } from '../domain/entities/Task';
import { AgendaItem } from '../domain/entities/AgendaItem';
import { Board } from '../domain/entities/Board';
import { BoardService } from './BoardService';
import { ProjectService } from './ProjectService';
import { TaskService } from './TaskService';
import { AgendaRepository } from '../domain/repositories/AgendaRepository';
import { TaskId, BoardId, ProjectId, ColumnId } from '../core/types';
import { TaskType, MeetingData } from '../domain/entities/Task';
import { NotificationService } from './NotificationService';
import { getOccurrencesForDate } from '../utils/recurrenceUtils';
import { logger } from '../utils/logger';
import { getEventBus, EventSubscription, FileChangeEventPayload } from '../core/EventBus';

export interface ScheduledAgendaItem {
  agendaItem: AgendaItem;
  task: Task | null;
  boardId: BoardId;
  boardName: string;
  projectName: string;
  columnName: string | null;
  isOrphaned: boolean;
}

export interface ScheduledTask {
  task: Task;
  boardId: string;
  boardName: string;
  projectName: string;
}

export interface DayAgenda {
  date: string;
  items: ScheduledAgendaItem[];
  regularTasks: ScheduledAgendaItem[];
  meetings: ScheduledAgendaItem[];
  milestones: ScheduledAgendaItem[];
  orphanedItems: ScheduledAgendaItem[];
  tasks: ScheduledAgendaItem[];
}

interface RecurringTaskMetadata {
  projectId: ProjectId;
  boardId: BoardId;
  taskId: TaskId;
  recurrence: Task['recurrence'];
  scheduledDate: string;
  scheduledTime: string | null;
  durationMinutes: number | null;
  taskType: TaskType;
  meetingData: MeetingData | null;
  title: string;
}

export class AgendaService {
  private recurringTasksCache: RecurringTaskMetadata[] | null = null;
  private recurringTasksCacheTimestamp: number = 0;
  private readonly RECURRING_TASKS_CACHE_TTL_MS = 5 * 60 * 1000;
  private eventSubscriptions: EventSubscription[] = [];

  constructor(
    private boardService: BoardService,
    private projectService: ProjectService,
    private taskService: TaskService,
    private agendaRepository: AgendaRepository,
    private notificationService: NotificationService
  ) {
    this.subscribeToInvalidation();
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
    const existing = await this.agendaRepository.loadAgendaItemByTask(projectId, boardId, taskId);
    if (existing && existing.scheduled_date === date) {
      throw new Error('Task already scheduled on this date. Please use reschedule instead.');
    }

    const agendaItem = new AgendaItem({
      project_id: projectId,
      board_id: boardId,
      task_id: taskId,
      scheduled_date: date,
      scheduled_time: time,
      duration_minutes: durationMinutes,
      task_type: taskType,
      meeting_data: meetingData,
    });

    await this.agendaRepository.saveAgendaItem(agendaItem);
    return agendaItem;
  }

  async getAgendaForDate(date: string): Promise<DayAgenda> {
    await this.ensureRecurringAgendaItemsForDate(date);
    logger.debug(`[AgendaService] Loading agenda for date: ${date}`);
    const items = await this.agendaRepository.loadAgendaItemsForDate(date);
    logger.debug(`[AgendaService] Found ${items.length} raw agenda items for ${date}`);

    const scheduledItems = await this.resolveAgendaItems(items);
    logger.debug(`[AgendaService] Resolved ${scheduledItems.length} scheduled items`);

    const regularTasks = scheduledItems.filter(si => si.agendaItem.task_type === 'regular');
    const meetings = scheduledItems.filter(si => si.agendaItem.task_type === 'meeting');
    const milestones = scheduledItems.filter(si => si.agendaItem.task_type === 'milestone');

    logger.debug(`[AgendaService] Categorized: ${regularTasks.length} regular, ${meetings.length} meetings, ${milestones.length} milestones`);

    return {
      date,
      items: scheduledItems,
      regularTasks,
      meetings,
      milestones,
      orphanedItems: scheduledItems.filter(si => si.isOrphaned),
      tasks: regularTasks,
    };
  }

  async getAgendaForWeek(weekStartDate?: string): Promise<Map<string, DayAgenda>> {
    const start = weekStartDate ? new Date(weekStartDate) : this.getMonday(new Date());
    const end = new Date(start);
    end.setDate(end.getDate() + 6);

    return this.getAgendaForDateRange(
      start.toISOString().split('T')[0],
      end.toISOString().split('T')[0]
    );
  }

  async getAgendaForDateRange(startDate: string, endDate: string): Promise<Map<string, DayAgenda>> {
    const dates: string[] = [];
    const start = new Date(startDate);
    const end = new Date(endDate);

    const current = new Date(start);
    while (current <= end) {
      dates.push(current.toISOString().split('T')[0]);
      current.setDate(current.getDate() + 1);
    }

    const dayAgendas = await Promise.all(
      dates.map(date => this.getAgendaForDate(date))
    );

    const result = new Map<string, DayAgenda>();
    dayAgendas.forEach((dayAgenda, index) => {
      result.set(dates[index], dayAgenda);
    });

    return result;
  }

  async getAllScheduledItems(): Promise<ScheduledAgendaItem[]> {
    const items = await this.agendaRepository.loadAllAgendaItems();
    return await this.resolveAgendaItems(items);
  }

  async getAgendaForToday(): Promise<DayAgenda> {
    const today = new Date().toISOString().split('T')[0];
    return this.getAgendaForDate(today);
  }

  async updateAgendaItem(item: AgendaItem): Promise<void> {
    const existing = item.id
      ? await this.agendaRepository.loadAgendaItemById(item.id)
      : null;
    const wasCompleted = !!existing?.completed_at;
    const isCompleted = !!item.completed_at;

    if (!wasCompleted && isCompleted) {
      await this.moveLinkedTaskToDoneColumn(item);
    }

    if (item.completed_at && item.notification_id) {
      await this.notificationService.cancelNotification(item.notification_id);
      item.notification_id = null;
    }
    await this.agendaRepository.saveAgendaItem(item);
  }

  async deleteAgendaItem(item: AgendaItem): Promise<boolean> {
    if (item.notification_id) {
      await this.notificationService.cancelNotification(item.notification_id);
    }
    return await this.agendaRepository.deleteAgendaItem(item);
  }

  async rescheduleAgendaItem(
    item: AgendaItem,
    newDate: string,
    newTime?: string
  ): Promise<AgendaItem> {
    if (item.notification_id) {
      await this.notificationService.cancelNotification(item.notification_id);
      item.notification_id = null;
    }
    item.reschedule(newDate, newTime);
    await this.agendaRepository.saveAgendaItem(item);
    await this.maybeScheduleNotification(item, item.task_id);
    return item;
  }

  async getOrphanedAgendaItems(): Promise<ScheduledAgendaItem[]> {
    const orphanedItems = await this.agendaRepository.getOrphanedAgendaItems();
    return await this.resolveAgendaItems(orphanedItems);
  }

  async cleanupOrphanedItems(): Promise<number> {
    const orphaned = await this.agendaRepository.getOrphanedAgendaItems();
    let deletedCount = 0;

    for (const item of orphaned) {
      const success = await this.agendaRepository.deleteAgendaItem(item);
      if (success) {
        deletedCount++;
      }
    }

    return deletedCount;
  }

  async getUpcomingAgendaItems(days: number = 7): Promise<ScheduledAgendaItem[]> {
    const today = new Date();
    const future = new Date(today);
    future.setDate(future.getDate() + days);

    const todayStr = today.toISOString().split('T')[0];
    const futureStr = future.toISOString().split('T')[0];

    const items = await this.agendaRepository.loadAgendaItemsForDateRange(todayStr, futureStr);
    return await this.resolveAgendaItems(items);
  }

  async getOverdueAgendaItems(): Promise<ScheduledAgendaItem[]> {
    const today = new Date().toISOString().split('T')[0];
    const allItems = await this.agendaRepository.loadAllAgendaItems();

    const overdueItems = allItems.filter(item => {
      return item.scheduled_date < today;
    });

    const scheduled = await this.resolveAgendaItems(overdueItems);

    return scheduled.filter(si => {
      if (si.isOrphaned) return false;
      if (!si.task) return false;
      const normalizedColumnId = si.task.column_id.replace(/_/g, '-');
      return normalizedColumnId !== 'done';
    });
  }

  private async resolveAgendaItems(items: AgendaItem[]): Promise<ScheduledAgendaItem[]> {
    if (items.length === 0) {
      return [];
    }

    const boardIds = new Set(items.map(item => item.board_id));
    const boards = await this.boardService.getBoardsByIds(boardIds);

    const projectIds = new Set(items.map(item => item.project_id));
    const projectNames = new Map<string, string>();
    await Promise.all(
      Array.from(projectIds).map(async (projectId) => {
        const name = await this.getProjectName(projectId);
        projectNames.set(projectId, name);
      })
    );

    return items.map(item => this.resolveAgendaItemWithBoards(item, boards, projectNames));
  }

  private resolveAgendaItemWithBoards(
    item: AgendaItem,
    boards: Map<string, Board>,
    projectNames: Map<string, string>
  ): ScheduledAgendaItem {
    const board = boards.get(item.board_id);
    if (!board) {
      return {
        agendaItem: item,
        task: null,
        boardId: item.board_id,
        boardName: 'Unknown Board',
        projectName: projectNames.get(item.project_id) || 'Unknown Project',
        columnName: null,
        isOrphaned: true,
      };
    }

    const { task, column } = this.findTaskInBoard(board, item.task_id);
    if (!task) {
      return {
        agendaItem: item,
        task: null,
        boardId: item.board_id,
        boardName: board.name,
        projectName: projectNames.get(item.project_id) || 'Unknown Project',
        columnName: null,
        isOrphaned: true,
      };
    }

    return {
      agendaItem: item,
      task,
      boardId: board.id,
      boardName: board.name,
      projectName: projectNames.get(item.project_id) || 'Unknown Project',
      columnName: column?.name || null,
      isOrphaned: false,
    };
  }

  private async resolveAgendaItem(item: AgendaItem): Promise<ScheduledAgendaItem> {
    try {
      const board = await this.boardService.getBoardById(item.board_id);
      if (!board) {
        return {
          agendaItem: item,
          task: null,
          boardId: item.board_id,
          boardName: 'Unknown Board',
          projectName: 'Unknown Project',
          columnName: null,
          isOrphaned: true,
        };
      }

      const { task, column } = this.findTaskInBoard(board, item.task_id);
      if (!task) {
        return {
          agendaItem: item,
          task: null,
          boardId: item.board_id,
          boardName: board.name,
          projectName: await this.getProjectName(item.project_id),
          columnName: null,
          isOrphaned: true,
        };
      }

      return {
        agendaItem: item,
        task,
        boardId: board.id,
        boardName: board.name,
        projectName: await this.getProjectName(item.project_id),
        columnName: column?.name || null,
        isOrphaned: false,
      };
    } catch (error) {
      logger.error(`Failed to resolve agenda item ${item.id}:`, error);
      return {
        agendaItem: item,
        task: null,
        boardId: item.board_id,
        boardName: 'Unknown Board',
        projectName: 'Unknown Project',
        columnName: null,
        isOrphaned: true,
      };
    }
  }

  private async getProjectName(projectId: ProjectId): Promise<string> {
    try {
      const project = await this.projectService.getProjectById(projectId);
      return project?.name || 'Unknown Project';
    } catch (error) {
      return 'Unknown Project';
    }
  }

  private findTaskInBoard(
    board: Board,
    taskId: TaskId
  ): { task: Task | null; column: { id: ColumnId; name: string } | null } {
    for (const column of board.columns) {
      const task = column.tasks.find(t => t.id === taskId);
      if (task) {
        return { task, column: { id: column.id, name: column.name } };
      }
    }
    return { task: null, column: null };
  }

  private subscribeToInvalidation(): void {
    const eventBus = getEventBus();
    const fileChangedSub = eventBus.subscribe('file_changed', (payload: FileChangeEventPayload) => {
      if (payload.entityType === 'board') {
        this.invalidateRecurringTasksCache();
      }
    });
    this.eventSubscriptions.push(fileChangedSub);
  }

  private invalidateRecurringTasksCache(): void {
    this.recurringTasksCache = null;
    this.recurringTasksCacheTimestamp = 0;
  }

  private async getCachedRecurringTasks(): Promise<RecurringTaskMetadata[]> {
    const now = Date.now();
    const cacheAge = now - this.recurringTasksCacheTimestamp;

    if (this.recurringTasksCache && cacheAge < this.RECURRING_TASKS_CACHE_TTL_MS) {
      return this.recurringTasksCache;
    }

    const boards = await this.boardService.getAllBoards();
    const metadata: RecurringTaskMetadata[] = [];

    for (const board of boards) {
      for (const column of board.columns) {
        const recurringTasks = column.tasks.filter(
          task => task.recurrence && task.scheduled_date
        );

        metadata.push(...recurringTasks.map(task => ({
          projectId: task.project_id!,
          boardId: board.id,
          taskId: task.id,
          recurrence: task.recurrence,
          scheduledDate: task.scheduled_date,
          scheduledTime: task.scheduled_time || null,
          durationMinutes: task.time_block_minutes || null,
          taskType: task.task_type,
          meetingData: task.meeting_data || null,
          title: task.title,
        })));
      }
    }

    this.recurringTasksCache = metadata;
    this.recurringTasksCacheTimestamp = now;
    return metadata;
  }

  private getMonday(date: Date): Date {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    d.setDate(diff);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  private normalizeColumnId(columnId: ColumnId): string {
    return columnId.replace(/_/g, '-').toLowerCase();
  }

  private getDoneColumnId(board: Board): ColumnId | null {
    for (const column of board.columns) {
      const normalizedId = this.normalizeColumnId(column.id);
      if (normalizedId === 'done' || column.name.trim().toLowerCase() === 'done') {
        return column.id;
      }
    }
    return null;
  }

  private async moveLinkedTaskToDoneColumn(item: AgendaItem): Promise<void> {
    try {
      const board = await this.boardService.getBoardById(item.board_id);
      if (!board) {
        return;
      }

      const { task, column } = this.findTaskInBoard(board, item.task_id);
      if (!task || !column) {
        return;
      }

      const doneColumnId = this.getDoneColumnId(board);
      if (!doneColumnId) {
        return;
      }

      const normalizedCurrent = this.normalizeColumnId(column.id);
      const normalizedDone = this.normalizeColumnId(doneColumnId);
      if (normalizedCurrent === normalizedDone) {
        return;
      }

      await this.taskService.moveTaskBetweenColumns(board, item.task_id, doneColumnId);
    } catch (error) {
      logger.error(`[AgendaService] Failed to move task ${item.task_id} to done`, error);
    }
  }

  async scheduleTask(
    boardId: BoardId,
    taskId: TaskId,
    date: string,
    time?: string,
    durationMinutes?: number,
    recurrence?: Task['recurrence'] | null
  ): Promise<AgendaItem> {
    const board = await this.boardService.getBoardById(boardId);
    if (!board) {
      throw new Error('Board not found');
    }

    const { task, column } = this.findTaskInBoard(board, taskId);
    if (!task) {
      throw new Error('Task not found in board');
    }

    task.schedule(date, time, durationMinutes);
    task.recurrence = recurrence || null;

    const existingAgendaItems = await this.agendaRepository.loadAgendaItemsByTask(
      task.project_id!,
      boardId,
      taskId
    );

    for (const item of existingAgendaItems) {
      await this.agendaRepository.deleteAgendaItem(item);
    }

    const agendaItem = new AgendaItem({
      project_id: task.project_id!,
      board_id: boardId,
      task_id: taskId,
      scheduled_date: date,
      scheduled_time: time,
      duration_minutes: durationMinutes,
      task_type: task.task_type,
      meeting_data: task.meeting_data,
      is_recurring: !!recurrence,
    });

    await Promise.all([
      this.boardService.updateTask(boardId, task),
      this.agendaRepository.saveAgendaItem(agendaItem),
    ]);

    await this.maybeScheduleNotification(agendaItem, task.title);

    return agendaItem;
  }

  async setTaskType(
    boardId: BoardId,
    taskId: TaskId,
    taskType: TaskType
  ): Promise<void> {
    const board = await this.boardService.getBoardById(boardId);
    if (!board) {
      throw new Error('Board not found');
    }

    const { task } = this.findTaskInBoard(board, taskId);
    if (!task) {
      throw new Error('Task not found in board');
    }

    task.task_type = taskType;

    if (taskType !== 'meeting' && task.meeting_data) {
      task.meeting_data = null;
    }

    const existingAgendaItems = await this.agendaRepository.loadAgendaItemsByTask(
      task.project_id!,
      boardId,
      taskId
    );

    for (const existingAgendaItem of existingAgendaItems) {
      existingAgendaItem.task_type = taskType;
      if (taskType !== 'meeting') {
        existingAgendaItem.meeting_data = null;
      }
      await this.agendaRepository.saveAgendaItem(existingAgendaItem);
    }

    await this.boardService.updateTask(boardId, task);
  }

  async unscheduleTask(boardId: BoardId, taskId: TaskId): Promise<void> {
    const board = await this.boardService.getBoardById(boardId);
    if (!board) {
      throw new Error('Board not found');
    }

    const { task } = this.findTaskInBoard(board, taskId);
    if (!task) {
      throw new Error('Task not found in board');
    }

    task.unschedule();
    task.recurrence = null;

    const existingAgendaItems = await this.agendaRepository.loadAgendaItemsByTask(
      task.project_id!,
      boardId,
      taskId
    );

    await this.boardService.updateTask(boardId, task);

    for (const item of existingAgendaItems) {
      if (item.notification_id) {
        await this.notificationService.cancelNotification(item.notification_id);
      }
      await this.agendaRepository.deleteAgendaItem(item);
    }
  }

  async getTasksForDate(date: string): Promise<DayAgenda> {
    return this.getAgendaForDate(date);
  }

  async updateMeetingData(
    boardId: BoardId,
    taskId: TaskId,
    meetingData: MeetingData
  ): Promise<void> {
    const board = await this.boardService.getBoardById(boardId);
    if (!board) {
      throw new Error('Board not found');
    }

    const { task } = this.findTaskInBoard(board, taskId);
    if (!task) {
      throw new Error('Task not found in board');
    }

    task.meeting_data = meetingData;

    const existingAgendaItems = await this.agendaRepository.loadAgendaItemsByTask(
      task.project_id!,
      boardId,
      taskId
    );

    for (const existingAgendaItem of existingAgendaItems) {
      existingAgendaItem.meeting_data = meetingData;
      await this.agendaRepository.saveAgendaItem(existingAgendaItem);
    }

    await this.boardService.updateTask(boardId, task);
  }

  async getAgendaItemById(id: string): Promise<AgendaItem | null> {
    return this.agendaRepository.loadAgendaItemById(id);
  }

  async getAgendaItemsByTask(projectId: ProjectId, boardId: BoardId, taskId: TaskId): Promise<AgendaItem[]> {
    return this.agendaRepository.loadAgendaItemsByTask(projectId, boardId, taskId);
  }

  async getTaskFromBoard(boardId: BoardId, taskId: TaskId): Promise<{ task: Task | null; projectId: ProjectId | null }> {
    const board = await this.boardService.getBoardById(boardId);
    if (!board) {
      return { task: null, projectId: null };
    }

    for (const column of board.columns) {
      const task = column.tasks.find(t => t.id === taskId);
      if (task) {
        return { task, projectId: board.project_id };
      }
    }

    return { task: null, projectId: null };
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

    const filterItems = (items: ScheduledAgendaItem[]) => {
      return items.filter(item => {
        if (projectId && item.agendaItem.project_id !== projectId) {
          return false;
        }
        if (goalId && item.task?.goal_id !== goalId) {
          return false;
        }
        return true;
      });
    };

    const filtered = filterItems(dayAgenda.items);

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
    const unfinished = await this.agendaRepository.loadUnfinishedItems(date);
    return await this.resolveAgendaItems(unfinished);
  }

  async markAsUnfinished(agendaItemId: string): Promise<void> {
    const item = await this.agendaRepository.loadAgendaItemById(agendaItemId);
    if (!item) {
      throw new Error('Agenda item not found');
    }

    item.markAsUnfinished();
    await this.agendaRepository.saveAgendaItem(item);
  }

  async updateActualValue(agendaItemId: string, value: number): Promise<void> {
    const item = await this.agendaRepository.loadAgendaItemById(agendaItemId);
    if (!item) {
      throw new Error('Agenda item not found');
    }

    item.updateActualValue(value);
    await this.agendaRepository.saveAgendaItem(item);
  }

  async getAllSchedulableTasks(projectId?: ProjectId, goalId?: string): Promise<ScheduledTask[]> {
    const boards = await this.boardService.getAllBoards();
    const tasks: ScheduledTask[] = [];

    for (const board of boards) {
      if (projectId && board.project_id !== projectId) {
        continue;
      }

      const projectName = await this.getProjectName(board.project_id);

      for (const column of board.columns) {
        for (const task of column.tasks) {
          if (goalId && task.goal_id !== goalId) {
            continue;
          }

          tasks.push({
            task,
            boardId: board.id,
            boardName: board.name,
            projectName,
          });
        }
      }
    }

    return tasks.sort((a, b) => {
      const priorityOrder = { high: 0, medium: 1, low: 2, none: 3 };
      const aPriority = priorityOrder[a.task.priority] ?? 3;
      const bPriority = priorityOrder[b.task.priority] ?? 3;
      return aPriority - bPriority;
    });
  }

  private async ensureRecurringAgendaItemsForDate(date: string): Promise<void> {
    const recurringTasks = await this.getCachedRecurringTasks();
    const existingItems = await this.agendaRepository.loadAgendaItemsForDate(date);
    const existingKeys = new Set(
      existingItems.map(item => `${item.board_id}::${item.task_id}::${item.scheduled_time || ''}`)
    );

    for (const taskMetadata of recurringTasks) {
      if (!taskMetadata.recurrence) {
        continue;
      }
      if (taskMetadata.recurrence.endDate && date > taskMetadata.recurrence.endDate) {
        continue;
      }

      const occurrences = getOccurrencesForDate(
        date,
        taskMetadata.recurrence,
        taskMetadata.scheduledDate,
        taskMetadata.scheduledTime
      );

      for (const occurrence of occurrences) {
        const key = `${taskMetadata.boardId}::${taskMetadata.taskId}::${occurrence.time || ''}`;
        if (existingKeys.has(key)) {
          continue;
        }

        const agendaItem = new AgendaItem({
          project_id: taskMetadata.projectId,
          board_id: taskMetadata.boardId,
          task_id: taskMetadata.taskId,
          scheduled_date: date,
          scheduled_time: occurrence.time,
          duration_minutes: taskMetadata.durationMinutes,
          task_type: taskMetadata.taskType,
          meeting_data: taskMetadata.meetingData,
          is_recurring: true,
        });

        await this.agendaRepository.saveAgendaItem(agendaItem);
        await this.maybeScheduleNotification(agendaItem, taskMetadata.title);
      }
    }
  }

  private async maybeScheduleNotification(item: AgendaItem, title?: string): Promise<void> {
    if (!item.scheduled_time) {
      return;
    }

    const triggerTime = new Date(`${item.scheduled_date}T${item.scheduled_time}`);
    if (triggerTime.getTime() <= Date.now()) {
      return;
    }

    const handle = await this.notificationService.scheduleNotification(
      {
        title: 'Goal Reminder',
        message: title || item.task_id,
        data: { agendaItemId: item.id },
      },
      triggerTime
    );

    if (handle) {
      item.notification_id = handle.id;
      await this.agendaRepository.saveAgendaItem(item);
    }
  }

  destroy(): void {
    this.eventSubscriptions.forEach((sub) => sub.unsubscribe());
    this.eventSubscriptions = [];
  }
}
