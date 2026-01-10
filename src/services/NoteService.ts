import { Note, NoteType } from '../domain/entities/Note';
import { NoteRepository, NoteFilter } from '../domain/repositories/NoteRepository';
import { ValidationService } from './ValidationService';
import { NoteId, ProjectId, TaskId } from '../core/types';
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
      taskId?: TaskId;
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
      project_id: options.projectId || null,
      task_id: options.taskId || null,
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
      task_id: taskId,
      project_id: projectId || null,
      note_type: 'task',
    });

    await this.repository.saveNote(note);
    return note;
  }

  async updateNote(noteId: NoteId, updates: Partial<{
    title: string;
    content: string;
    tags: string[];
    projectId: ProjectId | null;
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

    if (updates.projectId !== undefined) {
      note.project_id = updates.projectId;
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
}
