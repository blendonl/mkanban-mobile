import { File, Directory } from 'expo-file-system';
import { IChangeDetector, FileState, FileChange } from './interfaces';

export { FileState, FileChange };

export class FileChangeDetector implements IChangeDetector {
  private previousState: Map<string, FileState> = new Map();
  private visitedDirs: Set<string> = new Set();

  /**
   * Scan a directory and return current file states
   */
  async scanDirectory(dirPath: string): Promise<Map<string, FileState>> {
    const fileStates = new Map<string, FileState>();

    try {
      const normalizedPath = this._ensureFileUri(dirPath);
      const dir = new Directory(normalizedPath);

      if (!dir.exists) {
        console.log(`[FileChangeDetector] Directory does not exist: ${dirPath}`);
        return fileStates;
      }

      this.visitedDirs.clear();
      console.log(`[FileChangeDetector] Starting scan of: ${dirPath}`);
      await this._scanRecursive(dir.uri, fileStates, 0);
      console.log(`[FileChangeDetector] Scan complete. Found ${fileStates.size} items`);
    } catch (error) {
      console.error(`Error scanning directory ${dirPath}:`, error);
    }

    return fileStates;
  }

  private async _yieldToMainThread(): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, 0));
  }

  /**
   * Recursively scan directories and collect file states
   */
  private async _scanRecursive(
    dirUri: string,
    fileStates: Map<string, FileState>,
    depth: number
  ): Promise<void> {
    if (depth > 20) {
      console.warn(`[FileChangeDetector] Max depth reached at: ${dirUri}`);
      return;
    }

    if (this.visitedDirs.has(dirUri)) {
      console.warn(`[FileChangeDetector] Circular reference detected: ${dirUri}`);
      return;
    }

    this.visitedDirs.add(dirUri);

    try {
      const dir = new Directory(dirUri);
      const items = dir.list();

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const itemUri = item.uri;
        const isDirectory = item instanceof Directory;

        let modifiedTime = 0;
        if (item instanceof File) {
          modifiedTime = item.modificationTime || 0;
        } else if (item instanceof Directory) {
          modifiedTime = 0;
        }

        fileStates.set(itemUri, {
          path: itemUri,
          modifiedTime,
          isDirectory,
        });

        if (isDirectory) {
          await this._scanRecursive(itemUri, fileStates, depth + 1);
        }

        if (i > 0 && i % 100 === 0) {
          await this._yieldToMainThread();
        }
      }
    } catch (error) {
      console.error(`Error scanning ${dirUri}:`, error);
    }
  }

  /**
   * Compare current state with previous state and detect changes
   */
  detectChanges(currentState: Map<string, FileState>): FileChange[] {
    const changes: FileChange[] = [];

    // Find added and modified files
    for (const [path, current] of currentState.entries()) {
      const previous = this.previousState.get(path);

      if (!previous) {
        // File was added
        changes.push({
          path,
          type: 'added',
          isDirectory: current.isDirectory,
        });
      } else if (current.modifiedTime !== previous.modifiedTime) {
        // File was modified
        changes.push({
          path,
          type: 'modified',
          isDirectory: current.isDirectory,
        });
      }
    }

    // Find deleted files
    for (const [path, previous] of this.previousState.entries()) {
      if (!currentState.has(path)) {
        changes.push({
          path,
          type: 'deleted',
          isDirectory: previous.isDirectory,
        });
      }
    }

    return changes;
  }

  /**
   * Update the previous state to the current state
   */
  updateState(currentState: Map<string, FileState>): void {
    this.previousState = new Map(currentState);
  }

  /**
   * Reset the detector state
   */
  reset(): void {
    this.previousState.clear();
    this.visitedDirs.clear();
  }

  /**
   * Get the current tracked state
   */
  getState(): Map<string, FileState> {
    return new Map(this.previousState);
  }

  private _ensureFileUri(path: string): string {
    if (path.startsWith('file://')) {
      return path;
    }
    if (path.startsWith('content://')) {
      return path;
    }
    return `file://${path}`;
  }
}
