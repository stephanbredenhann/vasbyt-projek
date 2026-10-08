import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { OrderFlowService } from '../core/order-flow.service';
import { I18nService } from '../i18n/i18n.service';
import { ProductChooser } from '../shared/product-chooser';

/** The standalone shop. Same basket as the entry flow, so nothing here needs a ticket. */
@Component({
  selector: 'vb-shop',
  standalone: true,
  imports: [RouterLink, ProductChooser],
  template: `
    <div class="container section">
      <h1>{{ i18n.t('shop.title') }}</h1>
      <p class="lead">{{ i18n.t('shop.intro') }}</p>
      <p class="muted">{{ i18n.t('shop.collectNote') }}</p>
      <vb-product-chooser />
      @if (!flow.ticketCount()) {
        <p class="muted">{{ i18n.t('shop.enterToo') }} <a routerLink="/registreer">{{ i18n.t('basket.addTickets') }}</a></p>
      }
    </div>
  `,
})
export class Shop {
  protected readonly i18n = inject(I18nService);
  protected readonly flow = inject(OrderFlowService);
}
