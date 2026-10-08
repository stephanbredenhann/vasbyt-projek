import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { OrderFlowService } from '../core/order-flow.service';
import { I18nService } from '../i18n/i18n.service';
import { ProductChooser } from '../shared/product-chooser';
import { Steps } from './steps';

/** The optional "add to your order" stop after choosing entries. It edits the same basket as /winkel. */
@Component({
  selector: 'vb-register-products',
  standalone: true,
  imports: [RouterLink, ProductChooser, Steps],
  template: `
    <div class="container section">
      <vb-steps current="choose" />
      <h1>{{ i18n.t('reg.productsTitle') }}</h1>
      <p class="lead">{{ i18n.t('reg.productsIntro') }}</p>
      <vb-product-chooser />
      <div class="actions">
        <a class="btn btn--ghost" routerLink="/registreer">{{ i18n.t('reg.back') }}</a>
        <a class="btn btn--primary btn--lg" routerLink="/mandjie">
          {{ flow.productCount() ? i18n.t('reg.continue') : i18n.t('reg.skip') }}
        </a>
      </div>
    </div>
  `,
  styles: `.actions { display: flex; flex-wrap: wrap; gap: var(--space-4); }`,
})
export class RegisterProducts {
  protected readonly i18n = inject(I18nService);
  protected readonly flow = inject(OrderFlowService);
}
