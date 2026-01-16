/**
 * File System Manager for MKanban mobile app
 * Wraps expo-file-system operations and provides utility methods
 * Ported from Python: src/utils/file_utils.py and pathlib.Path operations
 */

import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from "react-native";
import { getSafeFilename } from "../../utils/stringUtils";
import { FileSystemObserver } from "../../core/FileSystemObserver";
import { getDefaultExternalDataPath, getDefaultExternalBoardsPath, hasExternalStorageAccess, StoragePermission } from "./StoragePermission";
import { logger } from "../../utils/logger";

export type NoteType = 'general' | 'meetings' | 'daily';

export class FileSystemManager {
  private baseDirectory: string;
  private customDataDirectory?: string;
  private observers: Set<FileSystemObserver> = new Set();
  private initialized: boolean = false;
  private usingExternalStorage: boolean = false;

  constructor(baseDirectory?: string) {
    const docDir = FileSystem.documentDirectory || '';
    this.baseDirectory = baseDirectory || docDir.endsWith('/') ? docDir.slice(0, -1) : docDir;
  }

  async initialize(): Promise<void> {
    if (this.initialized) {
      logger.debug('[FileSystemManager] Already initialized');
      return;
    }

    logger.debug('[FileSystemManager] Starting initialization...');

    if (Platform.OS === 'android') {
      logger.debug('[FileSystemManager] Android detected, checking external storage...');

      try {
        const hasAccess = await hasExternalStorageAccess();
        logger.debug('[FileSystemManager] External storage access:', hasAccess);

        if (hasAccess) {
          const externalDataPath = await getDefaultExternalDataPath();
          logger.debug('[FileSystemManager] External data path:', externalDataPath);

          if (externalDataPath) {
            const normalizedPath = externalDataPath.endsWith('/') ? externalDataPath.slice(0, -1) : externalDataPath;
            logger.debug('[FileSystemManager] Creating external directories...');

            const dataCreated = await StoragePermission.createDirectory(normalizedPath);
            logger.debug('[FileSystemManager] Data directory created:', dataCreated);

            const boardsPath = `${normalizedPath}/boards`;
            const boardsCreated = await StoragePermission.createDirectory(boardsPath);
            logger.debug('[FileSystemManager] Boards directory created:', boardsCreated);

            if (dataCreated && boardsCreated) {
              this.baseDirectory = normalizedPath;
              this.usingExternalStorage = true;
              logger.debug('[FileSystemManager] Using external storage:', this.baseDirectory);
            } else {
              logger.debug('[FileSystemManager] Failed to create external storage directories, falling back to internal storage');
            }
          } else {
            logger.debug('[FileSystemManager] No external data path available, using internal storage');
          }
        } else {
          logger.debug('[FileSystemManager] External storage not accessible, using internal storage');
        }
      } catch (error) {
        logger.error('[FileSystemManager] Error checking external storage, falling back to internal:', error);
      }
    }

    if (!this.usingExternalStorage) {
      logger.debug('[FileSystemManager] Setting up internal storage...');
      try {
        await this.ensureDirectoryExists(this.getDataDirectory());
        logger.debug('[FileSystemManager] Internal storage directory created:', this.getDataDirectory());
      } catch (error) {
        logger.error('[FileSystemManager] Failed to create internal storage directory:', error);
        throw new Error(`Failed to initialize file system: ${error}`);
      }
    }

    this.initialized = true;
    logger.debug('[FileSystemManager] Initialization complete');
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  isUsingExternalStorage(): boolean {
    return this.usingExternalStorage;
  }

  getDataDirectory(): string {
    if (this.customDataDirectory) {
      return this.customDataDirectory;
    }
    if (this.usingExternalStorage) {
      return `${this.baseDirectory}/`;
    }
    return `${this.baseDirectory}/mkanban/`;
  }

  setDataDirectory(path: string): void {
    if (!path || typeof path !== 'string') {
      throw new Error('Data directory path cannot be empty');
    }
    const normalizedPath = path.endsWith('/') ? path : `${path}/`;
    this.customDataDirectory = normalizedPath;
  }

  getProjectsDirectory(): string {
    return `${this.getDataDirectory()}projects/`;
  }

  getProjectDirectory(projectSlug: string): string {
    const safeSlug = getSafeFilename(projectSlug);
    return `${this.getProjectsDirectory()}${safeSlug}/`;
  }

  getProjectBoardsDirectory(projectSlug: string): string {
    return `${this.getProjectDirectory(projectSlug)}boards/`;
  }

  getProjectNotesDirectory(projectSlug: string, noteType?: NoteType): string {
    const notesDir = `${this.getProjectDirectory(projectSlug)}notes/`;
    if (noteType) {
      return `${notesDir}${noteType}/`;
    }
    return notesDir;
  }

  getProjectTimeDirectory(projectSlug: string): string {
    return `${this.getProjectDirectory(projectSlug)}time/logs/`;
  }

  getGlobalDirectory(): string {
    return `${this.getDataDirectory()}global/`;
  }

  getGoalsDirectory(): string {
    return `${this.getGlobalDirectory()}goals/`;
  }

  getGlobalNotesDirectory(noteType?: NoteType): string {
    const notesDir = `${this.getGlobalDirectory()}notes/`;
    if (noteType) {
      return `${notesDir}${noteType}/`;
    }
    return notesDir;
  }

  getAgendaDirectory(): string {
    return `${this.getDataDirectory()}agenda/`;
  }

  getAgendaYearDirectory(year: string | number): string {
    return `${this.getAgendaDirectory()}${year}/`;
  }

  getAgendaMonthDirectory(year: string | number, month: string | number): string {
    const monthStr = month.toString().padStart(2, '0');
    return `${this.getAgendaYearDirectory(year)}${monthStr}/`;
  }

  getAgendaDayDirectory(year: string | number, month: string | number, day: string | number): string {
    const dayStr = day.toString().padStart(2, '0');
    return `${this.getAgendaMonthDirectory(year, month)}${dayStr}/`;
  }

  getAgendaDayDirectoryFromDate(date: string): string {
    const [year, month, day] = date.split('-');
    return this.getAgendaDayDirectory(year, month, day);
  }

  async listProjects(): Promise<string[]> {
    try {
      const projectsDir = this.getProjectsDirectory();
      const dirExists = await this.directoryExists(projectsDir);
      if (!dirExists) {
        return [];
      }

      const subdirs = await this.listDirectories(projectsDir);
      const projects: string[] = [];

      for (const subdirPath of subdirs) {
        const projectYmlPath = `${subdirPath}project.yml`;
        const exists = await this.fileExists(projectYmlPath);
        if (exists) {
          const projectSlug = subdirPath.split('/').filter(p => p).pop() || '';
          projects.push(projectSlug);
        }
      }

      return projects;
    } catch (error) {
      logger.error(`Failed to list projects:`, error);
      return [];
    }
  }

  async createProjectStructure(projectSlug: string): Promise<void> {
    const projectDir = this.getProjectDirectory(projectSlug);
    await this.ensureDirectoryExists(projectDir);
    await this.ensureDirectoryExists(this.getProjectBoardsDirectory(projectSlug));
    await this.ensureDirectoryExists(this.getProjectNotesDirectory(projectSlug, 'general'));
    await this.ensureDirectoryExists(this.getProjectNotesDirectory(projectSlug, 'meetings'));
    await this.ensureDirectoryExists(this.getProjectNotesDirectory(projectSlug, 'daily'));
    await this.ensureDirectoryExists(this.getProjectTimeDirectory(projectSlug));
  }


  async ensureDirectoryExists(path: string): Promise<void> {
    try {
      if (Platform.OS === 'android' && this.isExternalStoragePath(path)) {
        const created = await StoragePermission.createDirectory(path);
        if (!created) {
          throw new Error(`Failed to create directory ${path}`);
        }
        return;
      }

      const info = await FileSystem.getInfoAsync(path);
      if (!info.exists) {
        await FileSystem.makeDirectoryAsync(path, { intermediates: true });
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

  private isExternalStoragePath(path: string): boolean {
    return path.startsWith('/storage/emulated/') || path.startsWith('/sdcard/');
  }

  async readFile(path: string): Promise<string> {
    try {
      if (Platform.OS === 'android' && this.isExternalStoragePath(path)) {
        return await StoragePermission.readFile(path);
      }
      const info = await FileSystem.getInfoAsync(path);
      if (!info.exists) {
        throw new Error(`File does not exist: ${path}`);
      }
      return await FileSystem.readAsStringAsync(path);
    } catch (error) {
      throw new Error(`Failed to read file ${path}: ${error}`);
    }
  }

  async writeFile(path: string, content: string): Promise<void> {
    try {
      const parentDir = this.getParentDirectory(path);
      await this.ensureDirectoryExists(parentDir);

      if (Platform.OS === 'android' && this.isExternalStoragePath(path)) {
        const success = await StoragePermission.writeFile(path, content);
        if (!success) {
          throw new Error(`Native write failed for ${path}`);
        }
        return;
      }

      await FileSystem.writeAsStringAsync(path, content);
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

  async deleteFile(path: string): Promise<boolean> {
    try {
      if (Platform.OS === 'android' && this.isExternalStoragePath(path)) {
        return await StoragePermission.deleteFile(path);
      }
      const info = await FileSystem.getInfoAsync(path);
      if (info.exists) {
        await FileSystem.deleteAsync(path, { idempotent: true });
        return true;
      }
      return false;
    } catch (error) {
      logger.error(`Failed to delete file ${path}:`, error);
      return false;
    }
  }

  async renameFile(oldPath: string, newPath: string): Promise<boolean> {
    try {
      if (Platform.OS === 'android' && this.isExternalStoragePath(oldPath)) {
        const newParentDir = this.getParentDirectory(newPath);
        await this.ensureDirectoryExists(newParentDir);
        return await StoragePermission.moveFile(oldPath, newPath);
      }

      const info = await FileSystem.getInfoAsync(oldPath);
      if (!info.exists) {
        return false;
      }

      const newParentDir = this.getParentDirectory(newPath);
      await this.ensureDirectoryExists(newParentDir);

      await FileSystem.moveAsync({ from: oldPath, to: newPath });
      return true;
    } catch (error) {
      logger.error(`Failed to rename file ${oldPath} to ${newPath}:`, error);
      return false;
    }
  }

  async deleteDirectory(path: string): Promise<boolean> {
    try {
      const info = await FileSystem.getInfoAsync(path);
      if (info.exists) {
        await FileSystem.deleteAsync(path, { idempotent: true });
        return true;
      }
      return false;
    } catch (error) {
      logger.error(`Failed to delete directory ${path}:`, error);
      return false;
    }
  }

  async listFiles(directory: string, pattern?: string): Promise<string[]> {
    try {
      const normalizedDir = directory.endsWith('/') ? directory : `${directory}/`;

      if (Platform.OS === 'android' && this.isExternalStoragePath(directory)) {
        const items = await StoragePermission.listDirectory(directory);
        const files = items
          .filter(item => !item.isDirectory)
          .map(item => `${normalizedDir}${item.name}`);

        if (!pattern) {
          return files;
        }

        const regexPattern = this.globToRegex(pattern);
        return files.filter(filePath => {
          const name = filePath.split('/').pop() || '';
          return regexPattern.test(name);
        });
      }

      const info = await FileSystem.getInfoAsync(directory);
      if (!info.exists) {
        return [];
      }

      const items = await FileSystem.readDirectoryAsync(directory);
      const regexPattern = pattern ? this.globToRegex(pattern) : null;

      const filteredItems = items
        .filter(name => !name.startsWith('.'))
        .filter(name => !regexPattern || regexPattern.test(name));

      const fileChecks = await Promise.all(
        filteredItems.map(async (name) => {
          const fullPath = `${normalizedDir}${name}`;
          const itemInfo = await FileSystem.getInfoAsync(fullPath);

          if (itemInfo.exists && !itemInfo.isDirectory) {
            return fullPath;
          }

          return null;
        })
      );

      return fileChecks.filter((path): path is string => path !== null);
    } catch (error) {
      throw new Error(`Failed to list files in ${directory}: ${error}`);
    }
  }

  async listDirectories(directory: string): Promise<string[]> {
    try {
      const normalizedDir = directory.endsWith('/') ? directory : `${directory}/`;

      if (Platform.OS === 'android' && this.isExternalStoragePath(directory)) {
        const items = await StoragePermission.listDirectory(directory);
        return items
          .filter(item => item.isDirectory)
          .map(item => `${normalizedDir}${item.name}/`);
      }

      const info = await FileSystem.getInfoAsync(directory);
      if (!info.exists) {
        return [];
      }

      const items = await FileSystem.readDirectoryAsync(directory);

      const dirChecks = await Promise.all(
        items.map(async (name) => {
          const fullPath = `${normalizedDir}${name}`;
          const itemInfo = await FileSystem.getInfoAsync(fullPath);
          return itemInfo.exists && itemInfo.isDirectory ? `${fullPath}/` : null;
        })
      );

      return dirChecks.filter((path): path is string => path !== null);
    } catch (error) {
      throw new Error(`Failed to list directories in ${directory}: ${error}`);
    }
  }

  async fileExists(path: string): Promise<boolean> {
    try {
      if (Platform.OS === 'android' && this.isExternalStoragePath(path)) {
        return await StoragePermission.fileExists(path);
      }
      const info = await FileSystem.getInfoAsync(path);
      return info.exists && !info.isDirectory;
    } catch (error) {
      return false;
    }
  }

  async directoryExists(path: string): Promise<boolean> {
    try {
      if (Platform.OS === 'android' && this.isExternalStoragePath(path)) {
        return await StoragePermission.directoryExists(path);
      }
      const info = await FileSystem.getInfoAsync(path);
      return info.exists && info.isDirectory === true;
    } catch (error) {
      return false;
    }
  }

  async isDirectoryWritable(path: string): Promise<boolean> {
    try {
      await this.ensureDirectoryExists(path);

      const testFileName = `.write-test-${Date.now()}`;
      const normalizedPath = path.endsWith('/') ? path : `${path}/`;
      const testFilePath = `${normalizedPath}${testFileName}`;
      await FileSystem.writeAsStringAsync(testFilePath, 'test');

      const info = await FileSystem.getInfoAsync(testFilePath);
      if (info.exists) {
        await FileSystem.deleteAsync(testFilePath, { idempotent: true });
      }

      return true;
    } catch (error) {
      logger.error(`Directory ${path} is not writable:`, error);
      return false;
    }
  }

  async listBoards(boardsDirectory: string): Promise<string[]> {
    try {
      const info = await FileSystem.getInfoAsync(boardsDirectory);
      if (!info.exists) {
        return [];
      }

      const subdirs = await this.listDirectories(boardsDirectory);
      const boards: string[] = [];

      for (const subdirPath of subdirs) {
        const kanbanFilePath = `${subdirPath}kanban.md`;
        const kanbanInfo = await FileSystem.getInfoAsync(kanbanFilePath);
        if (kanbanInfo.exists) {
          const boardName = subdirPath.split('/').filter(p => p).pop() || '';
          boards.push(boardName);
        }
      }

      return boards;
    } catch (error) {
      logger.error(`Failed to list boards in ${boardsDirectory}:`, error);
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

  async copyFile(sourcePath: string, destPath: string): Promise<boolean> {
    try {
      if (Platform.OS === 'android' && this.isExternalStoragePath(sourcePath)) {
        const destParent = this.getParentDirectory(destPath);
        await this.ensureDirectoryExists(destParent);
        return await StoragePermission.copyFile(sourcePath, destPath);
      }

      const info = await FileSystem.getInfoAsync(sourcePath);
      if (!info.exists) {
        logger.error(`Source file does not exist: ${sourcePath}`);
        return false;
      }

      const destParent = this.getParentDirectory(destPath);
      await this.ensureDirectoryExists(destParent);

      await FileSystem.copyAsync({ from: sourcePath, to: destPath });

      return true;
    } catch (error) {
      logger.error(`Failed to copy file from ${sourcePath} to ${destPath}:`, error);
      return false;
    }
  }

  async copyDirectory(
    sourcePath: string,
    destPath: string,
    onProgress?: (current: number, total: number) => void
  ): Promise<{ success: boolean; copiedFiles: number; errors: string[] }> {
    const errors: string[] = [];
    let copiedFiles = 0;

    try {
      const info = await FileSystem.getInfoAsync(sourcePath);
      if (!info.exists) {
        errors.push(`Source directory does not exist: ${sourcePath}`);
        return { success: false, copiedFiles: 0, errors };
      }

      await this.ensureDirectoryExists(destPath);

      const normalizedSrc = sourcePath.endsWith('/') ? sourcePath : `${sourcePath}/`;
      const normalizedDest = destPath.endsWith('/') ? destPath : `${destPath}/`;
      const items = await FileSystem.readDirectoryAsync(sourcePath);
      const totalItems = items.length;

      for (let i = 0; i < items.length; i++) {
        const itemName = items[i];
        const srcItemPath = `${normalizedSrc}${itemName}`;
        const destItemPath = `${normalizedDest}${itemName}`;

        try {
          const itemInfo = await FileSystem.getInfoAsync(srcItemPath);
          if (!itemInfo.isDirectory) {
            const success = await this.copyFile(srcItemPath, destItemPath);
            if (success) {
              copiedFiles++;
            } else {
              errors.push(`Failed to copy file: ${srcItemPath}`);
            }
          } else {
            const subResult = await this.copyDirectory(
              `${srcItemPath}/`,
              `${destItemPath}/`,
              onProgress
            );
            copiedFiles += subResult.copiedFiles;
            errors.push(...subResult.errors);
          }
        } catch (error) {
          errors.push(`Error copying ${srcItemPath}: ${error}`);
        }

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

  async getFileInfo(path: string): Promise<FileSystem.FileInfo> {
    return await FileSystem.getInfoAsync(path);
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
        logger.error('Error notifying observer of boards directory change:', error);
      }
    });
  }
}

// Export a singleton instance for convenience
export const fileSystemManager = new FileSystemManager();
