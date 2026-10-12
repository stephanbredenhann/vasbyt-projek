import { parseSaId } from './sa-id';

describe('parseSaId', () => {
  const today = new Date(2026, 9, 12);

  it('reads date of birth, century and gender', () => {
    expect(parseSaId('8503125800081', today)).toEqual({ dateOfBirth: '1985-03-12', gender: 'M' });
    expect(parseSaId('0507010123085', today)).toEqual({ dateOfBirth: '2005-07-01', gender: 'V' });
    expect(parseSaId('0002295009084', today)).toEqual({ dateOfBirth: '2000-02-29', gender: 'M' });
  });

  it('rejects a bad checksum, an impossible date and anything not 13 digits', () => {
    expect(parseSaId('8503125800086', today)).toBeNull();
    expect(parseSaId('0102295009082', today)).toBeNull();
    expect(parseSaId('A12345678', today)).toBeNull();
  });
});
