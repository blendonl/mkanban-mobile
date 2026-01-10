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

export interface DayAgenda {
  date: string;
  items: ScheduledAgendaItem[];
  regularTasks: ScheduledAgendaItem[];
  meetings: ScheduledAgendaItem[];
  milestones: ScheduledAgendaItem[];
  orphanedItems: ScheduledAgendaItem[];
}

export class AgendaService {
  constructor(
    private boardService: BoardService,
    private projectService: ProjectService,
    private agendaRepository: AgendaRepository
  ) {}

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
    const items = await this.agendaRepository.loadAgendaItemsForDate(date);
    const scheduledItems = await Promise.all(
      items.map(item => this.resolveAgendaItem(item))
    );

    return {
      date,
      items: scheduledItems,
      regularTasks: scheduledItems.filter(si => si.agendaItem.task_type === 'regular'),
      meetings: scheduledItems.filter(si => si.agendaItem.task_type === 'meeting'),
      milestones: scheduledItems.filter(si => si.agendaItem.task_type === 'milestone'),
      orphanedItems: scheduledItems.filter(si => si.isOrphaned),
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

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split('T')[0];
      const dayAgenda = await this.getAgendaForDate(dateStr);
      result.set(dateStr, dayAgenda);
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
}
