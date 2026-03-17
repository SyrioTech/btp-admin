import api from '@/lib/axios'
import type { EventsFilter, EventsResponse, EventType } from './types'

export const eventsBtpApi = {
  getEvents: (accountId: string, params?: EventsFilter) =>
    api.get<EventsResponse>(`/events/${accountId}`, { params }).then((r) => r.data),

  getEventTypes: (accountId: string) =>
    api.get<Record<string, EventType>>(`/events/${accountId}/types`).then((r) => r.data),
}
