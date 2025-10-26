/**
 * CreateTaskExecutorImpl - Create task executor implementation
 */

import { CreateTaskExecutor } from '../ActionExecutor';
import { Executor, ExecutionContext, ExecutionResult, replaceVariables } from './BaseExecutor';
import { TaskService } from '../../../services/TaskService';

export class CreateTaskExecutorImpl implements Executor {
  constructor(
    private config: CreateTaskExecutor,
    private taskService: TaskService
  ) {}

  async execute(context: ExecutionContext): Promise<ExecutionResult> {
    try {
      const title = replaceVariables(this.config.taskTitle, context);
      const description = this.config.taskDescription
        ? replaceVariables(this.config.taskDescription, context)
        : undefined;

      const boardId = this.config.boardId || context.boardId;
      if (!boardId) {
        return {
          success: false,
          error: 'No board ID specified',
        };
      }

      const task = await this.taskService.createTask(
        boardId,
        this.config.taskColumn,
        {
          title,
          description,
        }
      );

      if (task) {
        return {
          success: true,
          message: `Created task "${title}" in column "${this.config.taskColumn}"`,
          data: { taskId: task.id },
        };
      } else {
        return {
          success: false,
          error: 'Failed to create task',
        };
      }
    } catch (error: any) {
      return {
        success: false,
        error: `Error creating task: ${error.message}`,
      };
    }
  }

  async validate(): Promise<boolean> {
    return (
      !!this.config.taskTitle &&
      this.config.taskTitle.length > 0 &&
      !!this.config.taskColumn &&
      this.config.taskColumn.length > 0
    );
  }
}
