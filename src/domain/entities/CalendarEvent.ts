import { TaskId } from "../../core/types";

export type SyncStatus = 'synced' | 'pending' | 'conflict' | 'local_only';

export interface CalendarEventProps {
  id?: string;
  google_event_id?: string;
  title: string;
  start_time: Date;
  end_time: Date;
  all_day?: boolean;
  location?: string;
  description?: string;
  attendees?: string[];
  task_id?: TaskId;
  board_id?: string;
  sync_status?: SyncStatus;
  last_synced_at?: Date;
  etag?: string;
}

export interface GoogleCalendarEventResponse {
  id: string;
  summary: string;
  description?: string;
  start: {
    dateTime?: string;
    date?: string;
    timeZone?: string;
  };
  end: {
    dateTime?: string;
    date?: string;
    timeZone?: string;
  };
  location?: string;
  attendees?: Array<{
    email: string;
    displayName?: string;
    responseStatus?: string;
  }>;
  etag?: string;
  status?: string;
  htmlLink?: string;
}

export class CalendarEvent {
  id: string;
  google_event_id: string | null;
  title: string;
  start_time: Date;
  end_time: Date;
  all_day: boolean;
  location: string | null;
  description: string | null;
  attendees: string[];
  task_id: TaskId | null;
  board_id: string | null;
  sync_status: SyncStatus;
  last_synced_at: Date | null;
  etag: string | null;

  constructor(props: CalendarEventProps) {
    this.id = props.id || `event-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    this.google_event_id = props.google_event_id || null;
    this.title = props.title;
    this.start_time = props.start_time;
    this.end_time = props.end_time;
    this.all_day = props.all_day || false;
    this.location = props.location || null;
    this.description = props.description || null;
    this.attendees = props.attendees || [];
    this.task_id = props.task_id || null;
    this.board_id = props.board_id || null;
    this.sync_status = props.sync_status || 'local_only';
    this.last_synced_at = props.last_synced_at || null;
    this.etag = props.etag || null;
  }

  get durationMinutes(): number {
    return Math.round((this.end_time.getTime() - this.start_time.getTime()) / 60000);
  }

  get formattedDuration(): string {
    const minutes = this.durationMinutes;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours === 0) return `${mins}m`;
    if (mins === 0) return `${hours}h`;
    return `${hours}h ${mins}m`;
  }

  get dateString(): string {
    return this.start_time.toISOString().split('T')[0];
  }

  get startTimeString(): string {
    return this.start_time.toTimeString().slice(0, 5);
  }

  get endTimeString(): string {
    return this.end_time.toTimeString().slice(0, 5);
  }

  get isSynced(): boolean {
    return this.sync_status === 'synced' && this.google_event_id !== null;
  }

  get needsSync(): boolean {
    return this.sync_status === 'pending' || this.sync_status === 'local_only';
  }

  get hasConflict(): boolean {
    return this.sync_status === 'conflict';
  }

  isOnDate(date: string): boolean {
    return this.dateString === date;
  }

  overlaps(other: CalendarEvent): boolean {
    return this.start_time < other.end_time && this.end_time > other.start_time;
  }

  markSynced(googleEventId: string, etag?: string): void {
    this.google_event_id = googleEventId;
    this.sync_status = 'synced';
    this.last_synced_at = new Date();
    if (etag) this.etag = etag;
  }

  markPending(): void {
    this.sync_status = 'pending';
  }

  markConflict(): void {
    this.sync_status = 'conflict';
  }

  toDict(): Record<string, any> {
    return {
      id: this.id,
      google_event_id: this.google_event_id,
      title: this.title,
      start_time: this.start_time.toISOString(),
      end_time: this.end_time.toISOString(),
      all_day: this.all_day,
      location: this.location,
      description: this.description,
      attendees: this.attendees,
      task_id: this.task_id,
      board_id: this.board_id,
      sync_status: this.sync_status,
      last_synced_at: this.last_synced_at?.toISOString(),
      etag: this.etag,
    };
  }

  static fromDict(data: Record<string, any>): CalendarEvent {
    return new CalendarEvent({
      id: data.id,
      google_event_id: data.google_event_id,
      title: data.title,
      start_time: new Date(data.start_time),
      end_time: new Date(data.end_time),
      all_day: data.all_day,
      location: data.location,
      description: data.description,
      attendees: data.attendees,
      task_id: data.task_id,
      board_id: data.board_id,
      sync_status: data.sync_status,
      last_synced_at: data.last_synced_at ? new Date(data.last_synced_at) : undefined,
      etag: data.etag,
    });
  }

  static fromGoogleEvent(googleEvent: GoogleCalendarEventResponse): CalendarEvent {
    const isAllDay = !googleEvent.start.dateTime;

    let startTime: Date;
    let endTime: Date;

    if (isAllDay) {
      startTime = new Date(googleEvent.start.date + 'T00:00:00');
      endTime = new Date(googleEvent.end.date + 'T00:00:00');
    } else {
      startTime = new Date(googleEvent.start.dateTime!);
      endTime = new Date(googleEvent.end.dateTime!);
    }

    return new CalendarEvent({
      google_event_id: googleEvent.id,
      title: googleEvent.summary || 'Untitled Event',
      start_time: startTime,
      end_time: endTime,
      all_day: isAllDay,
      location: googleEvent.location,
      description: googleEvent.description,
      attendees: googleEvent.attendees?.map(a => a.email) || [],
      sync_status: 'synced',
      last_synced_at: new Date(),
      etag: googleEvent.etag,
    });
  }

  toGoogleEventBody(): Record<string, any> {
    const body: Record<string, any> = {
      summary: this.title,
    };

    if (this.description) {
      body.description = this.description;
    }

    if (this.location) {
      body.location = this.location;
    }

    if (this.all_day) {
      body.start = { date: this.dateString };
      body.end = { date: this.end_time.toISOString().split('T')[0] };
    } else {
      body.start = { dateTime: this.start_time.toISOString() };
      body.end = { dateTime: this.end_time.toISOString() };
    }

    if (this.attendees.length > 0) {
      body.attendees = this.attendees.map(email => ({ email }));
    }

    return body;
  }
}
