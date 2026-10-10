import { fromSast, toSast } from './admin-tariffs';

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
});
