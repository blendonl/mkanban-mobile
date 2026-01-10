import * as AuthSession from 'expo-auth-session';
import * as SecureStore from 'expo-secure-store';
import * as WebBrowser from 'expo-web-browser';
import { CalendarRepository } from '../../domain/repositories/CalendarRepository';
import { CalendarEvent, GoogleCalendarEventResponse } from '../../domain/entities/CalendarEvent';

WebBrowser.maybeCompleteAuthSession();

const GOOGLE_CLIENT_ID = '';
const GOOGLE_CALENDAR_API = 'https://www.googleapis.com/calendar/v3';

const SECURE_STORE_KEYS = {
  ACCESS_TOKEN: 'google_access_token',
  REFRESH_TOKEN: 'google_refresh_token',
  TOKEN_EXPIRY: 'google_token_expiry',
};

const discovery = {
  authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
  tokenEndpoint: 'https://oauth2.googleapis.com/token',
  revocationEndpoint: 'https://oauth2.googleapis.com/revoke',
};

export class GoogleCalendarRepository implements CalendarRepository {
  private clientId: string;
  private redirectUri: string;

  constructor(clientId?: string) {
    this.clientId = clientId || GOOGLE_CLIENT_ID;
    this.redirectUri = AuthSession.makeRedirectUri({
      scheme: 'mkanban',
    });
  }

  async isAuthenticated(): Promise<boolean> {
    const token = await this.getAccessToken();
    return token !== null;
  }

  async authenticate(): Promise<boolean> {
    if (!this.clientId) {
      console.error('Google Client ID not configured');
      return false;
    }

    try {
      const request = new AuthSession.AuthRequest({
        clientId: this.clientId,
        scopes: [
          'https://www.googleapis.com/auth/calendar',
          'https://www.googleapis.com/auth/calendar.events',
        ],
        redirectUri: this.redirectUri,
        usePKCE: true,
      });

      const result = await request.promptAsync(discovery);

      if (result.type === 'success' && result.params.code) {
        const tokenResult = await AuthSession.exchangeCodeAsync(
          {
            clientId: this.clientId,
            code: result.params.code,
            redirectUri: this.redirectUri,
            extraParams: {
              code_verifier: request.codeVerifier!,
            },
          },
          discovery
        );

        await this.storeTokens(tokenResult);
        return true;
      }

      return false;
    } catch (error) {
      console.error('Authentication failed:', error);
      return false;
    }
  }

  async logout(): Promise<void> {
    try {
      const token = await SecureStore.getItemAsync(SECURE_STORE_KEYS.ACCESS_TOKEN);
      if (token) {
        await AuthSession.revokeAsync({ token }, discovery);
      }
    } catch (error) {
      console.warn('Failed to revoke token:', error);
    }

    await SecureStore.deleteItemAsync(SECURE_STORE_KEYS.ACCESS_TOKEN);
    await SecureStore.deleteItemAsync(SECURE_STORE_KEYS.REFRESH_TOKEN);
    await SecureStore.deleteItemAsync(SECURE_STORE_KEYS.TOKEN_EXPIRY);
  }

  async getAccessToken(): Promise<string | null> {
    try {
      const token = await SecureStore.getItemAsync(SECURE_STORE_KEYS.ACCESS_TOKEN);
      const expiry = await SecureStore.getItemAsync(SECURE_STORE_KEYS.TOKEN_EXPIRY);

      if (!token) return null;

      if (expiry && new Date(expiry) < new Date()) {
        return this.refreshAccessToken();
      }

      return token;
    } catch (error) {
      console.error('Failed to get access token:', error);
      return null;
    }
  }

  async refreshAccessToken(): Promise<string | null> {
    try {
      const refreshToken = await SecureStore.getItemAsync(SECURE_STORE_KEYS.REFRESH_TOKEN);
      if (!refreshToken) return null;

      const tokenResult = await AuthSession.refreshAsync(
        {
          clientId: this.clientId,
          refreshToken,
        },
        discovery
      );

      await this.storeTokens(tokenResult);
      return tokenResult.accessToken;
    } catch (error) {
      console.error('Failed to refresh token:', error);
      await this.logout();
      return null;
    }
  }

  private async storeTokens(tokenResult: AuthSession.TokenResponse): Promise<void> {
    await SecureStore.setItemAsync(SECURE_STORE_KEYS.ACCESS_TOKEN, tokenResult.accessToken);

    if (tokenResult.refreshToken) {
      await SecureStore.setItemAsync(SECURE_STORE_KEYS.REFRESH_TOKEN, tokenResult.refreshToken);
    }

    if (tokenResult.expiresIn) {
      const expiry = new Date(Date.now() + tokenResult.expiresIn * 1000);
      await SecureStore.setItemAsync(SECURE_STORE_KEYS.TOKEN_EXPIRY, expiry.toISOString());
    }
  }

  private async apiRequest<T>(
    endpoint: string,
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' = 'GET',
    body?: Record<string, any>
  ): Promise<T> {
    const token = await this.getAccessToken();
    if (!token) {
      throw new Error('Not authenticated');
    }

    const url = `${GOOGLE_CALENDAR_API}${endpoint}`;
    const options: RequestInit = {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    };

    if (body) {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(url, options);

    if (!response.ok) {
      if (response.status === 401) {
        const newToken = await this.refreshAccessToken();
        if (newToken) {
          options.headers = {
            ...options.headers,
            Authorization: `Bearer ${newToken}`,
          };
          const retryResponse = await fetch(url, options);
          if (!retryResponse.ok) {
            throw new Error(`API request failed: ${retryResponse.status}`);
          }
          return retryResponse.json();
        }
      }
      throw new Error(`API request failed: ${response.status}`);
    }

    if (response.status === 204) {
      return {} as T;
    }

    return response.json();
  }

  async getEvents(startDate: Date, endDate: Date): Promise<CalendarEvent[]> {
    const timeMin = startDate.toISOString();
    const timeMax = endDate.toISOString();

    const params = new URLSearchParams({
      timeMin,
      timeMax,
      singleEvents: 'true',
      orderBy: 'startTime',
      maxResults: '250',
    });

    const response = await this.apiRequest<{ items: GoogleCalendarEventResponse[] }>(
      `/calendars/primary/events?${params}`
    );

    return (response.items || []).map(item => CalendarEvent.fromGoogleEvent(item));
  }

  async getEvent(eventId: string): Promise<CalendarEvent | null> {
    try {
      const response = await this.apiRequest<GoogleCalendarEventResponse>(
        `/calendars/primary/events/${eventId}`
      );
      return CalendarEvent.fromGoogleEvent(response);
    } catch (error) {
      console.error('Failed to get event:', error);
      return null;
    }
  }

  async createEvent(event: CalendarEvent): Promise<CalendarEvent> {
    const body = event.toGoogleEventBody();

    const response = await this.apiRequest<GoogleCalendarEventResponse>(
      '/calendars/primary/events',
      'POST',
      body
    );

    const createdEvent = CalendarEvent.fromGoogleEvent(response);
    createdEvent.task_id = event.task_id;
    createdEvent.board_id = event.board_id;

    return createdEvent;
  }

  async updateEvent(event: CalendarEvent): Promise<CalendarEvent> {
    if (!event.google_event_id) {
      throw new Error('Cannot update event without Google event ID');
    }

    const body = event.toGoogleEventBody();

    const response = await this.apiRequest<GoogleCalendarEventResponse>(
      `/calendars/primary/events/${event.google_event_id}`,
      'PUT',
      body
    );

    const updatedEvent = CalendarEvent.fromGoogleEvent(response);
    updatedEvent.task_id = event.task_id;
    updatedEvent.board_id = event.board_id;

    return updatedEvent;
  }

  async deleteEvent(eventId: string): Promise<void> {
    await this.apiRequest(`/calendars/primary/events/${eventId}`, 'DELETE');
  }

  async syncEvents(): Promise<{ created: number; updated: number; deleted: number }> {
    return { created: 0, updated: 0, deleted: 0 };
  }
}
