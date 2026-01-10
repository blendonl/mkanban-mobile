/**
 * Task entity representing a task in a kanban column
 * Ported from Python: src/domain/entities/item.py
 * MVP version: Git and JIRA fields excluded
 */

import { TaskId, ColumnId, ParentId, ProjectId, Timestamp, FilePath, Metadata } from "../../core/types";
import { now } from "../../utils/dateUtils";
import { generateIdFromName, getSafeFilename } from "../../utils/stringUtils";

export type TaskType = 'regular' | 'meeting' | 'milestone';

export interface MeetingData {
  attendees?: string[];
  location?: string;
  meetingLink?: string;
}

export interface RecurrenceRule {
  frequency: 'daily' | 'weekly' | 'monthly' | 'yearly';
  interval?: number;
  endDate?: string;
  count?: number;
}

export interface TaskProps {
  id?: TaskId;
  title: string;
  column_id: ColumnId;
  description?: string;
  parent_id?: ParentId | null;
  project_id?: ProjectId | null;
  created_at?: Timestamp;
  moved_in_progress_at?: Timestamp | null;
  moved_in_done_at?: Timestamp | null;
  worked_on_for?: string | null;
  file_path?: FilePath | null;
  metadata?: Metadata;
  // Scheduling fields
  scheduled_date?: string | null;
  scheduled_time?: string | null;
  time_block_minutes?: number | null;
  task_type?: TaskType;
  calendar_event_id?: string | null;
  recurrence?: RecurrenceRule | null;
  meeting_data?: MeetingData | null;
}

export class Task {
  id: TaskId;
  title: string;
  column_id: ColumnId;
  description: string;
  parent_id: ParentId | null;
  project_id: ProjectId | null;
  created_at: Timestamp;
  moved_in_progress_at: Timestamp | null;
  moved_in_done_at: Timestamp | null;
  worked_on_for: string | null;
  file_path: FilePath | null;
  metadata: Metadata;
  // Scheduling fields
  scheduled_date: string | null;
  scheduled_time: string | null;
  time_block_minutes: number | null;
  task_type: TaskType;
  calendar_event_id: string | null;
  recurrence: RecurrenceRule | null;
  meeting_data: MeetingData | null;

  constructor(props: TaskProps) {
    this.title = props.title;
    this.column_id = props.column_id;
    this.description = props.description || "";
    this.parent_id = props.parent_id !== undefined ? props.parent_id : null;
    this.project_id = props.project_id !== undefined ? props.project_id : null;
    this.created_at = props.created_at || now();
    this.moved_in_progress_at = props.moved_in_progress_at !== undefined ? props.moved_in_progress_at : null;
    this.moved_in_done_at = props.moved_in_done_at !== undefined ? props.moved_in_done_at : null;
    this.worked_on_for = props.worked_on_for !== undefined ? props.worked_on_for : null;
    this.file_path = props.file_path !== undefined ? props.file_path : null;
    this.metadata = props.metadata || {};
    // Scheduling fields
    this.scheduled_date = props.scheduled_date !== undefined ? props.scheduled_date : null;
    this.scheduled_time = props.scheduled_time !== undefined ? props.scheduled_time : null;
    this.time_block_minutes = props.time_block_minutes !== undefined ? props.time_block_minutes : null;
    this.task_type = props.task_type || 'regular';
    this.calendar_event_id = props.calendar_event_id !== undefined ? props.calendar_event_id : null;
    this.recurrence = props.recurrence !== undefined ? props.recurrence : null;
    this.meeting_data = props.meeting_data !== undefined ? props.meeting_data : null;

    // Auto-generate ID if not provided
    if (props.id) {
      this.id = props.id;
    } else if (this.file_path) {
      // Extract ID from filename
      const filename = this.file_path.split("/").pop() || "";
      const stem = filename.replace(/\.md$/, "");

      // Try to extract ID prefix (e.g., "REC-27-fix-bug" -> "REC-27")
      const parts = stem.split("-");
      if (parts.length >= 2 && /^\d+$/.test(parts[1])) {
        this.id = `${parts[0]}-${parts[1]}`;
      } else {
        this.id = stem;
      }

      if (!this.title || this.title === stem) {
        this.title = stem;
      }
    } else {
      // Manual tasks will have ID set by TaskService with board context
      this.id = generateIdFromName(this.title) || "unnamed_task";
    }
  }

  /**
   * Update task properties
   * Protected fields (timing) cannot be manually updated
   */
  update(updates: Partial<TaskProps>): void {
    const protectedFields = new Set(["moved_in_progress_at", "moved_in_done_at", "worked_on_for"]);

    Object.entries(updates).forEach(([key, value]) => {
      if (!protectedFields.has(key)) {
        (this as any)[key] = value;
      }
    });
  }

  /**
   * Move task to a different column
   * Automatically tracks timestamps for in-progress and done columns
   */
  moveToColumn(columnId: ColumnId): void {
    const oldColumnId = this.column_id;
    this.column_id = columnId;

    // Normalize column IDs for comparison (handle both hyphen and underscore)
    const normalizedColumnId = columnId.replace(/_/g, "-");
    const normalizedOldColumnId = oldColumnId ? oldColumnId.replace(/_/g, "-") : null;

    // Track when task moves to in-progress
    if (normalizedColumnId === "in-progress" && normalizedOldColumnId !== "in-progress") {
      this.moved_in_progress_at = now();
    }

    // Track when task moves to done and calculate work duration
    if (normalizedColumnId === "done" && normalizedOldColumnId !== "done") {
      this.moved_in_done_at = now();

      // Calculate worked_on_for if task was previously in progress
      if (this.moved_in_progress_at) {
        this.worked_on_for = this._calculateWorkDuration(
          this.moved_in_progress_at,
          this.moved_in_done_at
        );
      }
    }
  }

  /**
   * Set or clear the parent ID
   */
  setParent(parentId: ParentId | null): void {
    this.parent_id = parentId;
  }

  /**
   * Check if task has a parent
   */
  get hasParent(): boolean {
    return this.parent_id !== null;
  }

  /**
   * Get the issue type from metadata, defaults to "Task"
   */
  getIssueType(): string {
    const issueType = this.metadata.issue_type;
    return typeof issueType === 'string' ? issueType : "Task";
  }

  /**
   * Set the issue type in metadata
   */
  setIssueType(issueType: string): void {
    this.metadata.issue_type = issueType;
  }

  /**
   * Get the icon for the current issue type
   */
  getIssueTypeIcon(): string {
    const issueType = this.getIssueType().toLowerCase();

    if (issueType.includes("epic")) {
      return "📚";
    } else if (issueType.includes("story")) {
      return "📖";
    } else if (issueType.includes("bug")) {
      return "🐛";
    } else if (issueType.includes("subtask")) {
      return "☑️";
    } else if (issueType.includes("task")) {
      return "📋";
    }
    return "📄";
  }

  /**
   * Calculate work duration in HH:MM format
   */
  private _calculateWorkDuration(startTime: Timestamp, endTime: Timestamp): string | null {
    try {
      const start = startTime instanceof Date ? startTime : new Date(startTime);
      const end = endTime instanceof Date ? endTime : new Date(endTime);

      const durationMs = end.getTime() - start.getTime();
      const totalMinutes = Math.floor(durationMs / (1000 * 60));
      const hours = Math.floor(totalMinutes / 60);
      const minutes = totalMinutes % 60;

      return `${hours}:${minutes.toString().padStart(2, "0")}`;
    } catch {
      return null;
    }
  }

  get isScheduled(): boolean {
    return this.scheduled_date !== null;
  }

  get isMeeting(): boolean {
    return this.task_type === 'meeting';
  }

  get scheduledDateTime(): Date | null {
    if (!this.scheduled_date) return null;
    const dateStr = this.scheduled_time
      ? `${this.scheduled_date}T${this.scheduled_time}`
      : `${this.scheduled_date}T00:00`;
    return new Date(dateStr);
  }

  schedule(date: string, time?: string, durationMinutes?: number): void {
    this.scheduled_date = date;
    this.scheduled_time = time || null;
    this.time_block_minutes = durationMinutes || null;
  }

  unschedule(): void {
    this.scheduled_date = null;
    this.scheduled_time = null;
    this.time_block_minutes = null;
  }

  toDict(): Record<string, any> {
    const result: Record<string, any> = {
      id: this.id,
      title: this.title,
      column_id: this.column_id,
      description: this.description,
      parent_id: this.parent_id,
      project_id: this.project_id,
      created_at: this.created_at,
      moved_in_progress_at: this.moved_in_progress_at,
      moved_in_done_at: this.moved_in_done_at,
      worked_on_for: this.worked_on_for,
    };

    if (Object.keys(this.metadata).length > 0) {
      result.metadata = this.metadata;
    }

    if (this.scheduled_date) result.scheduled_date = this.scheduled_date;
    if (this.scheduled_time) result.scheduled_time = this.scheduled_time;
    if (this.time_block_minutes) result.time_block_minutes = this.time_block_minutes;
    if (this.task_type !== 'regular') result.task_type = this.task_type;
    if (this.calendar_event_id) result.calendar_event_id = this.calendar_event_id;
    if (this.recurrence) result.recurrence = this.recurrence;
    if (this.meeting_data) result.meeting_data = this.meeting_data;

    return result;
  }

  static fromDict(data: Record<string, any>): Task {
    return new Task({
      id: data.id,
      title: data.title,
      column_id: data.column_id,
      description: data.description,
      parent_id: data.parent_id,
      project_id: data.project_id,
      created_at: data.created_at ? new Date(data.created_at) : undefined,
      moved_in_progress_at: data.moved_in_progress_at ? new Date(data.moved_in_progress_at) : null,
      moved_in_done_at: data.moved_in_done_at ? new Date(data.moved_in_done_at) : null,
      worked_on_for: data.worked_on_for,
      file_path: data.file_path,
      metadata: data.metadata || {},
      scheduled_date: data.scheduled_date || null,
      scheduled_time: data.scheduled_time || null,
      time_block_minutes: data.time_block_minutes || null,
      task_type: data.task_type || 'regular',
      calendar_event_id: data.calendar_event_id || null,
      recurrence: data.recurrence || null,
      meeting_data: data.meeting_data || null,
    });
  }
}
