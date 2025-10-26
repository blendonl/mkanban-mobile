/**
 * Board Persistence Layer
 * Low-level file operations for saving/loading board data
 * Ported from Python: src/infrastructure/storage/board_persistence.py
 */

import { FileSystemManager } from "./FileSystemManager";
import { MarkdownParser } from "./MarkdownParser";
import {
  findTaskFileById,
  getBoardDirectoryPath,
  getColumnDirectoryPath,
  getTasksDirectoryPath,
  cleanupTaskFiles,
  getUniqueFilename,
} from "./FileOperations";
import { TaskId } from "../../core/types";
import { BOARD_FILENAME, COLUMN_METADATA_FILENAME } from "../../core/constants";
import { getTitleFilename } from "../../utils/stringUtils";
import { now } from "../../utils/dateUtils";
import { FileSystemObserver } from "../../core/FileSystemObserver";

export interface TaskData {
  id: TaskId;
  title: string;
  description?: string;
  parent_id?: string | null;
  created_at?: Date;
  moved_in_progress_at?: Date | null;
  moved_in_done_at?: Date | null;
  worked_on_for?: string | null; // Format: "HH:MM"
  [key: string]: any; // Allow additional metadata
}

export interface ColumnData {
  id: string;
  name: string;
  position: number;
  limit?: number | null;
  created_at?: Date;
}

export class BoardPersistence implements FileSystemObserver {
  private fileSystem: FileSystemManager;
  private parser: MarkdownParser;
  private boardsDir: string;

  constructor(fileSystem: FileSystemManager, parser: MarkdownParser) {
    this.fileSystem = fileSystem;
    this.parser = parser;
    this.boardsDir = fileSystem.getBoardsDirectory();

    // Register as observer to receive boards directory changes
    fileSystem.addObserver(this);
  }

  /**
   * Called when the boards directory path changes
   * Updates the cached boards directory path
   */
  onBoardsDirectoryChanged(newPath: string): void {
    console.log(`BoardPersistence: Boards directory changed from ${this.boardsDir} to ${newPath}`);
    this.boardsDir = newPath;
  }

  /**
   * Save a task to a column's tasks directory
   */
  async saveTaskToColumn(
    boardName: string,
    columnName: string,
    taskData: TaskData
  ): Promise<void> {
    try {
      const boardDir = getBoardDirectoryPath(this.boardsDir, boardName);
      const columnDir = getColumnDirectoryPath(boardDir, columnName);
      const tasksDir = getTasksDirectoryPath(columnDir);

      // Ensure tasks directory exists
      await this.fileSystem.ensureDirectoryExists(tasksDir);

      const taskId = taskData.id;
      const title = taskData.title;
      const content = taskData.description || "";

      // Generate new filename: {id}-{title}.md (lowercase)
      const titlePart = getTitleFilename(title);
      const newFilename = `${taskId.toLowerCase()}-${titlePart}`;
      const newTaskFile = `${tasksDir}${newFilename}.md`;

      // Check if task already exists with different filename
      const oldTaskFile = await findTaskFileById(
        this.fileSystem,
        this.parser,
        tasksDir,
        taskId
      );

      if (oldTaskFile) {
        const currentFilename = this.getFileStem(oldTaskFile);
        if (currentFilename !== newFilename) {
          // Need to rename - check for collisions
          const newFileExists = await this.fileSystem.fileExists(newTaskFile);
          if (newFileExists && newTaskFile !== oldTaskFile) {
            // Collision - get unique filename
            const uniqueFilename = await getUniqueFilename(
              this.fileSystem,
              this.parser,
              newTaskFile,
              taskId
            );
            const uniquePath = `${tasksDir}${uniqueFilename}.md`;
            await this.fileSystem.renameFile(oldTaskFile, uniquePath);
          } else {
            // Safe to rename
            await this.fileSystem.renameFile(oldTaskFile, newTaskFile);
          }
        }
      }

      // Extract metadata (exclude title and description which become content)
      const metadata: Record<string, any> = {};
      for (const [key, value] of Object.entries(taskData)) {
        if (key !== "title" && key !== "description") {
          metadata[key] = value;
        }
      }

      // Ensure created_at has a default
      if (!metadata.created_at) {
        metadata.created_at = now();
      }

      // Save the task with metadata
      const finalTaskFile = oldTaskFile || newTaskFile;
      await this.parser.saveTaskWithMetadata(finalTaskFile, title, content, metadata);
    } catch (error) {
      throw new Error(
        `Failed to save task "${taskData.title}" to column "${columnName}": ${error}`
      );
    }
  }

  /**
   * Delete a task from a column
   */
  async deleteTaskFromColumn(
    boardName: string,
    columnName: string,
    taskId: TaskId
  ): Promise<boolean> {
    try {
      const boardDir = getBoardDirectoryPath(this.boardsDir, boardName);
      const columnDir = getColumnDirectoryPath(boardDir, columnName);
      const tasksDir = getTasksDirectoryPath(columnDir);

      const taskFile = await findTaskFileById(
        this.fileSystem,
        this.parser,
        tasksDir,
        taskId
      );

      if (taskFile) {
        return await this.fileSystem.deleteFile(taskFile);
      }

      return false;
    } catch (error) {
      console.error(`Failed to delete task ${taskId} from column ${columnName}:`, error);
      return false;
    }
  }

  /**
   * Move a task between columns
   */
  async moveTaskBetweenColumns(
    boardName: string,
    oldColumnName: string,
    newColumnName: string,
    taskData: TaskData
  ): Promise<boolean> {
    try {
      const boardDir = getBoardDirectoryPath(this.boardsDir, boardName);
      const oldColumnDir = getColumnDirectoryPath(boardDir, oldColumnName);
      const newColumnDir = getColumnDirectoryPath(boardDir, newColumnName);
      const oldTasksDir = getTasksDirectoryPath(oldColumnDir);

      // Ensure new column directory exists
      await this.fileSystem.ensureDirectoryExists(newColumnDir);

      const taskId = taskData.id;

      // Find old task file
      const oldTaskFile = await findTaskFileById(
        this.fileSystem,
        this.parser,
        oldTasksDir,
        taskId
      );

      if (oldTaskFile) {
        // Save to new column
        await this.saveTaskToColumn(boardName, newColumnName, taskData);

        // Delete from old column
        await this.fileSystem.deleteFile(oldTaskFile);
        return true;
      }

      return false;
    } catch (error) {
      console.error(
        `Failed to move task ${taskData.id} from ${oldColumnName} to ${newColumnName}:`,
        error
      );
      return false;
    }
  }

  /**
   * Save column metadata
   */
  async saveColumnMetadata(
    boardName: string,
    columnName: string,
    columnData: ColumnData
  ): Promise<void> {
    try {
      const boardDir = getBoardDirectoryPath(this.boardsDir, boardName);
      const columnDir = getColumnDirectoryPath(boardDir, columnName);

      await this.fileSystem.ensureDirectoryExists(columnDir);

      const columnMetadataFile = `${columnDir}${COLUMN_METADATA_FILENAME}`;

      const metadata: Record<string, any> = {
        position: columnData.position,
        created_at: columnData.created_at || now(),
      };

      if (columnData.limit !== undefined && columnData.limit !== null) {
        metadata.limit = columnData.limit;
      }

      await this.parser.saveColumnMetadata(columnMetadataFile, columnName, metadata);
    } catch (error) {
      throw new Error(`Failed to save column metadata for "${columnName}": ${error}`);
    }
  }

  /**
   * Clean up orphaned task files in a column
   */
  async cleanupColumn(
    boardName: string,
    columnName: string,
    currentTaskIds: Set<TaskId>
  ): Promise<void> {
    try {
      const boardDir = getBoardDirectoryPath(this.boardsDir, boardName);
      const columnDir = getColumnDirectoryPath(boardDir, columnName);
      const tasksDir = getTasksDirectoryPath(columnDir);

      await cleanupTaskFiles(this.fileSystem, this.parser, tasksDir, currentTaskIds);
    } catch (error) {
      console.error(`Failed to cleanup column ${columnName}:`, error);
    }
  }

  /**
   * Get the path to a board's kanban.md file
   */
  getBoardFilePath(boardName: string): string {
    const boardDir = getBoardDirectoryPath(this.boardsDir, boardName);
    return `${boardDir}${BOARD_FILENAME}`;
  }

  /**
   * List all board directories
   */
  async listBoardDirectories(): Promise<string[]> {
    try {
      const exists = await this.fileSystem.directoryExists(this.boardsDir);
      if (!exists) {
        return [];
      }

      return await this.fileSystem.listDirectories(this.boardsDir);
    } catch (error) {
      console.error(`Failed to list board directories:`, error);
      return [];
    }
  }

  /**
   * Get file stem (filename without extension)
   */
  private getFileStem(filePath: string): string {
    const parts = filePath.split("/");
    const filename = parts[parts.length - 1];
    return filename.replace(/\.md$/, "");
  }
}
