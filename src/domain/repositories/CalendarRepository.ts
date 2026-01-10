import { CalendarEvent } from '../entities/CalendarEvent';

export interface CalendarRepository {
  isAuthenticated(): Promise<boolean>;

  authenticate(): Promise<boolean>;

  logout(): Promise<void>;

  getEvents(startDate: Date, endDate: Date): Promise<CalendarEvent[]>;

  getEvent(eventId: string): Promise<CalendarEvent | null>;

  createEvent(event: CalendarEvent): Promise<CalendarEvent>;

  updateEvent(event: CalendarEvent): Promise<CalendarEvent>;

  deleteEvent(eventId: string): Promise<void>;

  syncEvents(): Promise<{ created: number; updated: number; deleted: number }>;

  getAccessToken(): Promise<string | null>;

  refreshAccessToken(): Promise<string | null>;
}
