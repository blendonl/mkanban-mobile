import { Note, NoteType } from '../entities/Note';
import { NoteId, ProjectId, TaskId } from '../../core/types';

export interface NoteFilter {
  projectId?: ProjectId;
  taskId?: TaskId;
  noteType?: NoteType;
  tags?: string[];
  searchQuery?: string;
}

export interface NoteRepository {
  loadAllNotes(): Promise<Note[]>;

  loadNoteById(noteId: NoteId): Promise<Note | null>;

  loadNotesByProject(projectId: ProjectId): Promise<Note[]>;

  loadNotesByTask(taskId: TaskId): Promise<Note[]>;

  loadNotesByType(noteType: NoteType): Promise<Note[]>;

  loadDailyNote(date: string): Promise<Note | null>;

  loadNotesFiltered(filter: NoteFilter): Promise<Note[]>;

  saveNote(note: Note): Promise<void>;

  deleteNote(noteId: NoteId): Promise<boolean>;

  searchNotes(query: string): Promise<Note[]>;

  getGlobalNotesDirectory(): string;

  getProjectNotesDirectory(projectId: ProjectId): string;
}
