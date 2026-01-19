import { Goal } from "../domain/entities/Goal";
import { GoalRepository } from "../domain/repositories/GoalRepository";
import { GoalId, ProjectId } from "../core/types";
import { ValidationError } from "../core/exceptions";
import { BoardService } from "./BoardService";
import { AgendaRepository } from "../domain/repositories/AgendaRepository";
import { Task } from "../domain/entities/Task";
import { generateOccurrencesBetween, Occurrence } from "../utils/recurrenceUtils";

export interface GoalProgress {
  totalOccurrences: number;
  completedOccurrences: number;
  percentComplete: number;
}

export class GoalService {
  constructor(
    private repository: GoalRepository,
    private boardService: BoardService,
    private agendaRepository: AgendaRepository
  ) {}

  async getAllGoals(): Promise<Goal[]> {
    return await this.repository.loadAllGoals();
  }

  async getGoalById(goalId: GoalId): Promise<Goal> {
    const goal = await this.repository.loadGoalById(goalId);
    if (!goal) {
      throw new ValidationError(`Goal with id '${goalId}' not found`);
    }
    return goal;
  }

  async createGoal(
    title: string,
    description: string,
    startDate: string,
    endDate: string,
    projectIds: ProjectId[]
  ): Promise<Goal> {
    if (!title.trim()) {
      throw new ValidationError("Goal title is required");
    }
    if (!startDate || !endDate) {
      throw new ValidationError("Goal start and end dates are required");
    }
    if (new Date(endDate) < new Date(startDate)) {
      throw new ValidationError("Goal end date must be after start date");
    }

    const goal = new Goal({
      title: title.trim(),
      description: description.trim(),
      start_date: startDate,
      end_date: endDate,
      project_ids: projectIds,
    });

    await this.repository.saveGoal(goal);
    return goal;
  }

  async updateGoal(
    goalId: GoalId,
    updates: Partial<{
      title: string;
      description: string;
      start_date: string;
      end_date: string;
      project_ids: ProjectId[];
      status: string;
    }>
  ): Promise<Goal> {
    const goal = await this.getGoalById(goalId);

    if (updates.title !== undefined && !updates.title.trim()) {
      throw new ValidationError("Goal title cannot be empty");
    }

    if (updates.start_date && updates.end_date) {
      if (new Date(updates.end_date) < new Date(updates.start_date)) {
        throw new ValidationError("Goal end date must be after start date");
      }
    }

    goal.update({
      title: updates.title?.trim(),
      description: updates.description?.trim(),
      start_date: updates.start_date,
      end_date: updates.end_date,
      project_ids: updates.project_ids,
      status: updates.status as any,
    });

    await this.repository.saveGoal(goal);
    return goal;
  }

  async deleteGoal(goalId: GoalId): Promise<boolean> {
    return await this.repository.deleteGoal(goalId);
  }

  async getGoalProgress(goalId: GoalId): Promise<GoalProgress> {
    const goal = await this.getGoalById(goalId);
    const tasks = await this.getTasksForProjects(goal.project_ids);

    const occurrences = this.buildExpectedOccurrences(tasks, goal.start_date, goal.end_date);
    if (occurrences.length === 0) {
      return { totalOccurrences: 0, completedOccurrences: 0, percentComplete: 0 };
    }

    const agendaItems = await this.agendaRepository.loadAgendaItemsForDateRange(
      goal.start_date,
      goal.end_date
    );

    const completedSet = new Set(
      agendaItems
        .filter(item => item.completed_at)
        .map(item => `${item.task_id}::${item.scheduled_date}::${item.scheduled_time || ''}`)
    );

    const completedCount = occurrences.filter(occ =>
      completedSet.has(`${occ.taskId}::${occ.date}::${occ.time || ''}`)
    ).length;

    const percent = Math.round((completedCount / occurrences.length) * 100);

    return {
      totalOccurrences: occurrences.length,
      completedOccurrences: completedCount,
      percentComplete: percent,
    };
  }

  private async getTasksForProjects(projectIds: ProjectId[]): Promise<Task[]> {
    const tasks: Task[] = [];

    for (const projectId of projectIds) {
      const boards = await this.boardService.getBoardsByProject(projectId);
      for (const board of boards) {
        for (const column of board.columns) {
          tasks.push(...column.tasks);
        }
      }
    }

    return tasks;
  }

  private buildExpectedOccurrences(tasks: Task[], startDate: string, endDate: string) {
    const occurrences: Array<Occurrence & { taskId: string }> = [];

    for (const task of tasks) {
      if (!task.recurrence || !task.scheduled_date) {
        continue;
      }

      const effectiveEndDate = task.recurrence.endDate && task.recurrence.endDate < endDate
        ? task.recurrence.endDate
        : endDate;

      const taskOccurrences = generateOccurrencesBetween(
        startDate,
        effectiveEndDate,
        task.recurrence,
        task.scheduled_date,
        task.scheduled_time || null
      );

      for (const occ of taskOccurrences) {
        occurrences.push({ ...occ, taskId: task.id });
      }
    }

    return occurrences;
  }
}
