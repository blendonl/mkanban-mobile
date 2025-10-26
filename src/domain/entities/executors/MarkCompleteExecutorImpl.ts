/**
 * MarkCompleteExecutorImpl - Mark task complete executor implementation
 */

import { MarkCompleteExecutor } from '../ActionExecutor';
import { Executor, ExecutionContext, ExecutionResult } from './BaseExecutor';
import { TaskService } from '../../../services/TaskService';

export class MarkCompleteExecutorImpl implements Executor {
  private doneColumnName = 'done'; // TODO: Make configurable

  constructor(
    private config: MarkCompleteExecutor,
    private taskService: TaskService
  ) {}

  async execute(context: ExecutionContext): Promise<ExecutionResult> {
    try {
      if (!context.taskId || !context.boardId) {
        return {
          success: false,
          error: 'Missing taskId or boardId in context',
        };
      }

      const task = await this.taskService.getTask(
        context.boardId,
        context.columnId || '',
        context.taskId
      );

      if (!task) {
        return {
          success: false,
          error: `Task ${context.taskId} not found`,
        };
      }

      const success = await this.taskService.moveTask(
        context.boardId,
        task,
        context.columnId || '',
        this.doneColumnName
      );

      if (success) {
        return {
          success: true,
          message: `Marked task "${task.title}" as complete`,
        };
      } else {
        return {
          success: false,
          error: `Failed to mark task as complete`,
        };
      }
    } catch (error: any) {
      return {
        success: false,
        error: `Error marking task complete: ${error.message}`,
      };
    }
  }

  async validate(): Promise<boolean> {
    return true; // No config to validate
  }
}
