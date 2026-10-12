import { lineLabel } from './line-label';
import { I18nService } from '../i18n/i18n.service';

describe('lineLabel', () => {
  const t = { t: (k: string) => k } as unknown as I18nService;
  const base = { description: 'Early entry 1 Mar', routeCode: null, tariffKind: null } as const;

  it('names a ticket by route and tariff group', () => {
    expect(lineLabel({ ...base, kind: 'Ticket', routeCode: 'ligstap', tariffKind: 'Normal' }, t)).toBe('routes.ligstap.name, reg.normal');
  });
  it('names a student ticket', () => {
    expect(lineLabel({ ...base, kind: 'Ticket', routeCode: 'ligstap', tariffKind: 'Student' }, t)).toBe('routes.ligstap.name, reg.student');
  });
  it('translates the donation line', () => {
    expect(lineLabel({ ...base, kind: 'Donation', description: 'Donasie' }, t)).toBe('reg.donationLine');
  });
  it('passes a product name through', () => {
    expect(lineLabel({ ...base, kind: 'Product', description: 'Cap - Blue' }, t)).toBe('Cap - Blue');
  });
});
