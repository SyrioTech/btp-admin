import { useQuery } from '@tanstack/vue-query'
import type { Ref } from 'vue'
import { eventsBtpApi } from '@/api/events-btp'
import type { EventsFilter } from '@/api/types'

export function useEvents(accountId: Ref<string | null>, filters: Ref<EventsFilter>) {
  return useQuery({
    queryKey: ['events', 'list', accountId, filters],
    queryFn: () => {
      if (!accountId.value) throw new Error('No BTP account selected')
      return eventsBtpApi.getEvents(accountId.value, filters.value)
    },
    enabled: () => !!accountId.value,
    placeholderData: (previousData) => previousData, // keep old data while fetching to avoid layout shift
  })
}

export function useEventTypes(accountId: Ref<string | null>) {
  return useQuery({
    queryKey: ['events', 'types', accountId],
    queryFn: () => {
      if (!accountId.value) throw new Error('No BTP account selected')
      return eventsBtpApi.getEventTypes(accountId.value)
    },
    enabled: () => !!accountId.value,
  })
}
