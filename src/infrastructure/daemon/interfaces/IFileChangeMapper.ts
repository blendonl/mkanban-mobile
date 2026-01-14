import { FileChange } from './IChangeDetector';

export type EntityType = 'note' | 'agenda' | 'board' | 'project';

export interface MappedFileChange {
  entityType: EntityType;
  changeType: 'added' | 'modified' | 'deleted';
  filePath: string;
}

export interface IFileChangeMapper {
  map(change: FileChange): MappedFileChange | null;
}
