import { RuleDraft, fromSast, overlaps, toSast, windowError } from './admin-tariffs';

describe('tariff times', () => {
  it('shows a UTC stamp in South African time, across midnight', () => {
    expect(toSast('2027-01-31T22:00:00Z')).toBe('2027-02-01T00:00');
  });

  it('reads a stamp without a zone as UTC', () => {
    expect(toSast('2027-01-31T22:00:00')).toBe('2027-02-01T00:00');
  });

  it('sends South African input back as the same instant in UTC', () => {
    expect(fromSast('2027-02-01T00:00')).toBe('2027-01-31T22:00:00.000Z');
  });

  it('round-trips', () => {
    expect(toSast(fromSast('2026-12-31T23:30'))).toBe('2026-12-31T23:30');
  });

  it('gives an empty string for an incomplete or unreadable value', () => {
    expect(fromSast('')).toBe('');
    expect(fromSast('2027-02-01')).toBe('');
    expect(toSast('nonsense')).toBe('');
  });

  it('reads a stamp with long fractional seconds', () => {
    expect(toSast('2027-01-31T22:00:00.1234567')).toBe('2027-02-01T00:00');
  });
});

describe('windowError', () => {
  it('requires a start', () => expect(windowError('', '2027-01-02T00:00')).toBe('admin.validFromRequired'));
  it('requires an end', () => expect(windowError('2027-01-01T00:00', '')).toBe('admin.validToRequired'));
  it('refuses an end before or at the start', () => {
    expect(windowError('2027-01-02T00:00', '2027-01-01T00:00')).toBe('admin.validToAfterFrom');
    expect(windowError('2027-01-01T00:00', '2027-01-01T00:00')).toBe('admin.validToAfterFrom');
  });
  it('accepts a later end', () => expect(windowError('2027-01-01T00:00', '2027-01-02T00:00')).toBeNull());
});

describe('overlaps', () => {
  const rule = (kind: 'Normal' | 'Student', from: string, to: string, isActive = true): RuleDraft =>
    ({ tariffKind: kind, label: '', amountZar: 0, isActive, from, to });
  const a = rule('Normal', '2027-01-01T00:00', '2027-02-01T00:00');

  it('flags the same kind crossing', () => {
    const b = rule('Normal', '2027-01-15T00:00', '2027-03-01T00:00');
    expect(overlaps(a, [a, b])).toBe(true);
    expect(overlaps(b, [a, b])).toBe(true);
  });
  it('ignores another kind', () => expect(overlaps(a, [a, rule('Student', '2027-01-15T00:00', '2027-03-01T00:00')])).toBe(false));
  it('ignores an inactive rule', () => expect(overlaps(a, [a, rule('Normal', '2027-01-15T00:00', '2027-03-01T00:00', false)])).toBe(false));
  it('does not flag touching end to start', () => expect(overlaps(a, [a, rule('Normal', '2027-02-01T00:00', '2027-03-01T00:00')])).toBe(false));
});
