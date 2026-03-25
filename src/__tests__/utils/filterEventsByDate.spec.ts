import { describe, it, expect } from 'vitest'
import { filterEventsByDate } from '@/utils/filterEventsByDate'
import type { EventRecord } from '@/api/types'

// ── helpers ───────────────────────────────────────────────────────────────────

function makeEvent(actionTime: string | number, id: number): EventRecord {
  return {
    id,
    actionTime: actionTime as string, // cast — runtime may be number (SAP epoch ms)
    creationTime: '2026-01-01T00:00:00.000Z',
    eventType: 'TestEvent',
    entityId: 'entity-id',
    entityType: 'Subaccount',
    eventOrigin: 'LOCAL',
    globalAccountGUID: 'global-id',
    details: {},
  }
}

// Five events spread across early-to-late March 2026 (all times UTC)
const EVENTS: EventRecord[] = [
  makeEvent('2026-03-01T10:00:00.000Z', 1), // March  1
  makeEvent('2026-03-03T10:00:00.000Z', 2), // March  3
  makeEvent('2026-03-04T23:59:59.999Z', 3), // March  4 — end of day UTC
  makeEvent('2026-03-20T08:00:00.000Z', 4), // March 20
  makeEvent('2026-03-24T12:00:00.000Z', 5), // March 24
]

// ── no-filter passthrough ─────────────────────────────────────────────────────

describe('filterEventsByDate — no filter', () => {
  it('returns all events when both dates are empty', () => {
    expect(filterEventsByDate(EVENTS, '', '')).toHaveLength(5)
  })
})

// ── from-date only ────────────────────────────────────────────────────────────

describe('filterEventsByDate — fromDate only', () => {
  it('keeps events on or after fromDate', () => {
    const result = filterEventsByDate(EVENTS, '2026-03-03', '')
    expect(result.map((e) => e.id)).toEqual([2, 3, 4, 5])
  })

  it('excludes events before fromDate', () => {
    const result = filterEventsByDate(EVENTS, '2026-03-03', '')
    expect(result.find((e) => e.id === 1)).toBeUndefined()
  })
})

// ── to-date only ──────────────────────────────────────────────────────────────

describe('filterEventsByDate — toDate only', () => {
  it('keeps events on or before toDate (end-of-day boundary)', () => {
    const result = filterEventsByDate(EVENTS, '', '2026-03-04')
    // March 1, 3, and 4 (23:59:59.999 UTC) all fall within the day
    expect(result.map((e) => e.id)).toEqual([1, 2, 3])
  })

  it('excludes events after toDate', () => {
    const result = filterEventsByDate(EVENTS, '', '2026-03-04')
    expect(result.find((e) => e.id === 4)).toBeUndefined()
    expect(result.find((e) => e.id === 5)).toBeUndefined()
  })
})

// ── date range ────────────────────────────────────────────────────────────────

describe('filterEventsByDate — range', () => {
  it('returns only events inside the range', () => {
    const result = filterEventsByDate(EVENTS, '2026-03-03', '2026-03-04')
    expect(result.map((e) => e.id)).toEqual([2, 3])
  })

  it('single-day filter: includes events for the full UTC day', () => {
    const dayEvents = [
      makeEvent('2026-03-20T00:00:00.000Z', 10), // start of day UTC
      makeEvent('2026-03-20T12:00:00.000Z', 11), // midday UTC
      makeEvent('2026-03-20T23:59:59.999Z', 12), // last ms of day UTC
      makeEvent('2026-03-21T00:00:00.000Z', 13), // first ms of NEXT day
    ]
    const result = filterEventsByDate(dayEvents, '2026-03-20', '2026-03-20')
    expect(result.map((e) => e.id)).toEqual([10, 11, 12])
    expect(result.find((e) => e.id === 13)).toBeUndefined()
  })

  it('returns empty array when no events match', () => {
    const result = filterEventsByDate(EVENTS, '2026-04-01', '2026-04-30')
    expect(result).toHaveLength(0)
  })

  it('navigating pages does not affect filter — same dates, different event set', () => {
    // Simulate page 1 (recent events — outside range)
    const page1 = [
      makeEvent('2026-03-22T10:00:00.000Z', 101),
      makeEvent('2026-03-23T10:00:00.000Z', 102),
      makeEvent('2026-03-24T10:00:00.000Z', 103),
    ]
    // Simulate page 5 (older events — inside range)
    const page5 = [
      makeEvent('2026-03-20T10:00:00.000Z', 501),
      makeEvent('2026-03-20T15:00:00.000Z', 502),
      makeEvent('2026-03-19T08:00:00.000Z', 503),
    ]

    const from = '2026-03-20'
    const to = '2026-03-20'

    // Page 1 — no matches (correct: March 22-24 are outside the range)
    expect(filterEventsByDate(page1, from, to)).toHaveLength(0)

    // Page 5 — two matches (501, 502 are March 20; 503 is March 19)
    const p5result = filterEventsByDate(page5, from, to)
    expect(p5result.map((e) => e.id)).toEqual([501, 502])
  })
})

// ── epoch-ms actionTime (SAP may return numbers) ──────────────────────────────

describe('filterEventsByDate — epoch-ms actionTime', () => {
  it('handles epoch-ms number as actionTime', () => {
    const epochMs = new Date('2026-03-20T10:00:00.000Z').getTime()
    const e = makeEvent(epochMs as unknown as string, 99)
    // runtime: e.actionTime is a number, not a string
    const result = filterEventsByDate([e], '2026-03-20', '2026-03-20')
    expect(result).toHaveLength(1)
  })
})

// ── invalid / missing actionTime ──────────────────────────────────────────────

describe('filterEventsByDate — invalid actionTime', () => {
  it('excludes events with unparseable actionTime (does not throw)', () => {
    const bad = makeEvent('not-a-date', 999)
    expect(() => filterEventsByDate([bad], '2026-03-01', '2026-03-31')).not.toThrow()
    expect(filterEventsByDate([bad], '2026-03-01', '2026-03-31')).toHaveLength(0)
  })
})
