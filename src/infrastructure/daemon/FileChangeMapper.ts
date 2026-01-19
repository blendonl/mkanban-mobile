import { FileSystemManager } from '../storage/FileSystemManager';
import { IFileChangeMapper, MappedFileChange, EntityType, FileChange } from './interfaces';

export class FileChangeMapper implements IFileChangeMapper {
  constructor(private fileSystemManager: FileSystemManager) {}

  map(change: FileChange): MappedFileChange | null {
    if (change.isDirectory) {
      return null;
    }

    const entityType = this.determineEntityType(change.path);
    if (!entityType) {
      return null;
    }

    return {
      entityType,
      changeType: change.type,
      filePath: change.path,
    };
  }

  private determineEntityType(filePath: string): EntityType | null {
    const dataDir = this.fileSystemManager.getDataDirectory();
    const relativePath = filePath.replace(dataDir, '');

    if (relativePath.includes('/agenda/')) {
      return 'agenda';
    }

    if (relativePath.includes('/notes/')) {
      return 'note';
    }

    if (relativePath.includes('/boards/') && relativePath.endsWith('.md')) {
      return 'board';
    }

    if (relativePath.includes('/projects/') && relativePath.endsWith('project.md')) {
      return 'project';
    }

    return null;
  }
}
