import { Note, NoteType, EntityType } from '../domain/entities/Note';
import { NoteFilter } from '../domain/repositories/NoteRepository';
import { NoteService } from './NoteService';
import { NoteId, ProjectId, TaskId, BoardId } from '../core/types';
import { getCacheManager } from '../infrastructure/cache/CacheManager';
import { EntityCache } from '../infrastructure/cache/EntityCache';
import { getEventBus, EventSubscription, FileChangeEventPayload } from '../core/EventBus';

export class CachedNoteService {
  private cache: EntityCache<Note>;
  private listCache: Note[] | null = null;
  private eventSubscriptions: EventSubscription[] = [];

  constructor(private baseService: NoteService) {
    this.cache = getCacheManager().getCache('notes');
    this.subscribeToInvalidation();
  }

  private subscribeToInvalidation(): void {
    const eventBus = getEventBus();

    const fileChangedSub = eventBus.subscribe('file_changed', (payload: FileChangeEventPayload) => {
      if (payload.entityType === 'note') {
        this.invalidateCache();
      }
    });

    this.eventSubscriptions.push(fileChangedSub);
  }

  private invalidateCache(): void {
    this.listCache = null;
    this.cache.clear();
    getEventBus().publishSync('notes_invalidated', { timestamp: new Date() });
  }

  async getAllNotes(): Promise<Note[]> {
    const cached = this.cache.getList();
    if (cached) {
      return cached;
    }

    const notes = await this.baseService.getAllNotes();
    this.cache.setList(notes);
    return notes;
  }

  async getNoteById(noteId: NoteId): Promise<Note | null> {
    const cached = this.cache.get(noteId);
    if (cached) {
      return cached;
    }

    const note = await this.baseService.getNoteById(noteId);
    if (note) {
      this.cache.set(noteId, note);
    }
    return note;
  }

  async getNotesByProject(projectId: ProjectId): Promise<Note[]> {
    return this.baseService.getNotesByProject(projectId);
  }

  async getNotesByBoard(boardId: BoardId): Promise<Note[]> {
    return this.baseService.getNotesByBoard(boardId);
  }

  async getNotesByTask(taskId: TaskId): Promise<Note[]> {
    return this.baseService.getNotesByTask(taskId);
  }

  async getNotesByType(noteType: NoteType): Promise<Note[]> {
    return this.baseService.getNotesByType(noteType);
  }

  async getNotesFiltered(filter: NoteFilter): Promise<Note[]> {
    return this.baseService.getNotesFiltered(filter);
  }

  async createNote(
    title: string,
    content: string = "",
    options: {
      projectId?: ProjectId;
      projectIds?: ProjectId[];
      boardId?: BoardId;
      boardIds?: BoardId[];
      taskId?: TaskId;
      taskIds?: TaskId[];
      noteType?: NoteType;
      tags?: string[];
    } = {}
  ): Promise<Note> {
    const note = await this.baseService.createNote(title, content, options);
    this.invalidateCache();
    return note;
  }

  async createDailyNote(date?: Date): Promise<Note> {
    const note = await this.baseService.createDailyNote(date);
    this.invalidateCache();
    return note;
  }

  async createMeetingNote(title: string, projectId?: ProjectId): Promise<Note> {
    const note = await this.baseService.createMeetingNote(title, projectId);
    this.invalidateCache();
    return note;
  }

  async createTaskNote(taskId: TaskId, title: string, projectId?: ProjectId): Promise<Note> {
    const note = await this.baseService.createTaskNote(taskId, title, projectId);
    this.invalidateCache();
    return note;
  }

  async updateNote(noteId: NoteId, updates: Partial<{
    title: string;
    content: string;
    tags: string[];
    projectIds: ProjectId[];
    boardIds: BoardId[];
    taskIds: TaskId[];
  }>): Promise<Note | null> {
    const note = await this.baseService.updateNote(noteId, updates);
    this.invalidateCache();
    return note;
  }

  async saveNote(note: Note): Promise<void> {
    await this.baseService.saveNote(note);
    this.invalidateCache();
  }

  async deleteNote(noteId: NoteId): Promise<boolean> {
    const result = await this.baseService.deleteNote(noteId);
    this.invalidateCache();
    return result;
  }

  async searchNotes(query: string): Promise<Note[]> {
    return this.baseService.searchNotes(query);
  }

  async getTodaysDailyNote(): Promise<Note> {
    return this.baseService.getTodaysDailyNote();
  }

  async getRecentNotes(limit: number = 10): Promise<Note[]> {
    const cached = this.cache.getList();
    if (cached) {
      return cached.slice(0, limit);
    }
    return this.baseService.getRecentNotes(limit);
  }

  async addTagToNote(noteId: NoteId, tag: string): Promise<Note | null> {
    const note = await this.baseService.addTagToNote(noteId, tag);
    this.invalidateCache();
    return note;
  }

  async removeTagFromNote(noteId: NoteId, tag: string): Promise<Note | null> {
    const note = await this.baseService.removeTagFromNote(noteId, tag);
    this.invalidateCache();
    return note;
  }

  async addEntityToNote(noteId: NoteId, entityType: EntityType, entityId: string): Promise<Note | null> {
    const note = await this.baseService.addEntityToNote(noteId, entityType, entityId);
    this.invalidateCache();
    return note;
  }

  async removeEntityFromNote(noteId: NoteId, entityType: EntityType, entityId: string): Promise<Note | null> {
    const note = await this.baseService.removeEntityFromNote(noteId, entityType, entityId);
    this.invalidateCache();
    return note;
  }

  destroy(): void {
    this.eventSubscriptions.forEach((sub) => sub.unsubscribe());
    this.eventSubscriptions = [];
  }
}
