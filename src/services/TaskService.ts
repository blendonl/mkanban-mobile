/**
 * TaskService handles business logic for task operations
 * Ported from Python: src/services/item_service.py
 */

import { Board } from '../domain/entities/Board';
import { Task } from '../domain/entities/Task';
import { StorageRepository } from '../domain/repositories/StorageRepository';
import { ValidationService } from './ValidationService';
import { TaskId, ColumnId, ParentId } from '../core/types';
import {
  ItemNotFoundError,
  ColumnNotFoundError,
  ValidationError,
} from '../core/exceptions';
import { generateManualItemId, getBoardPrefix } from '../utils/stringUtils';
import { DEFAULT_ISSUE_TYPE } from '../core/constants';
import { getEventBus } from '../core/EventBus';

export class TaskService {
  private storage: StorageRepository;
  private validator: ValidationService;

  constructor(storage: StorageRepository, validator: ValidationService) {
    this.storage = storage;
    this.validator = validator;
  }

  /**
   * Create a new task in a column
   * @throws {ColumnNotFoundError} if column not found
   * @throws {ValidationError} if validation fails or column at capacity
   */
  async createTask(
    board: Board,
    columnId: ColumnId,
    title: string,
    description: string = '',
    parentId?: ParentId | null
  ): Promise<Task> {
    console.info(`[TaskService] Creating task: ${title} in board: ${board.name}`);
    this.validator.validateTaskTitle(title);

    const column = board.getColumnById(columnId);
    if (!column) {
      console.warn(`[TaskService] Column not found: ${columnId}`);
      throw new ColumnNotFoundError(`Column with id '${columnId}' not found`);
    }

    // Check if column is at capacity before adding
    this.validator.validateColumnCapacity(column);

    if (parentId) {
      const parent = board.getParentById(parentId);
      if (!parent) {
        console.warn(`[TaskService] Parent not found: ${parentId}`);
        throw new ValidationError(`Parent with id '${parentId}' not found`);
      }
    }

    // Generate ID for manual task
    const nextIndex = this._getNextTaskIndex(board);
    const taskId = generateManualItemId(board.name, nextIndex);

    const task = column.addTask(title, parentId || null, taskId);
    if (description) {
      task.description = description;
    }

    // Set default issue type for manually created tasks
    task.metadata.issue_type = DEFAULT_ISSUE_TYPE;

    console.info(
      `[TaskService] Successfully created task: ${title} [${taskId}] in column: ${column.name}`
    );

    // Emit task created event
    await getEventBus().publish('task_created', {
      taskId: task.id,
      taskTitle: task.title,
      boardId: board.id,
      columnId: column.id,
      timestamp: new Date(),
    });

    return task;
  }

  /**
   * Calculate the next sequential index for manual tasks on this board
   * Scans all tasks across all columns to find the highest index
   */
  private _getNextTaskIndex(board: Board): number {
    const boardPrefix = getBoardPrefix(board.name);
    const pattern = new RegExp(`^${boardPrefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}-(\\d+)$`);
    let maxIndex = 0;

    // Scan all tasks across all columns
    for (const column of board.columns) {
      for (const task of column.tasks) {
        const match = task.id.match(pattern);
        if (match) {
          const index = parseInt(match[1], 10);
          maxIndex = Math.max(maxIndex, index);
        }
      }
    }

    return maxIndex + 1;
  }

  /**
   * Update a task's properties
   * @throws {ItemNotFoundError} if task not found
   * @throws {ValidationError} if validation fails
   */
  async updateTask(board: Board, taskId: TaskId, updates: Partial<Task>): Promise<boolean> {
    for (const column of board.columns) {
      const task = column.getTaskById(taskId);
      if (task) {
        if (updates.title) {
          this.validator.validateTaskTitle(updates.title);
        }

        task.update(updates);

        // Emit task updated event
        await getEventBus().publish('task_updated', {
          taskId: task.id,
          taskTitle: task.title,
          boardId: board.id,
          columnId: column.id,
          timestamp: new Date(),
        });

        return true;
      }
    }

    throw new ItemNotFoundError(`Task with id '${taskId}' not found`);
  }

  /**
   * Delete a task from the board
   * @throws {ItemNotFoundError} if task not found
   * @throws {ValidationError} if deletion fails
   */
  async deleteTask(board: Board, taskId: TaskId): Promise<boolean> {
    console.info(`[TaskService] Deleting task: ${taskId} from board: ${board.name}`);

    for (const column of board.columns) {
      const task = column.getTaskById(taskId);
      if (task) {
        console.debug(
          `[TaskService] Found task to delete: ${task.title} in column: ${column.name}`
        );

        const deleted = await this.storage.deleteTaskFromColumn(board, task, column);
        if (!deleted) {
          console.error(
            `[TaskService] Failed to delete task from storage: ${task.title}`
          );
          throw new ValidationError('Failed to delete task from storage');
        }

        const success = column.removeTask(taskId);
        if (success) {
          await this.storage.saveBoardToStorage(board);
          console.info(`[TaskService] Successfully deleted task: ${task.title}`);

          // Emit task deleted event
          await getEventBus().publish('task_deleted', {
            taskId: task.id,
            taskTitle: task.title,
            boardId: board.id,
            columnId: column.id,
            timestamp: new Date(),
          });
        }
        return success;
      }
    }

    console.warn(`[TaskService] Task not found for deletion: ${taskId}`);
    throw new ItemNotFoundError(`Task with id '${taskId}' not found`);
  }

  /**
   * Move a task between columns
   * @throws {ItemNotFoundError} if task not found
   * @throws {ColumnNotFoundError} if target column not found
   * @throws {ValidationError} if target column at capacity
   */
  async moveTaskBetweenColumns(
    board: Board,
    taskId: TaskId,
    targetColumnId: ColumnId
  ): Promise<boolean> {
    let taskToMove: Task | null = null;
    let sourceColumn = null;

    // Find the task in the board
    for (const column of board.columns) {
      const task = column.getTaskById(taskId);
      if (task) {
        taskToMove = task;
        sourceColumn = column;
        break;
      }
    }

    if (!taskToMove || !sourceColumn) {
      throw new ItemNotFoundError(`Task with id '${taskId}' not found`);
    }

    if (sourceColumn.id === targetColumnId) {
      return false; // Already in target column
    }

    const targetColumn = board.getColumnById(targetColumnId);
    if (!targetColumn) {
      throw new ColumnNotFoundError(
        `Target column with id '${targetColumnId}' not found`
      );
    }

    // Check if target column is at capacity before moving
    this.validator.validateColumnCapacity(targetColumn);

    // Move task in storage
    const moved = await this.storage.moveTaskBetweenColumns(
      board,
      taskToMove,
      sourceColumn,
      targetColumn
    );
    if (!moved) {
      return false;
    }

    // Update board structure
    const removed = sourceColumn.removeTask(taskId);
    if (!removed) {
      throw new ValidationError('Failed to remove task from source column');
    }

    taskToMove.moveToColumn(targetColumnId);
    targetColumn.moveTaskToEnd(taskToMove);

    await this.storage.saveBoardToStorage(board);

    // Emit task moved event
    await getEventBus().publish('task_moved', {
      taskId: taskToMove.id,
      taskTitle: taskToMove.title,
      boardId: board.id,
      columnId: targetColumnId,
      previousColumnId: sourceColumn.id,
      timestamp: new Date(),
    });

    return true;
  }

  /**
   * Set or clear the parent for a task
   * @throws {ValidationError} if parent not found
   * @throws {ItemNotFoundError} if task not found
   */
  async setTaskParent(
    board: Board,
    taskId: TaskId,
    parentId: ParentId | null
  ): Promise<boolean> {
    if (parentId) {
      const parent = board.getParentById(parentId);
      if (!parent) {
        throw new ValidationError(`Parent with id '${parentId}' not found`);
      }
    }

    for (const column of board.columns) {
      const task = column.getTaskById(taskId);
      if (task) {
        task.setParent(parentId);
        return true;
      }
    }

    throw new ItemNotFoundError(`Task with id '${taskId}' not found`);
  }

  /**
   * Get tasks grouped by parent
   * Orphaned tasks come first, then tasks grouped by parent
   * @throws {ColumnNotFoundError} if column not found
   */
  async getTasksGroupedByParent(board: Board, columnId: ColumnId): Promise<Task[]> {
    const column = board.getColumnById(columnId);
    if (!column) {
      throw new ColumnNotFoundError(`Column with id '${columnId}' not found`);
    }

    const tasks = column.getAllTasks();
    const orphanedTasks = tasks.filter((task) => task.parent_id === null);
    const parentGroups: { [key: string]: Task[] } = {};

    // Group tasks by parent
    for (const task of tasks) {
      if (task.parent_id) {
        if (!parentGroups[task.parent_id]) {
          parentGroups[task.parent_id] = [];
        }
        parentGroups[task.parent_id].push(task);
      }
    }

    // Combine orphaned tasks with parent groups
    const groupedTasks = [...orphanedTasks];
    for (const parentId in parentGroups) {
      groupedTasks.push(...parentGroups[parentId]);
    }

    return groupedTasks;
  }
}
