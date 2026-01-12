import { TaskId, BoardId, ProjectId, Timestamp, FilePath } from "../../core/types";
import { now } from "../../utils/dateUtils";
import { TaskType, MeetingData } from "./Task";

export interface AgendaItemProps {
  id?: string;
  project_id: ProjectId;
  board_id: BoardId;
  task_id: TaskId;
  scheduled_date: string;
  scheduled_time?: string | null;
  duration_minutes?: number | null;
  task_type?: TaskType;
  meeting_data?: MeetingData | null;
  notes?: string;
  created_at?: Timestamp;
  updated_at?: Timestamp;
  file_path?: FilePath | null;
}

export class AgendaItem {
  id: string;
  project_id: ProjectId;
  board_id: BoardId;
  task_id: TaskId;
  scheduled_date: string;
  scheduled_time: string | null;
  duration_minutes: number | null;
  task_type: TaskType;
  meeting_data: MeetingData | null;
  notes: string;
  created_at: Timestamp;
  updated_at: Timestamp;
  file_path: FilePath | null;

  constructor(props: AgendaItemProps) {
    this.id = props.id || `agenda-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    this.project_id = props.project_id;
    this.board_id = props.board_id;
    this.task_id = props.task_id;
    this.scheduled_date = props.scheduled_date;
    this.scheduled_time = props.scheduled_time !== undefined ? props.scheduled_time : null;
    this.duration_minutes = props.duration_minutes !== undefined ? props.duration_minutes : null;
    this.task_type = props.task_type || 'regular';
    this.meeting_data = props.meeting_data !== undefined ? props.meeting_data : null;
    this.notes = props.notes || "";

    const created = props.created_at || now();
    this.created_at = created instanceof Date ? created : new Date(created);

    const updated = props.updated_at || now();
    this.updated_at = updated instanceof Date ? updated : new Date(updated);

    this.file_path = props.file_path !== undefined ? props.file_path : null;
  }

  get scheduledDateTime(): Date | null {
    if (!this.scheduled_date) return null;
    const dateStr = this.scheduled_time
      ? `${this.scheduled_date}T${this.scheduled_time}`
      : `${this.scheduled_date}T00:00`;
    return new Date(dateStr);
  }

  get filename(): string {
    return `${this.project_id}-${this.board_id}-${this.task_id}.md`;
  }

  reschedule(date: string, time?: string): void {
    this.scheduled_date = date;
    this.scheduled_time = time !== undefined ? time : this.scheduled_time;
    this.updated_at = now();
  }

  updateDuration(minutes: number): void {
    this.duration_minutes = minutes;
    this.updated_at = now();
  }

  addNotes(notes: string): void {
    this.notes = notes;
    this.updated_at = now();
  }

  update(updates: Partial<AgendaItemProps>): void {
    Object.entries(updates).forEach(([key, value]) => {
      if (key !== 'id' && key !== 'created_at') {
        (this as any)[key] = value;
      }
    });
    this.updated_at = now();
  }

  toDict(): Record<string, any> {
    const result: Record<string, any> = {
      id: this.id,
      project_id: this.project_id,
      board_id: this.board_id,
      task_id: this.task_id,
      scheduled_date: this.scheduled_date,
      created_at: this.created_at instanceof Date ? this.created_at.toISOString() : this.created_at,
      updated_at: this.updated_at instanceof Date ? this.updated_at.toISOString() : this.updated_at,
    };

    if (this.scheduled_time) result.scheduled_time = this.scheduled_time;
    if (this.duration_minutes) result.duration_minutes = this.duration_minutes;
    if (this.task_type !== 'regular') result.task_type = this.task_type;
    if (this.meeting_data) result.meeting_data = this.meeting_data;
    if (this.notes) result.notes = this.notes;

    return result;
  }

  static fromDict(data: Record<string, any>): AgendaItem {
    const parseDate = (value: any): Date | undefined => {
      if (!value) return undefined;
      if (value instanceof Date) return value;
      if (typeof value === 'string') return new Date(value);
      return undefined;
    };

    return new AgendaItem({
      id: data.id,
      project_id: data.project_id,
      board_id: data.board_id,
      task_id: data.task_id,
      scheduled_date: data.scheduled_date,
      scheduled_time: data.scheduled_time || null,
      duration_minutes: data.duration_minutes || null,
      task_type: data.task_type || 'regular',
      meeting_data: data.meeting_data || null,
      notes: data.notes || "",
      created_at: parseDate(data.created_at),
      updated_at: parseDate(data.updated_at),
      file_path: data.file_path,
    });
  }
}
