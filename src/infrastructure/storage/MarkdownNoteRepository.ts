import { FileSystemManager, NoteType as FSNoteType } from "./FileSystemManager";
import { MarkdownParser } from "./MarkdownParser";
import { NoteRepository, NoteFilter } from "../../domain/repositories/NoteRepository";
import { Note, NoteType } from "../../domain/entities/Note";
import { NoteId, ProjectId, TaskId } from "../../core/types";
import { getSafeFilename } from "../../utils/stringUtils";

export class MarkdownNoteRepository implements NoteRepository {
  private fileSystem: FileSystemManager;
  private parser: MarkdownParser;

  constructor(fileSystem: FileSystemManager) {
    this.fileSystem = fileSystem;
    this.parser = new MarkdownParser(fileSystem);
  }

  async loadAllNotes(): Promise<Note[]> {
    const notes: Note[] = [];

    const globalNotes = await this.loadGlobalNotes();
    notes.push(...globalNotes);

    const projectSlugs = await this.fileSystem.listProjects();
    for (const slug of projectSlugs) {
      const projectNotes = await this.loadProjectNotes(slug);
      notes.push(...projectNotes);
    }

    return notes.sort((a, b) => b.updated_at.getTime() - a.updated_at.getTime());
  }

  private async loadGlobalNotes(): Promise<Note[]> {
    const notes: Note[] = [];
    const globalDir = this.fileSystem.getGlobalNotesDirectory();

    const noteTypes: FSNoteType[] = ['general', 'meetings', 'daily'];
    for (const noteType of noteTypes) {
      const typeDir = this.fileSystem.getGlobalNotesDirectory(noteType);
      const typeNotes = await this.loadNotesFromDirectory(typeDir, null, this.mapFSNoteType(noteType));
      notes.push(...typeNotes);
    }

    return notes;
  }

  private async loadProjectNotes(projectSlug: string): Promise<Note[]> {
    const notes: Note[] = [];

    const noteTypes: FSNoteType[] = ['general', 'meetings', 'daily'];
    for (const noteType of noteTypes) {
      const typeDir = this.fileSystem.getProjectNotesDirectory(projectSlug, noteType);
      const typeNotes = await this.loadNotesFromDirectory(typeDir, projectSlug, this.mapFSNoteType(noteType));
      notes.push(...typeNotes);
    }

    return notes;
  }

  private mapFSNoteType(fsType: FSNoteType): NoteType {
    switch (fsType) {
      case 'meetings': return 'meeting';
      case 'daily': return 'daily';
      default: return 'general';
    }
  }

  private async loadNotesFromDirectory(
    directory: string,
    projectId: string | null,
    defaultNoteType: NoteType
  ): Promise<Note[]> {
    const notes: Note[] = [];

    try {
      const exists = await this.fileSystem.directoryExists(directory);
      if (!exists) return notes;

      const files = await this.fileSystem.listFiles(directory, "*.md");

      for (const filePath of files) {
        try {
          const note = await this.loadNoteFromFile(filePath, projectId, defaultNoteType);
          if (note) notes.push(note);
        } catch (error) {
          console.warn(`Failed to load note from ${filePath}:`, error);
        }
      }
    } catch (error) {
      console.warn(`Failed to list notes in ${directory}:`, error);
    }

    return notes;
  }

  private async loadNoteFromFile(
    filePath: string,
    projectId: string | null,
    defaultNoteType: NoteType
  ): Promise<Note | null> {
    try {
      const fileContent = await this.fileSystem.readFile(filePath);
      const parsed = await this.parser.parseTaskMetadata(filePath);

      const note = Note.fromDict({
        ...parsed.metadata,
        title: parsed.metadata.title || parsed.title,
        project_id: parsed.metadata.project_id || projectId,
        note_type: parsed.metadata.note_type || defaultNoteType,
        file_path: filePath,
      }, parsed.content);

      return note;
    } catch (error) {
      console.error(`Failed to parse note from ${filePath}:`, error);
      return null;
    }
  }

  async loadNoteById(noteId: NoteId): Promise<Note | null> {
    const allNotes = await this.loadAllNotes();
    return allNotes.find(note => note.id === noteId) || null;
  }

  async loadNotesByProject(projectId: ProjectId): Promise<Note[]> {
    const allNotes = await this.loadAllNotes();
    return allNotes.filter(note => note.project_id === projectId);
  }

  async loadNotesByTask(taskId: TaskId): Promise<Note[]> {
    const allNotes = await this.loadAllNotes();
    return allNotes.filter(note => note.task_id === taskId);
  }

  async loadNotesByType(noteType: NoteType): Promise<Note[]> {
    const allNotes = await this.loadAllNotes();
    return allNotes.filter(note => note.note_type === noteType);
  }

  async loadDailyNote(date: string): Promise<Note | null> {
    const globalDailyDir = this.fileSystem.getGlobalNotesDirectory('daily');
    const filePath = `${globalDailyDir}${date}.md`;

    const exists = await this.fileSystem.fileExists(filePath);
    if (!exists) return null;

    return this.loadNoteFromFile(filePath, null, 'daily');
  }

  async loadNotesFiltered(filter: NoteFilter): Promise<Note[]> {
    let notes = await this.loadAllNotes();

    if (filter.projectId) {
      notes = notes.filter(n => n.project_id === filter.projectId);
    }

    if (filter.taskId) {
      notes = notes.filter(n => n.task_id === filter.taskId);
    }

    if (filter.noteType) {
      notes = notes.filter(n => n.note_type === filter.noteType);
    }

    if (filter.tags && filter.tags.length > 0) {
      notes = notes.filter(n =>
        filter.tags!.some(tag => n.tags.includes(tag.toLowerCase()))
      );
    }

    if (filter.searchQuery) {
      const query = filter.searchQuery.toLowerCase();
      notes = notes.filter(n =>
        n.title.toLowerCase().includes(query) ||
        n.content.toLowerCase().includes(query)
      );
    }

    return notes;
  }

  async saveNote(note: Note): Promise<void> {
    const filePath = this.getNoteFilePath(note);

    await this.fileSystem.ensureDirectoryExists(this.getDirectoryFromPath(filePath));

    const metadata = note.toDict();
    await this.parser.saveTaskWithMetadata(filePath, note.title, note.content, metadata);

    note.file_path = filePath;
  }

  private getNoteFilePath(note: Note): string {
    if (note.file_path) return note.file_path;

    const fsNoteType = this.mapNoteTypeToFS(note.note_type);

    if (note.project_id) {
      const notesDir = this.fileSystem.getProjectNotesDirectory(note.project_id, fsNoteType);
      return `${notesDir}${this.getFilename(note)}.md`;
    }

    const notesDir = this.fileSystem.getGlobalNotesDirectory(fsNoteType);
    return `${notesDir}${this.getFilename(note)}.md`;
  }

  private mapNoteTypeToFS(noteType: NoteType): FSNoteType {
    switch (noteType) {
      case 'meeting': return 'meetings';
      case 'daily': return 'daily';
      default: return 'general';
    }
  }

  private getFilename(note: Note): string {
    if (note.note_type === 'daily') {
      return note.id;
    }
    return getSafeFilename(note.id);
  }

  private getDirectoryFromPath(filePath: string): string {
    const parts = filePath.split('/');
    parts.pop();
    return parts.join('/') + '/';
  }

  async deleteNote(noteId: NoteId): Promise<boolean> {
    const note = await this.loadNoteById(noteId);
    if (!note || !note.file_path) return false;

    try {
      await this.fileSystem.deleteFile(note.file_path);
      return true;
    } catch (error) {
      console.error(`Failed to delete note ${noteId}:`, error);
      return false;
    }
  }

  async searchNotes(query: string): Promise<Note[]> {
    return this.loadNotesFiltered({ searchQuery: query });
  }

  getGlobalNotesDirectory(): string {
    return this.fileSystem.getGlobalNotesDirectory();
  }

  getProjectNotesDirectory(projectId: ProjectId): string {
    return this.fileSystem.getProjectNotesDirectory(projectId);
  }
}
