/**
 * File System Manager for MKanban mobile app
 * Wraps react-native-fs operations and provides utility methods
 * Ported from Python: src/utils/file_utils.py and pathlib.Path operations
 */

import RNFS from 'react-native-fs';
import { Platform } from "react-native";
import { getSafeFilename } from "../../utils/stringUtils";
import { FileSystemObserver } from "../../core/FileSystemObserver";

export class FileSystemManager {
  private baseDirectory: string;
  private customBoardsDirectory?: string;
  private observers: Set<FileSystemObserver> = new Set();

  constructor(baseDirectory?: string, customBoardsDirectory?: string) {
    // Use react-native-fs document directory as base, or custom directory for testing
    this.baseDirectory = baseDirectory || RNFS.DocumentDirectoryPath;
    this.customBoardsDirectory = customBoardsDirectory;
  }

  /**
   * Get the boards root directory path
   * Returns custom path if set, otherwise returns default
   */
  getBoardsDirectory(): string {
    if (this.customBoardsDirectory) {
      return this.customBoardsDirectory;
    }
    return this.getDefaultBoardsDirectory();
  }

  /**
   * Set a custom boards directory
   * @param path The custom directory path (must be absolute and end with /)
   */
  setBoardsDirectory(path: string): void {
    // Validate path
    if (!path || typeof path !== 'string') {
      throw new Error('Boards directory path cannot be empty');
    }
    // Ensure path ends with /
    const normalizedPath = path.endsWith('/') ? path : `${path}/`;

    // Only notify observers if the path actually changed
    if (this.customBoardsDirectory !== normalizedPath) {
      this.customBoardsDirectory = normalizedPath;
      this.notifyBoardsDirectoryChanged(normalizedPath);
    }
  }

  /**
   * Reset to default boards directory
   */
  resetToDefaultBoardsDirectory(): void {
    if (this.customBoardsDirectory !== undefined) {
      this.customBoardsDirectory = undefined;
      this.notifyBoardsDirectoryChanged(this.getDefaultBoardsDirectory());
    }
  }

  /**
   * Check if using a custom boards directory
   */
  isUsingCustomBoardsDirectory(): boolean {
    return !!this.customBoardsDirectory;
  }

  /**
   * Get the default boards directory (without custom override)
   *
   * Android: Uses shared storage (/storage/emulated/0/mkanban/boards/)
   *          Requires MANAGE_EXTERNAL_STORAGE permission on Android 11+
   *          Boards are accessible via file managers
   *
   * iOS: Uses app-private Documents directory
   *      Boards stored in app sandbox
   *
   * Note: The app requests MANAGE_EXTERNAL_STORAGE permission on first launch
   * for Android 11+. Users must grant "All files access" in settings.
   */
  getDefaultBoardsDirectory(): string {
    if (Platform.OS === 'android') {
      // Use shared storage on Android (accessible via file managers)
      // react-native-fs uses paths without file:// prefix
      return `${RNFS.ExternalStorageDirectoryPath}/mkanban/boards/`;
    }
    // Use app Documents directory on iOS
    return `${this.baseDirectory}/boards/`;
  }

  /**
   * Get a specific board's directory path
   */
  getBoardDirectory(boardName: string): string {
    const safeFilename = getSafeFilename(boardName);
    return `${this.getBoardsDirectory()}${safeFilename}/`;
  }

  /**
   * Get a column directory path within a board
   */
  getColumnDirectory(boardName: string, columnName: string): string {
    const boardDir = this.getBoardDirectory(boardName);
    const safeFilename = getSafeFilename(columnName);
    return `${boardDir}${safeFilename}/`;
  }

  /**
   * Ensure a directory exists, creating it recursively if needed
   * Equivalent to Python's Path.mkdir(parents=True, exist_ok=True)
   */
  async ensureDirectoryExists(path: string): Promise<void> {
    try {
      const exists = await RNFS.exists(path);
      if (!exists) {
        await RNFS.mkdir(path);
      }
    } catch (error) {
      const errorMessage = String(error);
      if (errorMessage.includes('WRITE') || errorMessage.includes('permission') || errorMessage.includes('EACCES')) {
        throw new Error(
          `Permission denied: Cannot create directory ${path}. ` +
          `Please grant storage permissions in Settings > Apps > MKanban > Permissions.`
        );
      }
      throw new Error(`Failed to create directory ${path}: ${error}`);
    }
  }

  /**
   * Read file contents as a string
   * Equivalent to Python's open(file, 'r').read()
   */
  async readFile(path: string): Promise<string> {
    try {
      const exists = await RNFS.exists(path);
      if (!exists) {
        throw new Error(`File does not exist: ${path}`);
      }
      return await RNFS.readFile(path, 'utf8');
    } catch (error) {
      throw new Error(`Failed to read file ${path}: ${error}`);
    }
  }

  /**
   * Write content to a file
   * Equivalent to Python's open(file, 'w').write(content)
   */
  async writeFile(path: string, content: string): Promise<void> {
    try {
      // Ensure parent directory exists
      const parentDir = this.getParentDirectory(path);
      await this.ensureDirectoryExists(parentDir);

      await RNFS.writeFile(path, content, 'utf8');
    } catch (error) {
      const errorMessage = String(error);
      if (errorMessage.includes('WRITE') || errorMessage.includes('permission') || errorMessage.includes('EACCES')) {
        throw new Error(
          `Permission denied: Cannot write to ${path}. ` +
          `Please grant storage permissions in Settings > Apps > MKanban > Permissions.`
        );
      }
      throw new Error(`Failed to write file ${path}: ${error}`);
    }
  }

  /**
   * Delete a file
   * Equivalent to Python's Path.unlink()
   */
  async deleteFile(path: string): Promise<boolean> {
    try {
      const exists = await RNFS.exists(path);
      if (exists) {
        await RNFS.unlink(path);
        return true;
      }
      return false;
    } catch (error) {
      console.error(`Failed to delete file ${path}:`, error);
      return false;
    }
  }

  /**
   * Rename/move a file
   * Equivalent to Python's Path.rename()
   */
  async renameFile(oldPath: string, newPath: string): Promise<boolean> {
    try {
      const exists = await RNFS.exists(oldPath);
      if (!exists) {
        return false;
      }

      // Ensure parent directory of new path exists
      const newParentDir = this.getParentDirectory(newPath);
      await this.ensureDirectoryExists(newParentDir);

      await RNFS.moveFile(oldPath, newPath);
      return true;
    } catch (error) {
      console.error(`Failed to rename file ${oldPath} to ${newPath}:`, error);
      return false;
    }
  }

  /**
   * Delete a directory and all its contents
   * Equivalent to Python's shutil.rmtree()
   */
  async deleteDirectory(path: string): Promise<boolean> {
    try {
      const exists = await RNFS.exists(path);
      if (exists) {
        await RNFS.unlink(path);
        return true;
      }
      return false;
    } catch (error) {
      console.error(`Failed to delete directory ${path}:`, error);
      return false;
    }
  }

  /**
   * List files in a directory, optionally filtering by pattern
   * Equivalent to Python's Path.glob(pattern)
   */
  async listFiles(directory: string, pattern?: string): Promise<string[]> {
    try {
      const exists = await RNFS.exists(directory);
      if (!exists) {
        return [];
      }

      const items = await RNFS.readDir(directory);
      // Filter to only files (not directories)
      const files = items.filter(item => item.isFile());

      if (!pattern) {
        return files.map(file => file.path);
      }

      // Simple glob pattern matching (supports *.md, *.txt, etc.)
      const regexPattern = this.globToRegex(pattern);
      const filteredFiles = files.filter(file => {
        const fileName = file.name;
        return regexPattern.test(fileName);
      });

      return filteredFiles.map(file => file.path);
    } catch (error) {
      throw new Error(`Failed to list files in ${directory}: ${error}`);
    }
  }

  /**
   * List directories in a directory
   */
  async listDirectories(directory: string): Promise<string[]> {
    try {
      const exists = await RNFS.exists(directory);
      if (!exists) {
        return [];
      }

      const items = await RNFS.readDir(directory);
      // Filter to only directories (not files)
      const directories = items.filter(item => item.isDirectory());

      return directories.map(d => d.path + '/');
    } catch (error) {
      throw new Error(`Failed to list directories in ${directory}: ${error}`);
    }
  }

  /**
   * Check if a file exists
   */
  async fileExists(path: string): Promise<boolean> {
    try {
      const exists = await RNFS.exists(path);
      if (!exists) return false;

      const stat = await RNFS.stat(path);
      return stat.isFile();
    } catch (error) {
      return false;
    }
  }

  /**
   * Check if a directory exists
   */
  async directoryExists(path: string): Promise<boolean> {
    try {
      const exists = await RNFS.exists(path);
      if (!exists) return false;

      const stat = await RNFS.stat(path);
      return stat.isDirectory();
    } catch (error) {
      return false;
    }
  }

  /**
   * Check if a directory is writable
   * Attempts to create a test file to verify write permissions
   */
  async isDirectoryWritable(path: string): Promise<boolean> {
    try {
      // Ensure directory exists first
      await this.ensureDirectoryExists(path);

      // Try to write a test file
      const testFileName = `.write-test-${Date.now()}`;
      const testFilePath = `${path}${testFileName}`;
      await RNFS.writeFile(testFilePath, 'test', 'utf8');

      // Clean up test file
      const exists = await RNFS.exists(testFilePath);
      if (exists) {
        await RNFS.unlink(testFilePath);
      }

      return true;
    } catch (error) {
      console.error(`Directory ${path} is not writable:`, error);
      return false;
    }
  }

  /**
   * List all boards in a given directory
   * A board is identified by the presence of a kanban.md file
   */
  async listBoards(boardsDirectory: string): Promise<string[]> {
    try {
      const exists = await RNFS.exists(boardsDirectory);
      if (!exists) {
        return [];
      }

      const subdirs = await this.listDirectories(boardsDirectory);
      const boards: string[] = [];

      for (const subdirPath of subdirs) {
        const kanbanFilePath = `${subdirPath}kanban.md`;
        const kanbanExists = await RNFS.exists(kanbanFilePath);
        if (kanbanExists) {
          // Extract board name from path
          const boardName = subdirPath.split('/').filter(p => p).pop() || '';
          boards.push(boardName);
        }
      }

      return boards;
    } catch (error) {
      console.error(`Failed to list boards in ${boardsDirectory}:`, error);
      return [];
    }
  }

  /**
   * Check if a directory has any boards
   */
  async hasBoards(boardsDirectory: string): Promise<boolean> {
    const boards = await this.listBoards(boardsDirectory);
    return boards.length > 0;
  }

  /**
   * Copy a file from source to destination
   */
  async copyFile(sourcePath: string, destPath: string): Promise<boolean> {
    try {
      const exists = await RNFS.exists(sourcePath);
      if (!exists) {
        console.error(`Source file does not exist: ${sourcePath}`);
        return false;
      }

      // Ensure destination parent directory exists
      const destParent = this.getParentDirectory(destPath);
      await this.ensureDirectoryExists(destParent);

      // Copy file
      await RNFS.copyFile(sourcePath, destPath);

      return true;
    } catch (error) {
      console.error(`Failed to copy file from ${sourcePath} to ${destPath}:`, error);
      return false;
    }
  }

  /**
   * Recursively copy a directory and all its contents
   * @param sourcePath Source directory path
   * @param destPath Destination directory path
   * @param onProgress Optional callback for progress updates (current, total)
   */
  async copyDirectory(
    sourcePath: string,
    destPath: string,
    onProgress?: (current: number, total: number) => void
  ): Promise<{ success: boolean; copiedFiles: number; errors: string[] }> {
    const errors: string[] = [];
    let copiedFiles = 0;

    try {
      const exists = await RNFS.exists(sourcePath);
      if (!exists) {
        errors.push(`Source directory does not exist: ${sourcePath}`);
        return { success: false, copiedFiles: 0, errors };
      }

      // Create destination directory
      await this.ensureDirectoryExists(destPath);

      // Get all items in source directory
      const items = await RNFS.readDir(sourcePath);
      const totalItems = items.length;

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const itemName = item.name;
        const destItemPath = `${destPath}${itemName}`;

        try {
          if (item.isFile()) {
            // Copy file
            const success = await this.copyFile(item.path, destItemPath);
            if (success) {
              copiedFiles++;
            } else {
              errors.push(`Failed to copy file: ${item.path}`);
            }
          } else if (item.isDirectory()) {
            // Recursively copy subdirectory
            const subResult = await this.copyDirectory(
              `${item.path}/`,
              `${destItemPath}/`,
              onProgress
            );
            copiedFiles += subResult.copiedFiles;
            errors.push(...subResult.errors);
          }
        } catch (error) {
          errors.push(`Error copying ${item.path}: ${error}`);
        }

        // Report progress
        if (onProgress) {
          onProgress(i + 1, totalItems);
        }
      }

      return {
        success: errors.length === 0,
        copiedFiles,
        errors
      };
    } catch (error) {
      errors.push(`Failed to copy directory: ${error}`);
      return { success: false, copiedFiles, errors };
    }
  }

  /**
   * Get parent directory path from a file path
   * Equivalent to Python's Path.parent
   */
  private getParentDirectory(path: string): string {
    const parts = path.split("/");
    parts.pop(); // Remove filename
    return parts.join("/") + "/";
  }

  /**
   * Convert a glob pattern to a regular expression
   * Supports basic glob patterns: *, ?, [abc]
   */
  private globToRegex(pattern: string): RegExp {
    // Escape special regex characters except glob wildcards
    let regexPattern = pattern
      .replace(/[.+^${}()|[\]\\]/g, "\\$&") // Escape special chars
      .replace(/\*/g, ".*") // * matches any characters
      .replace(/\?/g, "."); // ? matches single character

    return new RegExp(`^${regexPattern}$`);
  }

  /**
   * Get file information (size, modification time, etc.)
   */
  async getFileInfo(path: string): Promise<any> {
    return await RNFS.stat(path);
  }

  /**
   * Get the base directory used by this manager
   */
  getBaseDirectory(): string {
    return this.baseDirectory;
  }

  /**
   * Register an observer to be notified when boards directory changes
   * @param observer The observer to register
   */
  addObserver(observer: FileSystemObserver): void {
    this.observers.add(observer);
  }

  /**
   * Unregister an observer
   * @param observer The observer to unregister
   */
  removeObserver(observer: FileSystemObserver): void {
    this.observers.delete(observer);
  }

  /**
   * Notify all observers that the boards directory has changed
   * @param newPath The new boards directory path
   */
  private notifyBoardsDirectoryChanged(newPath: string): void {
    this.observers.forEach(observer => {
      try {
        observer.onBoardsDirectoryChanged(newPath);
      } catch (error) {
        console.error('Error notifying observer of boards directory change:', error);
      }
    });
  }
}

// Export a singleton instance for convenience
export const fileSystemManager = new FileSystemManager();
