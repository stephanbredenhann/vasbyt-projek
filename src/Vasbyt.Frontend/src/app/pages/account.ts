import { CurrencyPipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Order } from '../core/api.models';
import { ApiService } from '../core/api.service';
import { AuthService } from '../core/auth.service';
import { I18nService } from '../i18n/i18n.service';

@Component({
  selector: 'vb-account',
  standalone: true,
  imports: [RouterLink, CurrencyPipe],
  template: `
    <div class="container section">
      <h1>{{ i18n.t('account.title') }}</h1>
      @if (auth.user(); as u) {
        <p class="lead">{{ u.firstName }} {{ u.lastName }} · {{ u.email }}</p>
      }

      <h2>{{ i18n.t('account.orders') }}</h2>

      @if (orders().length) {
        @for (o of orders(); track o.token) {
          <article class="card order">
            <header>
              <div>
                <h3>{{ o.entrantCount }} {{ i18n.t(o.entrantCount === 1 ? 'common.person' : 'common.people') }}</h3>
                <p class="muted">
                  {{ o.entrantsFilled }} / {{ o.entrantCount }} {{ i18n.t('account.filled') }} ·
                  {{ o.amountZar | currency: 'ZAR' : 'symbol-narrow' : '1.2-2' }}
                </p>
              </div>
              @if (o.entrantsFilled < o.entrantCount) {
                <a
                  class="btn btn--primary"
                  [routerLink]="['/registreer', o.token, 'deelnemer', o.entrantsFilled + 1]"
                >
                  {{ i18n.t('common.next') }}
                </a>
              }
            </header>

            <ul>
              @for (e of o.entrants; track e.id) {
                <li>
                  {{ e.firstName }} {{ e.lastName }}
                  <span class="muted">{{ e.eventName }} — {{ e.distanceName }}</span>
                </li>
              }
            </ul>
          </article>
        }
      } @else {
        <p class="muted">{{ i18n.t('account.none') }}</p>
        <a class="btn btn--accent" routerLink="/registreer">{{ i18n.t('nav.register') }}</a>
      }
    </div>
  `,
  styles: `
    .order {
      max-width: 44rem;
      margin-bottom: var(--space-4);
    }

    .order header {
      display: flex;
      justify-content: space-between;
      align-items: start;
      gap: var(--space-6);
      flex-wrap: wrap;
    }

    .order h3 {
      margin-bottom: var(--space-1);
    }

    ul {
      list-style: none;
      margin: var(--space-4) 0 0;
      padding: 0;
    }

    li {
      display: flex;
      justify-content: space-between;
      gap: var(--space-4);
      flex-wrap: wrap;
      padding: var(--space-2) 0;
      border-top: var(--border);
    }
  `,
})
export class Account {
  protected readonly i18n = inject(I18nService);
  protected readonly auth = inject(AuthService);
  protected readonly orders = signal<Order[]>([]);

  constructor() {
    inject(ApiService).myOrders().subscribe((o) => this.orders.set(o));
  }
}
