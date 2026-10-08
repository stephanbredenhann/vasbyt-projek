import { RouteCategory } from '../core/api.models';
import { buildIcs, EventDay, eventDays, eventOver, eventStart } from './calendar';

describe('add to calendar (.ics)', () => {
  const days: EventDay[] = [
    { dayNumber: 1, dateLocal: '2027-04-29', startTimeLocal: '18:00:00' },
    { dayNumber: 2, dateLocal: '2027-04-30', startTimeLocal: '06:00:00' },
    { dayNumber: 3, dateLocal: '2027-05-01', startTimeLocal: '06:00:00' },
  ];
  const now = new Date('2027-01-01T00:00:00Z');
  const route = (rows: Partial<EventDay>[]) => ({ days: rows }) as unknown as RouteCategory;

  it('writes one VEVENT per day with CRLF endings, status, and escaped text', () => {
    const ics = buildIcs(days, 'https://vasbyt.example', true, now);
    expect(ics.split('BEGIN:VEVENT').length - 1).toBe(3);
    expect(ics).toContain('METHOD:PUBLISH');
    expect(ics).toContain('STATUS:CONFIRMED');
    expect(ics).toContain('TRANSP:OPAQUE');
    expect(ics).toContain('LOCATION:Orania\\, Noord-Kaap');
    expect(ics).not.toContain('DESCRIPTION:');
    expect(ics).toMatch(/\r\n$/);
    expect(ics).not.toMatch(/(^|[^\r])\n/);
  });

  it('uses 3 hours for an evening start and 8 hours otherwise', () => {
    const ics = buildIcs(days, 'https://vasbyt.example', true, now);
    expect(ics).toContain('DTSTART:20270429T160000Z');
    expect(ics).toContain('DTEND:20270429T190000Z');
    expect(ics).toContain('DTSTART:20270430T040000Z');
    expect(ics).toContain('DTEND:20270430T120000Z');
  });

  it('marks provisional dates in the summary, description and status', () => {
    const ics = buildIcs(days, 'https://vasbyt.example', false, now);
    expect(ics).toContain('SUMMARY:Vasbyt 2027 dag 1 (voorlopig)');
    expect(ics).toContain('DESCRIPTION:Datums is voorlopig');
    expect(ics).toContain('STATUS:TENTATIVE');
  });

  it('keeps the earliest start per day and skips rows without a usable date or time', () => {
    const routes = [
      route([{ dayNumber: 1, dateLocal: '2027-04-29', startTimeLocal: '18:00:00' }]),
      route([
        { dayNumber: 1, dateLocal: '2027-04-29', startTimeLocal: '06:30:00' },
        { dayNumber: 2, dateLocal: '2027-04-30', startTimeLocal: 'xx' },
        { dayNumber: 3, dateLocal: '', startTimeLocal: '06:00:00' },
      ]),
    ];
    expect(eventDays(routes)).toEqual([{ dayNumber: 1, dateLocal: '2027-04-29', startTimeLocal: '06:30:00' }]);
  });

  it('gives the earliest start, and null or not-over for input with no usable day', () => {
    expect(eventStart(days)?.toISOString()).toBe('2027-04-29T16:00:00.000Z');
    expect(eventStart([{ dayNumber: 1, dateLocal: 'nope', startTimeLocal: 'x' }])).toBeNull();
    expect(eventStart([])).toBeNull();
    expect(eventOver([], Date.now())).toBeFalse();
    expect(eventOver(days, Date.parse('2027-05-01T15:00:00+02:00'))).toBeTrue();
    expect(eventOver(days, Date.parse('2027-04-29T12:00:00+02:00'))).toBeFalse();
  });
});
