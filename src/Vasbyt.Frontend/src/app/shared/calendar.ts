import { RouteCategory } from '../core/api.models';

export interface EventDay {
  dayNumber: number;
  dateLocal: string;
  startTimeLocal: string;
}

/** Event days are South African local time, which is UTC+2 all year. */
const SA_OFFSET = '+02:00';
const HOUR_MS = 3_600_000;

/** The programme gives a start time only: an evening start is assumed to last 3 hours, a day start 8. */
export function durationHours(d: EventDay): number {
  return Number(d.startTimeLocal.slice(0, 2)) >= 15 ? 3 : 8;
}

/** One entry per event day, keeping the earliest start when routes disagree. */
export function eventDays(routes: RouteCategory[]): EventDay[] {
  const byNumber = new Map<number, EventDay>();
  for (const r of routes) {
    for (const d of r.days) {
      if (!d.dateLocal || Number.isNaN(startMs(d))) continue;
      const day = { dayNumber: d.dayNumber, dateLocal: d.dateLocal, startTimeLocal: d.startTimeLocal };
      const seen = byNumber.get(d.dayNumber);
      if (!seen || startMs(day) < startMs(seen)) byNumber.set(d.dayNumber, day);
    }
  }
  return [...byNumber.values()].sort((a, b) => a.dayNumber - b.dayNumber);
}

/** The first moment of the event, or null when there is no usable day. */
export function eventStart(days: EventDay[]): Date | null {
  const starts = days.map(startMs).filter(Number.isFinite);
  return starts.length ? new Date(Math.min(...starts)) : null;
}

/** True once the last event day has finished. False when there are no usable days. */
export function eventOver(days: EventDay[], nowMs: number): boolean {
  const ends = days.map((d) => startMs(d) + durationHours(d) * HOUR_MS).filter(Number.isFinite);
  return ends.length > 0 && nowMs >= Math.max(...ends);
}

export function buildIcs(days: EventDay[], origin: string, confirmed: boolean, now = new Date()): string {
  const host = new URL(origin).hostname;
  const stamp = utcStamp(now);
  const events = days.flatMap((d) => {
    const start = startMs(d);
    return [
      'BEGIN:VEVENT',
      `UID:vasbyt-2027-dag${d.dayNumber}@${host}`,
      `DTSTAMP:${stamp}`,
      `DTSTART:${utcStamp(new Date(start))}`,
      `DTEND:${utcStamp(new Date(start + durationHours(d) * HOUR_MS))}`,
      `SUMMARY:${escapeText(`Vasbyt 2027 dag ${d.dayNumber}${confirmed ? '' : ' (voorlopig)'}`)}`,
      ...(confirmed ? [] : [`DESCRIPTION:${escapeText('Datums is voorlopig en kan nog verander.')}`]),
      `LOCATION:${escapeText('Orania, Noord-Kaap')}`,
      `URL:${origin}`,
      `STATUS:${confirmed ? 'CONFIRMED' : 'TENTATIVE'}`,
      'TRANSP:OPAQUE',
      'END:VEVENT',
    ];
  });
  return [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Vasbyt//Vasbyt 2027//AF', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    ...events, 'END:VCALENDAR', '',
  ].join('\r\n');
}

export function downloadIcs(days: EventDay[], confirmed: boolean): void {
  const url = URL.createObjectURL(new Blob([buildIcs(days, location.origin, confirmed)], { type: 'text/calendar;charset=utf-8' }));
  const link = Object.assign(document.createElement('a'), { href: url, download: 'vasbyt-2027.ics' });
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

function startMs(d: EventDay): number {
  return new Date(`${d.dateLocal}T${d.startTimeLocal.slice(0, 5)}:00${SA_OFFSET}`).getTime();
}

/** UTC basic format, e.g. 20270429T160000Z. */
function utcStamp(d: Date): string {
  return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

/** RFC 5545 text escaping: backslash, semicolon and comma are escaped, newlines become \n. */
function escapeText(s: string): string {
  return s.replace(/[\\;,]/g, (c) => '\\' + c).replace(/\n/g, '\\n');
}
