import { Task } from '../domain/entities/Task';
import { AgendaItem } from '../domain/entities/AgendaItem';
import { Board } from '../domain/entities/Board';
import { BoardService } from './BoardService';
import { ProjectService } from './ProjectService';
import { AgendaRepository } from '../domain/repositories/AgendaRepository';
import { TaskId, BoardId, ProjectId } from '../core/types';
import { TaskType, MeetingData } from '../domain/entities/Task';

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

export class AgendaService {
  constructor(
    private boardService: BoardService,
    private projectService: ProjectService,
    private agendaRepository: AgendaRepository
  ) { }

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
    console.log(`[AgendaService] Loading agenda for date: ${date}`);
    const items = await this.agendaRepository.loadAgendaItemsForDate(date);
    console.log(`[AgendaService] Found ${items.length} raw agenda items for ${date}`);

    const scheduledItems = await Promise.all(
      items.map(item => this.resolveAgendaItem(item))
    );
    console.log(`[AgendaService] Resolved ${scheduledItems.length} scheduled items`);

    const regularTasks = scheduledItems.filter(si => si.agendaItem.task_type === 'regular');
    const meetings = scheduledItems.filter(si => si.agendaItem.task_type === 'meeting');
    const milestones = scheduledItems.filter(si => si.agendaItem.task_type === 'milestone');

    console.log(`[AgendaService] Categorized: ${regularTasks.length} regular, ${meetings.length} meetings, ${milestones.length} milestones`);

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
    const result = new Map<string, DayAgenda>();
    const start = new Date(startDate);
    const end = new Date(endDate);

    const current = new Date(start);
    while (current <= end) {
      const dateStr = current.toISOString().split('T')[0];
      const dayAgenda = await this.getAgendaForDate(dateStr);
      result.set(dateStr, dayAgenda);
      current.setDate(current.getDate() + 1);
    }

    return result;
  }

  async getAgendaForToday(): Promise<DayAgenda> {
    const today = new Date().toISOString().split('T')[0];
    return this.getAgendaForDate(today);
  }

  async updateAgendaItem(item: AgendaItem): Promise<void> {
    await this.agendaRepository.saveAgendaItem(item);
  }

  async deleteAgendaItem(item: AgendaItem): Promise<boolean> {
    return await this.agendaRepository.deleteAgendaItem(item);
  }

  async rescheduleAgendaItem(
    item: AgendaItem,
    newDate: string,
    newTime?: string
  ): Promise<AgendaItem> {
    item.reschedule(newDate, newTime);
    await this.agendaRepository.saveAgendaItem(item);
    return item;
  }

  async getOrphanedAgendaItems(): Promise<ScheduledAgendaItem[]> {
    const orphanedItems = await this.agendaRepository.getOrphanedAgendaItems();
    return await Promise.all(
      orphanedItems.map(item => this.resolveAgendaItem(item))
    );
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
    return await Promise.all(
      items.map(item => this.resolveAgendaItem(item))
    );
  }

  async getOverdueAgendaItems(): Promise<ScheduledAgendaItem[]> {
    const today = new Date().toISOString().split('T')[0];
    const allItems = await this.agendaRepository.loadAllAgendaItems();

    const overdueItems = allItems.filter(item => {
      return item.scheduled_date < today;
    });

    const scheduled = await Promise.all(
      overdueItems.map(item => this.resolveAgendaItem(item))
    );

    return scheduled.filter(si => {
      if (si.isOrphaned) return false;
      if (!si.task) return false;
      const normalizedColumnId = si.task.column_id.replace(/_/g, '-');
      return normalizedColumnId !== 'done';
    });
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
      console.error(`Failed to resolve agenda item ${item.id}:`, error);
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

  private findTaskInBoard(board: Board, taskId: TaskId): { task: Task | null; column: { name: string } | null } {
    for (const column of board.columns) {
      const task = column.tasks.find(t => t.id === taskId);
      if (task) {
        return { task, column: { name: column.name } };
      }
    }
    return { task: null, column: null };
  }

  private getMonday(date: Date): Date {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    d.setDate(diff);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  async scheduleTask(
    boardId: BoardId,
    taskId: TaskId,
    date: string,
    time?: string,
    durationMinutes?: number
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

    const existingAgendaItem = await this.agendaRepository.loadAgendaItemByTask(
      task.project_id!,
      boardId,
      taskId
    );

    let agendaItem: AgendaItem;
    if (existingAgendaItem) {
      existingAgendaItem.reschedule(date, time);
      if (durationMinutes !== undefined) {
        existingAgendaItem.updateDuration(durationMinutes);
      }
      agendaItem = existingAgendaItem;
    } else {
      agendaItem = new AgendaItem({
        project_id: task.project_id!,
        board_id: boardId,
        task_id: taskId,
        scheduled_date: date,
        scheduled_time: time,
        duration_minutes: durationMinutes,
        task_type: task.task_type,
        meeting_data: task.meeting_data,
      });
    }

    await Promise.all([
      this.boardService.updateTask(boardId, task),
      this.agendaRepository.saveAgendaItem(agendaItem),
    ]);

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

    const existingAgendaItem = await this.agendaRepository.loadAgendaItemByTask(
      task.project_id!,
      boardId,
      taskId
    );

    if (existingAgendaItem) {
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

    const existingAgendaItem = await this.agendaRepository.loadAgendaItemByTask(
      task.project_id!,
      boardId,
      taskId
    );

    await this.boardService.updateTask(boardId, task);

    if (existingAgendaItem) {
      await this.agendaRepository.deleteAgendaItem(existingAgendaItem);
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

    const existingAgendaItem = await this.agendaRepository.loadAgendaItemByTask(
      task.project_id!,
      boardId,
      taskId
    );

    if (existingAgendaItem) {
      existingAgendaItem.meeting_data = meetingData;
      await this.agendaRepository.saveAgendaItem(existingAgendaItem);
    }

    await this.boardService.updateTask(boardId, task);
  }

  async getAgendaItemById(id: string): Promise<AgendaItem | null> {
    return this.agendaRepository.loadAgendaItemById(id);
  }
}
