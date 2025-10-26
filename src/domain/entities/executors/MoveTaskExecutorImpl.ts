/**
 * MoveTaskExecutorImpl - Move task executor implementation
 */

import { MoveTaskExecutor } from '../ActionExecutor';
import { Executor, ExecutionContext, ExecutionResult } from './BaseExecutor';
import { TaskService } from '../../../services/TaskService';

export class MoveTaskExecutorImpl implements Executor {
  constructor(
    private config: MoveTaskExecutor,
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
        this.config.targetColumn
      );

      if (success) {
        return {
          success: true,
          message: `Moved task "${task.title}" to column "${this.config.targetColumn}"`,
        };
      } else {
        return {
          success: false,
          error: `Failed to move task to ${this.config.targetColumn}`,
        };
      }
    } catch (error: any) {
      return {
        success: false,
        error: `Error moving task: ${error.message}`,
      };
    }
  }

  async validate(): Promise<boolean> {
    return !!this.config.targetColumn && this.config.targetColumn.length > 0;
  }
}
