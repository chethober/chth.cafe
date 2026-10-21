import { readAPIResponse } from './api';
import type { CafeEvent, EventBooking } from '../utils/events';

export interface SeatCount { eventId: string; date: string; seats: number; bookings?: number; checkedIn?: number }
export type EventInput = Omit<CafeEvent, 'id' | 'telegramPostedAt' | 'createdAt' | 'updatedAt'>;

async function send<T>(url: string, method: string, body?: unknown): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, { method, headers: body === undefined ? undefined : { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
  } catch {
    throw new Error('The café API is unavailable. Check your connection and try again.');
  }
  return readAPIResponse<T>(response);
}

export const seatKey = (eventId: string, date: string) => `${eventId}|${date}`;
export const seatMap = (seats: SeatCount[]) => new Map(seats.map(s => [seatKey(s.eventId, s.date), s]));

export const eventsApi = {
  listPublic: () => send<{ data: CafeEvent[]; seats: SeatCount[] }>('/api/events/public', 'GET'),
  list: () => send<{ data: CafeEvent[]; seats: SeatCount[] }>('/api/events', 'GET'),
  create: (input: EventInput) => send<{ data: CafeEvent }>('/api/events', 'POST', input).then(r => r.data),
  update: (id: string, input: Partial<EventInput>) => send<{ data: CafeEvent }>(`/api/events/${id}`, 'PUT', input).then(r => r.data),
  remove: (id: string) => send(`/api/events/${id}`, 'DELETE'),
  postToTelegram: (id: string) => send<{ data: { telegramPostedAt: string } }>(`/api/events/${id}/telegram`, 'POST', {}).then(r => r.data),
  bookings: (eventId: string, date?: string) =>
    send<{ data: EventBooking[] }>(`/api/event-bookings?eventId=${encodeURIComponent(eventId)}${date ? `&date=${date}` : ''}`, 'GET').then(r => r.data),
  book: (eventId: string, input: { date: string; name: string; phone: string; seats: number; note: string; website?: string }) =>
    send<{ data: EventBooking; token?: string }>(`/api/events/${eventId}/bookings`, 'POST', input),
  updateBooking: (id: string, patch: { status?: EventBooking['status']; paid?: boolean }) =>
    send<{ data: EventBooking }>(`/api/event-bookings/${id}`, 'PUT', patch).then(r => r.data),
  bookingStatus: (id: string, token: string) =>
    send<{ data: Pick<EventBooking, 'id' | 'status' | 'seats' | 'code'> }>(`/api/event-bookings/${id}/status?token=${encodeURIComponent(token)}`, 'GET').then(r => r.data),
  cancelOwnBooking: (id: string, token: string) => send(`/api/event-bookings/${id}/cancel`, 'POST', { token })
};
