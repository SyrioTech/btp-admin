import type { EventRecord } from '@/api/types'

/**
 * Filters an array of EventRecords to those whose actionTime falls within
 * [fromDate, toDate] (both inclusive, full UTC day).
 *
 * - fromDate / toDate are "YYYY-MM-DD" strings (as returned by <input type="date">)
 * - Empty string means "no bound" on that side
 * - actionTime is an ISO-8601 string (or epoch-ms number) as returned by SAP CIS
 */
export function filterEventsByDate(
  events: EventRecord[],
  fromDate: string,
  toDate: string,
): EventRecord[] {
  if (!fromDate && !toDate) return events

  const fromMs: number = fromDate ? new Date(fromDate).getTime() : 0
  const toMs: number = toDate
    ? new Date(toDate).getTime() + 24 * 60 * 60 * 1000 - 1 // end of the selected day (UTC)
    : Infinity

  return events.filter((e) => {
    // SAP may return actionTime as an ISO string or as an epoch-ms number
    const t: number =
      typeof e.actionTime === 'number'
        ? (e.actionTime as unknown as number)
        : new Date(e.actionTime).getTime()
    if (isNaN(t)) return false
    return t >= fromMs && t <= toMs
  })
}
