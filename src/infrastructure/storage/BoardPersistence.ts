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
  getUniqueFolderName,
} from "./FileOperations";
import { TaskId } from "../../core/types";
import { BOARD_FILENAME, COLUMN_METADATA_FILENAME } from "../../core/constants";
import { getTitleFilename } from "../../utils/stringUtils";
import { now } from "../../utils/dateUtils";

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

export class BoardPersistence {
  private fileSystem: FileSystemManager;
  private parser: MarkdownParser;

  constructor(fileSystem: FileSystemManager, parser: MarkdownParser) {
    this.fileSystem = fileSystem;
    this.parser = parser;
  }

  /**
   * Save a task to a column's tasks directory
   */
  async saveTaskToColumn(
    boardsDir: string,
    boardName: string,
    columnName: string,
    taskData: TaskData
  ): Promise<void> {
    try {
      const boardDir = getBoardDirectoryPath(boardsDir, boardName);
      const columnDir = getColumnDirectoryPath(boardDir, columnName);
      const tasksDir = getTasksDirectoryPath(columnDir);

      await this.fileSystem.ensureDirectoryExists(columnDir);
      await this.fileSystem.ensureDirectoryExists(tasksDir);

      const taskId = taskData.id;
      const title = taskData.title;
      const content = taskData.description || "";

      const oldTaskFile = await findTaskFileById(
        this.fileSystem,
        this.parser,
        columnDir,
        taskId
      );

      const folderName = await getUniqueFolderName(
        this.fileSystem,
        this.parser,
        columnDir,
        title,
        taskId
      );

      const taskFolder = `${tasksDir}${folderName}/`;
      const newTaskFile = `${taskFolder}task.md`;

      if (oldTaskFile && oldTaskFile !== newTaskFile) {
        const oldFolder = this.getParentDirectory(oldTaskFile);
        if (oldFolder !== taskFolder) {
          await this.fileSystem.renameFile(oldFolder, taskFolder);
        }
      } else if (!oldTaskFile) {
        await this.fileSystem.ensureDirectoryExists(taskFolder);
      }

      const metadata: Record<string, any> = {};
      for (const [key, value] of Object.entries(taskData)) {
        if (key !== "title" && key !== "description") {
          metadata[key] = value;
        }
      }

      if (!metadata.created_at) {
        metadata.created_at = now();
      }

      await this.parser.saveTaskWithMetadata(newTaskFile, title, content, metadata);
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
    boardsDir: string,
    boardName: string,
    columnName: string,
    taskId: TaskId
  ): Promise<boolean> {
    try {
      const boardDir = getBoardDirectoryPath(boardsDir, boardName);
      const columnDir = getColumnDirectoryPath(boardDir, columnName);

      const taskFile = await findTaskFileById(
        this.fileSystem,
        this.parser,
        columnDir,
        taskId
      );

      if (taskFile) {
        const taskFolder = this.getParentDirectory(taskFile);
        return await this.fileSystem.deleteDirectory(taskFolder);
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
    boardsDir: string,
    boardName: string,
    oldColumnName: string,
    newColumnName: string,
    taskData: TaskData
  ): Promise<boolean> {
    try {
      const boardDir = getBoardDirectoryPath(boardsDir, boardName);
      const oldColumnDir = getColumnDirectoryPath(boardDir, oldColumnName);
      const newColumnDir = getColumnDirectoryPath(boardDir, newColumnName);
      const newTasksDir = getTasksDirectoryPath(newColumnDir);

      await this.fileSystem.ensureDirectoryExists(newColumnDir);
      await this.fileSystem.ensureDirectoryExists(newTasksDir);

      const taskId = taskData.id;

      const oldTaskFile = await findTaskFileById(
        this.fileSystem,
        this.parser,
        oldColumnDir,
        taskId
      );

      if (oldTaskFile) {
        const oldTaskFolder = this.getParentDirectory(oldTaskFile);

        const folderName = await getUniqueFolderName(
          this.fileSystem,
          this.parser,
          newColumnDir,
          taskData.title,
          taskId
        );

        const newTaskFolder = `${newTasksDir}${folderName}/`;

        await this.fileSystem.renameFile(oldTaskFolder, newTaskFolder);

        await this.saveTaskToColumn(boardsDir, boardName, newColumnName, taskData);

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
    boardsDir: string,
    boardName: string,
    columnName: string,
    columnData: ColumnData
  ): Promise<void> {
    try {
      const boardDir = getBoardDirectoryPath(boardsDir, boardName);
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
    boardsDir: string,
    boardName: string,
    columnName: string,
    currentTaskIds: Set<TaskId>
  ): Promise<void> {
    try {
      const boardDir = getBoardDirectoryPath(boardsDir, boardName);
      const columnDir = getColumnDirectoryPath(boardDir, columnName);

      await cleanupTaskFiles(this.fileSystem, this.parser, columnDir, currentTaskIds);
    } catch (error) {
      console.error(`Failed to cleanup column ${columnName}:`, error);
    }
  }

  /**
   * Get the path to a board's board.md file
   */
  getBoardFilePath(boardsDir: string, boardName: string): string {
    const boardDir = getBoardDirectoryPath(boardsDir, boardName);
    return `${boardDir}${BOARD_FILENAME}`;
  }

  /**
   * List all board directories
   */
  async listBoardDirectories(boardsDir: string): Promise<string[]> {
    try {
      const exists = await this.fileSystem.directoryExists(boardsDir);
      if (!exists) {
        return [];
      }

      return await this.fileSystem.listDirectories(boardsDir);
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

  /**
   * Get parent directory from a path
   */
  private getParentDirectory(filePath: string): string {
    const parts = filePath.split("/");
    parts.pop();
    return parts.join("/") + "/";
  }
}
