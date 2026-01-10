import { NoteId, ProjectId, TaskId, Timestamp, FilePath } from "../../core/types";
import { now } from "../../utils/dateUtils";
import { generateIdFromName } from "../../utils/stringUtils";

export type NoteType = 'general' | 'meeting' | 'daily' | 'task';

export interface NoteProps {
  id?: NoteId;
  title: string;
  content?: string;
  project_id?: ProjectId | null;
  task_id?: TaskId | null;
  note_type?: NoteType;
  tags?: string[];
  created_at?: Timestamp;
  updated_at?: Timestamp;
  file_path?: FilePath | null;
}

export class Note {
  id: NoteId;
  title: string;
  content: string;
  project_id: ProjectId | null;
  task_id: TaskId | null;
  note_type: NoteType;
  tags: string[];
  created_at: Timestamp;
  updated_at: Timestamp;
  file_path: FilePath | null;

  constructor(props: NoteProps) {
    this.title = props.title;
    this.content = props.content || "";
    this.project_id = props.project_id !== undefined ? props.project_id : null;
    this.task_id = props.task_id !== undefined ? props.task_id : null;
    this.note_type = props.note_type || 'general';
    this.tags = props.tags || [];
    this.created_at = props.created_at || now();
    this.updated_at = props.updated_at || now();
    this.file_path = props.file_path !== undefined ? props.file_path : null;

    if (props.id) {
      this.id = props.id;
    } else if (this.file_path) {
      const filename = this.file_path.split("/").pop() || "";
      const stem = filename.replace(/\.md$/, "");
      this.id = stem;
    } else {
      this.id = this.generateNoteId();
    }
  }

  private generateNoteId(): string {
    const prefix = this.getNoteTypePrefix();
    const timestamp = Date.now().toString(36).toUpperCase();
    const titleSlug = generateIdFromName(this.title).slice(0, 20);
    return `${prefix}-${timestamp}-${titleSlug}`;
  }

  private getNoteTypePrefix(): string {
    switch (this.note_type) {
      case 'meeting': return 'MEET';
      case 'daily': return 'DAILY';
      case 'task': return 'TASK';
      default: return 'NOTE';
    }
  }

  update(updates: Partial<NoteProps>): void {
    if (updates.title !== undefined) this.title = updates.title;
    if (updates.content !== undefined) this.content = updates.content;
    if (updates.project_id !== undefined) this.project_id = updates.project_id;
    if (updates.task_id !== undefined) this.task_id = updates.task_id;
    if (updates.note_type !== undefined) this.note_type = updates.note_type;
    if (updates.tags !== undefined) this.tags = updates.tags;
    this.updated_at = now();
  }

  addTag(tag: string): void {
    const normalizedTag = tag.toLowerCase().trim();
    if (!this.tags.includes(normalizedTag)) {
      this.tags.push(normalizedTag);
      this.updated_at = now();
    }
  }

  removeTag(tag: string): void {
    const normalizedTag = tag.toLowerCase().trim();
    const index = this.tags.indexOf(normalizedTag);
    if (index !== -1) {
      this.tags.splice(index, 1);
      this.updated_at = now();
    }
  }

  get isDaily(): boolean {
    return this.note_type === 'daily';
  }

  get isMeeting(): boolean {
    return this.note_type === 'meeting';
  }

  get isTaskNote(): boolean {
    return this.note_type === 'task' || this.task_id !== null;
  }

  get preview(): string {
    const maxLength = 150;
    const stripped = this.content
      .replace(/^#+ .+$/gm, '')
      .replace(/\*\*|__/g, '')
      .replace(/\*|_/g, '')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/!\[([^\]]*)\]\([^)]+\)/g, '')
      .replace(/```[\s\S]*?```/g, '')
      .replace(/`[^`]+`/g, '')
      .replace(/\n+/g, ' ')
      .trim();

    if (stripped.length <= maxLength) return stripped;
    return stripped.slice(0, maxLength).trim() + '...';
  }

  get wordCount(): number {
    return this.content.split(/\s+/).filter(w => w.length > 0).length;
  }

  toDict(): Record<string, any> {
    const result: Record<string, any> = {
      id: this.id,
      title: this.title,
      note_type: this.note_type,
      created_at: this.created_at,
      updated_at: this.updated_at,
    };

    if (this.project_id) result.project_id = this.project_id;
    if (this.task_id) result.task_id = this.task_id;
    if (this.tags.length > 0) result.tags = this.tags;

    return result;
  }

  static fromDict(data: Record<string, any>, content?: string): Note {
    return new Note({
      id: data.id,
      title: data.title,
      content: content || data.content || "",
      project_id: data.project_id || null,
      task_id: data.task_id || null,
      note_type: data.note_type || 'general',
      tags: data.tags || [],
      created_at: data.created_at ? new Date(data.created_at) : undefined,
      updated_at: data.updated_at ? new Date(data.updated_at) : undefined,
      file_path: data.file_path,
    });
  }

  static createDaily(date?: Date): Note {
    const d = date || new Date();
    const dateStr = d.toISOString().split('T')[0];
    const title = d.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    return new Note({
      id: dateStr,
      title,
      content: `# ${title}\n\n## Tasks\n\n- [ ] \n\n## Notes\n\n`,
      note_type: 'daily',
    });
  }

  static createMeeting(title: string, projectId?: string): Note {
    const now = new Date();
    const dateStr = now.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });

    return new Note({
      title,
      content: `# ${title}\n\n**Date:** ${dateStr}\n\n## Attendees\n\n- \n\n## Agenda\n\n1. \n\n## Notes\n\n\n\n## Action Items\n\n- [ ] \n`,
      note_type: 'meeting',
      project_id: projectId || null,
    });
  }
}
