export interface FileState {
  path: string;
  modifiedTime: number;
  isDirectory: boolean;
}

export interface FileChange {
  path: string;
  type: 'added' | 'modified' | 'deleted';
  isDirectory: boolean;
}

export interface IChangeDetector {
  scanDirectory(dirPath: string): Promise<Map<string, FileState>>;
  detectChanges(currentState: Map<string, FileState>): FileChange[];
  updateState(currentState: Map<string, FileState>): void;
  reset(): void;
  getState(): Map<string, FileState>;
}
