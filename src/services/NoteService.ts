import { Note, NoteType, EntityType } from '../domain/entities/Note';
import { NoteRepository, NoteFilter } from '../domain/repositories/NoteRepository';
import { ValidationService } from './ValidationService';
import { NoteId, ProjectId, TaskId, BoardId } from '../core/types';
import { ValidationError } from '../core/exceptions';

export class NoteService {
  constructor(
    private repository: NoteRepository,
    private validator: ValidationService
  ) {}

  async getAllNotes(): Promise<Note[]> {
    return this.repository.loadAllNotes();
  }

  async getNoteById(noteId: NoteId): Promise<Note | null> {
    return this.repository.loadNoteById(noteId);
  }

  async getNotesByProject(projectId: ProjectId): Promise<Note[]> {
    return this.repository.loadNotesByProject(projectId);
  }

  async getNotesByBoard(boardId: BoardId): Promise<Note[]> {
    return this.repository.loadNotesByBoard(boardId);
  }

  async getNotesByTask(taskId: TaskId): Promise<Note[]> {
    return this.repository.loadNotesByTask(taskId);
  }

  async getNotesByType(noteType: NoteType): Promise<Note[]> {
    return this.repository.loadNotesByType(noteType);
  }

  async getNotesFiltered(filter: NoteFilter): Promise<Note[]> {
    return this.repository.loadNotesFiltered(filter);
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
    if (!title || title.trim().length === 0) {
      throw new ValidationError('Note title cannot be empty');
    }

    const note = new Note({
      title: title.trim(),
      content,
      project_ids: options.projectIds || (options.projectId ? [options.projectId] : []),
      board_ids: options.boardIds || (options.boardId ? [options.boardId] : []),
      task_ids: options.taskIds || (options.taskId ? [options.taskId] : []),
      note_type: options.noteType || 'general',
      tags: options.tags || [],
    });

    await this.repository.saveNote(note);
    return note;
  }

  async createDailyNote(date?: Date): Promise<Note> {
    const d = date || new Date();
    const dateStr = d.toISOString().split('T')[0];

    const existingNote = await this.repository.loadDailyNote(dateStr);
    if (existingNote) {
      return existingNote;
    }

    const note = Note.createDaily(d);
    await this.repository.saveNote(note);
    return note;
  }

  async createMeetingNote(title: string, projectId?: ProjectId): Promise<Note> {
    if (!title || title.trim().length === 0) {
      throw new ValidationError('Meeting title cannot be empty');
    }

    const note = Note.createMeeting(title.trim(), projectId || undefined);
    await this.repository.saveNote(note);
    return note;
  }

  async createTaskNote(taskId: TaskId, title: string, projectId?: ProjectId): Promise<Note> {
    const note = new Note({
      title: title.trim() || 'Task Notes',
      content: `# ${title}\n\n`,
      task_ids: [taskId],
      project_ids: projectId ? [projectId] : [],
      note_type: 'task',
    });

    await this.repository.saveNote(note);
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
    const note = await this.repository.loadNoteById(noteId);
    if (!note) return null;

    if (updates.title !== undefined) {
      if (!updates.title || updates.title.trim().length === 0) {
        throw new ValidationError('Note title cannot be empty');
      }
      note.title = updates.title.trim();
    }

    if (updates.content !== undefined) {
      note.content = updates.content;
    }

    if (updates.tags !== undefined) {
      note.tags = updates.tags;
    }

    if (updates.projectIds !== undefined) {
      note.project_ids = updates.projectIds;
    }

    if (updates.boardIds !== undefined) {
      note.board_ids = updates.boardIds;
    }

    if (updates.taskIds !== undefined) {
      note.task_ids = updates.taskIds;
    }

    await this.repository.saveNote(note);
    return note;
  }

  async saveNote(note: Note): Promise<void> {
    await this.repository.saveNote(note);
  }

  async deleteNote(noteId: NoteId): Promise<boolean> {
    return this.repository.deleteNote(noteId);
  }

  async searchNotes(query: string): Promise<Note[]> {
    if (!query || query.trim().length === 0) {
      return [];
    }
    return this.repository.searchNotes(query.trim());
  }

  async getTodaysDailyNote(): Promise<Note> {
    return this.createDailyNote(new Date());
  }

  async getRecentNotes(limit: number = 10): Promise<Note[]> {
    const notes = await this.repository.loadAllNotes();
    return notes.slice(0, limit);
  }

  async addTagToNote(noteId: NoteId, tag: string): Promise<Note | null> {
    const note = await this.repository.loadNoteById(noteId);
    if (!note) return null;

    note.addTag(tag);
    await this.repository.saveNote(note);
    return note;
  }

  async removeTagFromNote(noteId: NoteId, tag: string): Promise<Note | null> {
    const note = await this.repository.loadNoteById(noteId);
    if (!note) return null;

    note.removeTag(tag);
    await this.repository.saveNote(note);
    return note;
  }

  async addEntityToNote(noteId: NoteId, entityType: EntityType, entityId: string): Promise<Note | null> {
    const note = await this.repository.loadNoteById(noteId);
    if (!note) return null;

    switch (entityType) {
      case 'project':
        note.addProject(entityId as ProjectId);
        break;
      case 'board':
        note.addBoard(entityId as BoardId);
        break;
      case 'task':
        note.addTask(entityId as TaskId);
        break;
    }

    await this.repository.saveNote(note);
    return note;
  }

  async removeEntityFromNote(noteId: NoteId, entityType: EntityType, entityId: string): Promise<Note | null> {
    const note = await this.repository.loadNoteById(noteId);
    if (!note) return null;

    switch (entityType) {
      case 'project':
        note.removeProject(entityId as ProjectId);
        break;
      case 'board':
        note.removeBoard(entityId as BoardId);
        break;
      case 'task':
        note.removeTask(entityId as TaskId);
        break;
    }

    await this.repository.saveNote(note);
    return note;
  }

  async getNotesForMultipleProjects(projectIds: ProjectId[]): Promise<Note[]> {
    const allNotes = await this.repository.loadAllNotes();
    return allNotes.filter(note =>
      projectIds.some(id => note.project_ids.includes(id))
    );
  }

  async getNotesForMultipleBoards(boardIds: BoardId[]): Promise<Note[]> {
    const allNotes = await this.repository.loadAllNotes();
    return allNotes.filter(note =>
      boardIds.some(id => note.board_ids.includes(id))
    );
  }
}
