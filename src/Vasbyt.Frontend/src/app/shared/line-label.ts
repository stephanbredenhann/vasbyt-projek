import { OrderLine } from '../core/api.models';
import { I18nService } from '../i18n/i18n.service';
import { routeKey } from '../pages/routes-page';

/** One name per order line on every buyer page: tickets by route and tariff group, not the admin price-window text. */
export function lineLabel(l: Pick<OrderLine, 'kind' | 'description' | 'routeCode' | 'tariffKind'>, i18n: I18nService): string {
  const t = (k: Parameters<I18nService['t']>[0]) => i18n.t(k);
  if (l.kind === 'Ticket' && l.routeCode && l.tariffKind) {
    return `${t(routeKey(l.routeCode, 'name'))}, ${t(l.tariffKind === 'Student' ? 'reg.student' : 'reg.normal')}`;
  }
  return l.kind === 'Donation' ? t('reg.donationLine') : l.description;
}
