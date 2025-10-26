/**
 * Markdown Storage Repository
 * Task-level storage operations with rollback support
 * Ported from Python: src/infrastructure/storage/markdown_storage_repository.py
 */

import { FileSystemManager } from "./FileSystemManager";
import { MarkdownParser } from "./MarkdownParser";
import { BoardPersistence } from "./BoardPersistence";
import { findTaskFileById, getTasksDirectoryPath } from "./FileOperations";
import { StorageRepository } from "../../domain/repositories/StorageRepository";
import { Board } from "../../domain/entities/Board";
import { Column } from "../../domain/entities/Column";
import { Task } from "../../domain/entities/Task";

export class MarkdownStorageRepository implements StorageRepository {
  private fileSystem: FileSystemManager;
  private parser: MarkdownParser;
  private persistence: BoardPersistence;

  constructor(fileSystem: FileSystemManager) {
    this.fileSystem = fileSystem;
    this.parser = new MarkdownParser(fileSystem);
    this.persistence = new BoardPersistence(fileSystem, this.parser);
  }

  /**
   * Delete a task from a column
   */
  async deleteTaskFromColumn(board: Board, task: Task, column: Column): Promise<boolean> {
    try {
      console.log(
        `Deleting task from column: board="${board.name}", column="${column.name}", task="${task.title}"`
      );

      const columnDir = this.fileSystem.getColumnDirectory(board.name, column.name);
      const tasksDir = getTasksDirectoryPath(columnDir);
      const taskFile = await findTaskFileById(
        this.fileSystem,
        this.parser,
        tasksDir,
        task.id
      );

      if (taskFile) {
        const deleted = await this.fileSystem.deleteFile(taskFile);

        if (deleted) {
          console.log(
            `Successfully deleted task: board="${board.name}", column="${column.name}", task="${task.title}"`
          );
          return true;
        } else {
          console.error(
            `Failed to delete task file: board="${board.name}", column="${column.name}", task="${task.title}"`
          );
          return false;
        }
      }

      console.warn(
        `Task file not found for deletion: board="${board.name}", column="${column.name}", task="${task.title}"`
      );
      return false;
    } catch (error) {
      console.error(
        `Failed to delete task from column: board="${board.name}", column="${column.name}", task="${task.title}"`,
        error
      );
      return false;
    }
  }

  /**
   * Move a task between columns with rollback on failure
   */
  async moveTaskBetweenColumns(
    board: Board,
    task: Task,
    oldColumn: Column,
    newColumn: Column
  ): Promise<boolean> {
    try {
      console.log(
        `Moving task between columns: board="${board.name}", task="${task.title}", from="${oldColumn.name}" to="${newColumn.name}"`
      );

      // First, save the task to the new column
      try {
        await this.persistence.saveTaskToColumn(board.name, newColumn.name, {
          id: task.id,
          title: task.title,
          description: task.description,
          parent_id: task.parent_id,
          created_at: task.created_at,
          moved_in_progress_at: task.moved_in_progress_at,
          moved_in_done_at: task.moved_in_done_at,
          worked_on_for: task.worked_on_for,
        });

        console.log(
          `Saved task to new column: board="${board.name}", column="${newColumn.name}", task="${task.title}"`
        );

        // Then, delete from the old column
        const deleted = await this.deleteTaskFromColumn(board, task, oldColumn);

        if (deleted) {
          console.log(
            `Successfully moved task between columns: board="${board.name}", task="${task.title}", from="${oldColumn.name}" to="${newColumn.name}"`
          );
          return true;
        } else {
          // If delete failed, try to clean up the new file (rollback)
          console.warn(
            `Failed to delete from old column, cleaning up new column: board="${board.name}", task="${task.title}"`
          );
          await this.deleteTaskFromColumn(board, task, newColumn);
          return false;
        }
      } catch (saveError) {
        console.error(
          `Failed to save task to new column: board="${board.name}", column="${newColumn.name}", task="${task.title}"`,
          saveError
        );
        return false;
      }
    } catch (error) {
      console.error(
        `Failed to move task between columns: board="${board.name}", task="${task.title}"`,
        error
      );
      return false;
    }
  }

  /**
   * Save entire board to storage (all columns and tasks)
   */
  async saveBoardToStorage(board: Board): Promise<void> {
    try {
      console.log(`Saving board to storage: board="${board.name}"`);

      // Save all columns and their tasks
      for (const column of board.columns) {
        console.log(`Saving column: board="${board.name}", column="${column.name}"`);

        // Ensure column directory exists
        const columnDir = this.fileSystem.getColumnDirectory(board.name, column.name);
        await this.fileSystem.ensureDirectoryExists(columnDir);

        // Save column metadata
        await this.persistence.saveColumnMetadata(board.name, column.name, {
          id: column.id,
          name: column.name,
          position: column.position,
          limit: column.limit,
          created_at: column.created_at,
        });

        // Save all tasks in this column
        for (const task of column.tasks) {
          await this.persistence.saveTaskToColumn(board.name, column.name, {
            id: task.id,
            title: task.title,
            description: task.description,
            parent_id: task.parent_id,
            created_at: task.created_at,
            moved_in_progress_at: task.moved_in_progress_at,
            moved_in_done_at: task.moved_in_done_at,
            worked_on_for: task.worked_on_for,
          });
        }
      }

      console.log(`Successfully saved board to storage: board="${board.name}"`);
    } catch (error) {
      console.error(`Failed to save board to storage: board="${board.name}"`, error);
      throw error;
    }
  }
}
