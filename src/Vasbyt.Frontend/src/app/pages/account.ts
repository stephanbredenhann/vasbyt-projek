import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { EntrantSummary, Order, OrderStatus } from '../core/api.models';
import { ApiService } from '../core/api.service';
import { AuthService } from '../core/auth.service';
import { TranslationKey } from '../i18n/af';
import { I18nService } from '../i18n/i18n.service';
import { QrPass } from '../shared/qr-pass';

const STATUS: Record<OrderStatus, TranslationKey> = {
  Pending: 'account.statusPending',
  Paid: 'account.statusPaid',
  Cancelled: 'account.statusCancelled',
};

/**
 * Everything bought while signed in or linked from a receipt: entries, shop orders and donations. Spec 8.2: a paid order with blank forms is normal, so this page
 * names the ones still outstanding and links straight back to them.
 *
 * OrderResponse carries no identity number and no medical field, so there is nothing to hide here.
 */
@Component({
  selector: 'vb-account',
  standalone: true,
  imports: [RouterLink, CurrencyPipe, DatePipe, QrPass],
  template: `
    <div class="container section">
      <h1>{{ i18n.t('account.title') }}</h1>
      @if (auth.user(); as u) {
        <p class="lead">{{ u.firstName }} {{ u.lastName }} · {{ u.email }}</p>
      }

      @if (passes().length) {
        <h2>{{ i18n.t('account.passes') }}</h2>
        <p class="muted">{{ i18n.t('account.passesNote') }}</p>
        <div class="passes">
          @for (e of passes(); track e.id) { <vb-qr-pass [entrant]="e" /> }
        </div>
      }

      <h2>{{ i18n.t('account.orders') }}</h2>

      @if (error()) {
        <p class="alert alert--error" role="alert">{{ i18n.t('common.error') }}</p>
        <button type="button" class="btn btn--ghost" (click)="load()">{{ i18n.t('account.retry') }}</button>
      } @else if (orders() === null) {
        <p class="muted">{{ i18n.t('common.loading') }}</p>
      } @else if (orders()!.length) {
        @for (o of orders(); track o.token) {
          <article class="card order" [class.card--accent]="outstanding(o) > 0">
            <header>
              <div>
                <span class="eyebrow">{{ i18n.t('account.reference') }}</span>
                <h3>{{ o.reference }}</h3>
                <p class="muted">
                  {{ i18n.t('account.placed') }} {{ o.createdUtc | date: 'yyyy-MM-dd' }} ·
                  {{ o.totalZar | currency: 'ZAR' : 'symbol-narrow' : '1.2-2' }}
                </p>
              </div>
              <span class="status" [class.status--paid]="o.status === 'Paid'">
                @if (o.status === 'Paid') { <span aria-hidden="true">✓</span> }
                {{ i18n.t(status(o.status)) }}
              </span>
            </header>

            @if (o.status === 'Pending') {
              <p class="actions">
                <a class="btn btn--accent" [routerLink]="['/bestel', o.token, 'betaal']">{{ i18n.t('account.payNow') }}</a>
              </p>
            } @else if (o.status === 'Paid') {
              <p class="actions"><a [routerLink]="['/bestel', o.token, 'klaar']">{{ i18n.t('account.receipt') }}</a></p>
            }

            <h4>{{ i18n.t('account.lines') }}</h4>
            <ul class="lines">
              @for (l of o.lines; track l.id) {
                <li>
                  <span>
                    {{ l.quantity }} × {{ l.description }}
                    @if (l.kind === 'Product' && o.status === 'Paid') {
                      <span class="muted block">
                        {{ l.collectedQuantity >= l.quantity ? i18n.t('account.collected') : i18n.t('account.toCollect') + ' (' + (l.quantity - l.collectedQuantity) + ')' }}
                      </span>
                    }
                  </span>
                  <span class="amount">
                    {{ l.lineTotalZar | currency: 'ZAR' : 'symbol-narrow' : '1.2-2' }}
                  </span>
                </li>
              }
            </ul>

            @if (hasTickets(o)) {
            <h4>{{ i18n.t('account.participants') }}</h4>
            @if (o.entrants.length) {
              @if (outstanding(o) > 0) {
                <p class="alert">
                  @if (outstanding(o) === 1) {
                    {{ i18n.t('account.outstandingOne') }}
                  } @else {
                    {{ outstanding(o) }} {{ i18n.t('account.outstanding') }}.
                  }
                  {{ i18n.t('account.outstandingNote') }}
                </p>
              }
              <ul class="entrants">
                @for (e of o.entrants; track e.id) {
                  <li>
                    <div>
                      <strong>
                        @if (e.firstName || e.lastName) {
                          {{ e.firstName }} {{ e.lastName }}
                        } @else {
                          {{ i18n.t('account.entrant') }} {{ $index + 1 }}
                        }
                      </strong>
                      <span class="muted block">{{ e.routeName }}</span>
                    </div>
                    @if (e.isComplete) {
                      <span class="chip chip--quiet">
                        {{ i18n.t('account.entryNumber') }} {{ e.entryNumber }}
                      </span>
                    } @else {
                      <a
                        class="btn btn--accent"
                        [routerLink]="['/registreer', o.token, 'deelnemer', $index + 1]"
                      >
                        {{ i18n.t('account.finish') }}
                      </a>
                    }
                  </li>
                }
              </ul>
            } @else {
              <p class="muted">{{ i18n.t('account.noEntrants') }}</p>
            }
            }
          </article>
        }
      } @else {
        <p class="muted">{{ i18n.t('account.none') }}</p>
        <p class="actions">
          <a class="btn btn--accent" routerLink="/registreer">{{ i18n.t('nav.register') }}</a>
          <a class="btn btn--ghost" routerLink="/winkel">{{ i18n.t('basket.toShop') }}</a>
        </p>
      }
    </div>
  `,
  styles: `
    .container > h2 { margin-top: var(--space-12); }
    .status { display: flex; gap: .4rem; align-items: center; font-size: 0.9375rem; font-weight: 600; color: var(--ink-muted); }
    .status--paid { color: var(--ok); }
    .passes { display: grid; gap: var(--space-4); margin-bottom: var(--space-8); max-width: 48rem; }
    .order {
      max-width: 48rem;
      margin-bottom: var(--space-6);
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

    h4 {
      margin: var(--space-8) 0 var(--space-2);
    }

    ul {
      list-style: none;
      margin: 0;
      padding: 0;
    }

    li {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: var(--space-4);
      flex-wrap: wrap;
      padding-block: var(--space-3);
      border-top: 1px solid var(--rule);
    }

    .amount {
      font-variant-numeric: tabular-nums;
      font-weight: 600;
    }

    .actions { display: flex; flex-wrap: wrap; gap: var(--space-3); margin: var(--space-4) 0 0; }

    .block {
      display: block;
      font-size: 0.9375rem;
    }
  `,
})
export class Account {
  protected readonly i18n = inject(I18nService);
  protected readonly auth = inject(AuthService);
  private readonly api = inject(ApiService);
  protected readonly orders = signal<Order[] | null>(null);
  protected readonly error = signal(false);
  protected readonly passes = computed<EntrantSummary[]>(() =>
    (this.orders() ?? []).filter((o) => o.status === 'Paid').flatMap((o) => o.entrants.filter((e) => e.isComplete && e.qrPayload)));

  constructor() { this.load(); }

  protected load() {
    this.error.set(false);
    this.orders.set(null);
    this.api.myOrders().subscribe({ next: (o) => this.orders.set(o), error: () => this.error.set(true) });
  }

  protected hasTickets(o: Order) { return o.lines.some((l) => l.kind === 'Ticket'); }

  protected status(s: OrderStatus) {
    return STATUS[s];
  }

  /** Paid but blank: the follow-up the spec asks the participant to finish in their own time. */
  protected outstanding(o: Order) {
    return o.entrants.filter((e) => !e.isComplete).length;
  }
}
