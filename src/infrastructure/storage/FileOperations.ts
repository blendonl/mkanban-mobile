/**
 * File Operations helper utilities
 * Ported from Python: src/infrastructure/storage/file_operations.py
 */

import { FileSystemManager } from "./FileSystemManager";
import { MarkdownParser, Metadata } from "./MarkdownParser";
import { TaskId } from "../../core/types";
import { getSafeFilename } from "../../utils/stringUtils";
import { COLUMN_METADATA_FILENAME, COLUMNS_FOLDER_NAME, TASKS_FOLDER_NAME } from "../../core/constants";

/**
 * Find a task file by its ID in a column directory
 * Searches through subdirectories (task folders) and checks task.md frontmatter
 */
export async function findTaskFileById(
  fileSystem: FileSystemManager,
  parser: MarkdownParser,
  columnDir: string,
  taskId: TaskId
): Promise<string | null> {
  try {
    const tasksDir = getTasksDirectoryPath(columnDir);
    const exists = await fileSystem.directoryExists(tasksDir);
    if (!exists) {
      return null;
    }

    const taskFolders = await fileSystem.listDirectories(tasksDir);

    for (const taskFolder of taskFolders) {
      const taskFile = `${taskFolder}task.md`;
      const taskFileExists = await fileSystem.fileExists(taskFile);

      if (!taskFileExists) {
        continue;
      }

      try {
        const parsed = await parser.parseTaskMetadata(taskFile);
        const fileId = parsed.metadata.id;
        if (fileId === taskId) {
          return taskFile;
        }
      } catch (error) {
        continue;
      }
    }

    return null;
  } catch (error) {
    throw new Error(`Failed to search for task ${taskId} in ${columnDir}: ${error}`);
  }
}

/**
 * Get unique folder name for a task, handling collisions
 * Returns folder name (not full path)
 */
export async function getUniqueFolderName(
  fileSystem: FileSystemManager,
  parser: MarkdownParser,
  columnDir: string,
  taskTitle: string,
  taskId: TaskId,
  maxRetries: number = 100
): Promise<string> {
  const baseName = getSafeFilename(taskTitle);
  const tasksDir = getTasksDirectoryPath(columnDir);
  const basePath = `${tasksDir}${baseName}/`;
  const exists = await fileSystem.directoryExists(basePath);

  if (!exists) {
    return baseName;
  }

  const taskFile = `${basePath}task.md`;
  if (await fileSystem.fileExists(taskFile)) {
    try {
      const parsed = await parser.parseTaskMetadata(taskFile);
      if (parsed.metadata.id === taskId) {
        return baseName;
      }
    } catch (error) {
      // Corrupted file, treat as collision
    }
  }

  for (let i = 2; i <= maxRetries; i++) {
    const testName = `${baseName}-${i}`;
    const testPath = `${tasksDir}${testName}/`;
    const testExists = await fileSystem.directoryExists(testPath);

    if (!testExists) {
      return testName;
    }

    const testTaskFile = `${testPath}task.md`;
    if (await fileSystem.fileExists(testTaskFile)) {
      try {
        const parsed = await parser.parseTaskMetadata(testTaskFile);
        if (parsed.metadata.id === taskId) {
          return testName;
        }
      } catch (error) {
        continue;
      }
    }
  }

  return `${baseName}-${taskId.toLowerCase()}`;
}

/**
 * Get board directory path from board name
 */
export function getBoardDirectoryPath(boardsDir: string, boardName: string): string {
  const safeName = getSafeFilename(boardName);
  return `${boardsDir}${safeName}/`;
}

/**
 * Get column directory path from board directory and column name
 * New structure: {boardDir}/columns/{columnName}/
 */
export function getColumnDirectoryPath(boardDir: string, columnName: string): string {
  const safeName = getSafeFilename(columnName);
  return `${boardDir}${COLUMNS_FOLDER_NAME}/${safeName}/`;
}

/**
 * Get tasks directory path from column directory
 * New structure: {columnDir}/tasks/
 */
export function getTasksDirectoryPath(columnDir: string): string {
  return `${columnDir}${TASKS_FOLDER_NAME}/`;
}

/**
 * Clean up orphaned task folders in a column directory
 * Removes folders for tasks not in currentTaskIds
 */
export async function cleanupTaskFiles(
  fileSystem: FileSystemManager,
  parser: MarkdownParser,
  columnDir: string,
  currentTaskIds: Set<TaskId>
): Promise<void> {
  try {
    const tasksDir = getTasksDirectoryPath(columnDir);
    const exists = await fileSystem.directoryExists(tasksDir);
    if (!exists) {
      return;
    }

    const taskFolders = await fileSystem.listDirectories(tasksDir);

    for (const taskFolder of taskFolders) {
      const taskFile = `${taskFolder}task.md`;

      if (!await fileSystem.fileExists(taskFile)) {
        continue;
      }

      try {
        const parsed = await parser.parseTaskMetadata(taskFile);
        const taskId = parsed.metadata.id;

        if (taskId && !currentTaskIds.has(taskId)) {
          await fileSystem.deleteDirectory(taskFolder);
        }
      } catch (error) {
        console.warn(`Skipping corrupted task folder ${taskFolder}:`, error);
      }
    }
  } catch (error) {
    console.error(`Failed to cleanup task files in ${columnDir}:`, error);
  }
}

/**
 * @deprecated Use getUniqueFolderName instead for new folder-based structure
 * Get unique filename to avoid collisions
 * If file exists with different task ID, append counter or task ID
 */
export async function getUniqueFilename(
  fileSystem: FileSystemManager,
  parser: MarkdownParser,
  basePath: string,
  taskId: TaskId,
  maxRetries: number = 100
): Promise<string> {
  const baseName = getFileStem(basePath);
  const extension = ".md";
  const directory = getParentDirectory(basePath);

  const baseFullPath = `${directory}${baseName}${extension}`;
  const baseExists = await fileSystem.fileExists(baseFullPath);

  if (!baseExists) {
    return baseName;
  }

  try {
    const parsed = await parser.parseTaskMetadata(baseFullPath);
    const existingTaskId = parsed.metadata.id || baseName;
    if (existingTaskId === taskId) {
      return baseName;
    }
  } catch (error) {
    // Treat as collision
  }

  for (let counter = 1; counter <= maxRetries; counter++) {
    const testName = `${baseName}_${counter}`;
    const testPath = `${directory}${testName}${extension}`;
    const testExists = await fileSystem.fileExists(testPath);

    if (!testExists) {
      return testName;
    }

    try {
      const parsed = await parser.parseTaskMetadata(testPath);
      const existingTaskId = parsed.metadata.id || testName;
      if (existingTaskId === taskId) {
        return testName;
      }
    } catch (error) {
      continue;
    }
  }

  return `${baseName}_${taskId.substring(0, 8)}`;
}

/**
 * Get file stem (filename without extension)
 */
function getFileStem(filePath: string): string {
  const parts = filePath.split("/");
  const filename = parts[parts.length - 1];
  return filename.replace(/\.md$/, "");
}

/**
 * Get parent directory from path
 */
function getParentDirectory(filePath: string): string {
  const parts = filePath.split("/");
  parts.pop(); // Remove filename
  return parts.join("/") + "/";
}
