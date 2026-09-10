import { CurrencyPipe, DecimalPipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { RouteCategory, Tariff, TariffKind } from '../core/api.models';
import { ApiService } from '../core/api.service';
import { OrderFlowService } from '../core/order-flow.service';
import { I18nService } from '../i18n/i18n.service';
import { Steps } from './steps';

/**
 * Step 1 of 7. Spec 5: the two tariff groups do not get a screen of their own, they sit on the same
 * screen as the six route categories, and the user picks a quantity per combination.
 *
 * Every price shown here comes from /api/tariffs and the running total is only ever an estimate:
 * POST /api/orders reprices the whole cart and its totalZar is what gets paid.
 */
@Component({
  selector: 'vb-register-choose',
  standalone: true,
  imports: [CurrencyPipe, DecimalPipe, RouterLink, Steps],
  template: `
    <div class="container section">
      <vb-steps [current]="1" />
      <h1>{{ i18n.t('reg.chooseTitle') }}</h1>
      @if (sellable()) {
        <p class="lead">{{ i18n.t('reg.chooseIntro') }}</p>
      }

      @if (error()) {
        <p class="alert alert--error">{{ error() }}</p>
      }

      @if (loaded() && !sellable()) {
        <!-- No open window means no quantity to pick, so the grid and its total would only be six
             empty cards and a dead button. -->
        <div class="card panel">
          <h2>{{ i18n.t('reg.entriesClosed') }}</h2>
          <p class="muted">{{ i18n.t('reg.entriesClosedBody') }}</p>
          <a class="btn btn--primary" routerLink="/roetes">{{ i18n.t('reg.seeRoutes') }}</a>
        </div>
      }

      @if (sellable()) {
      <div class="routes">
        @for (r of routes(); track r.id) {
          <div class="card route">
            <div class="route__head">
              <h2>{{ r.name }}</h2>
              @if (r.isOpen) {
                <span class="muted">
                  {{ r.totalDistanceKm | number: '1.0-2' }} km ·
                  {{ r.elevationGainM | number: '1.0-0' }} m
                </span>
              } @else {
                <span class="chip">{{ i18n.t('reg.notOpen') }}</span>
              }
            </div>

            @if (r.isOpen) {
              <div class="cells">
                @for (t of tariffs(); track t.kind) {
                  <label class="cell">
                    <span class="cell__label">{{ i18n.t(label(t.kind)) }}</span>
                    <span class="cell__price">
                      {{ t.amountZar | currency: 'ZAR' : 'symbol-narrow' : '1.0-0' }}
                    </span>
                    <span class="visually-hidden">{{ i18n.t('reg.qty') }}</span>
                    <input
                      type="number"
                      min="0"
                      max="20"
                      inputmode="numeric"
                      [value]="flow.ticketQuantity(r.id, t.kind)"
                      (input)="setQty(r.id, t.kind, $event)"
                    />
                  </label>
                }
              </div>
            } @else {
              <p class="muted route__closed">{{ i18n.t('reg.notOpenHint') }}</p>
            }
          </div>
        }
      </div>

      <div class="card total">
        <div>
          <span class="eyebrow">{{ i18n.t('reg.estimate') }}</span>
          <strong>{{ estimate() | currency: 'ZAR' : 'symbol-narrow' : '1.0-0' }}</strong>
          <span class="muted">{{ count() }} {{ i18n.t('reg.tickets') }}</span>
        </div>
        <button type="button" class="btn btn--primary btn--lg" [disabled]="!count() || count() > 20"
                (click)="next()">
          {{ i18n.t('reg.continue') }}
        </button>
      </div>

      <p class="muted hint">{{ i18n.t('reg.estimateHint') }}</p>
      @if (count() > 20) {
        <p class="alert alert--error">{{ i18n.t('reg.max20') }}</p>
      }
      }
    </div>
  `,
  styles: `
    .panel {
      max-width: 34rem;
    }

    .panel h2 {
      font-size: 1.5rem;
    }

    .routes {
      display: grid;
      gap: var(--space-4);
      margin-bottom: var(--space-8);
    }

    .route {
      padding: var(--space-6);
    }

    .route__head {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: var(--space-4);
      flex-wrap: wrap;
      margin-bottom: var(--space-4);
    }

    .route__head h2 {
      margin: 0;
      font-size: 1.5rem;
    }

    .route__closed {
      margin: 0;
      font-size: 0.875rem;
    }

    /* The two tariff columns of the spec's 6 x 2 grid. They stack on a phone. */
    .cells {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: var(--space-3);
    }

    @media (max-width: 560px) {
      .cells {
        grid-template-columns: 1fr;
      }
    }

    .cell {
      display: grid;
      grid-template-columns: 1fr auto;
      align-items: center;
      gap: var(--space-1) var(--space-4);
      background: var(--karoo-sand-light);
      border-radius: var(--r-md);
      padding: var(--space-4);
    }

    .cell__label {
      font-size: 0.8125rem;
      font-weight: 600;
      letter-spacing: 0.02em;
    }

    .cell__price {
      grid-column: 1;
      font-family: var(--font-display);
      font-size: 1.375rem;
      line-height: 1;
    }

    .cell input {
      grid-column: 2;
      grid-row: 1 / span 2;
      width: 4.5rem;
      text-align: center;
      font-family: var(--font-display);
      font-size: 1.25rem;
    }

    .total {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--space-6);
      flex-wrap: wrap;
      padding: var(--space-6);
    }

    .total strong {
      display: block;
      font-family: var(--font-display);
      font-size: 2rem;
      line-height: 1.1;
    }

    .total .muted {
      font-size: 0.875rem;
    }

    .hint {
      font-size: 0.875rem;
      margin-top: var(--space-4);
    }
  `,
})
export class RegisterChoose {
  protected readonly i18n = inject(I18nService);
  protected readonly flow = inject(OrderFlowService);
  private api = inject(ApiService);
  private router = inject(Router);

  protected readonly routes = signal<RouteCategory[]>([]);
  protected readonly tariffs = signal<Tariff[]>([]);
  protected readonly loaded = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly count = this.flow.ticketCount;

  /** An empty tariff list is the server saying every window has closed. Nothing here is buyable. */
  protected readonly sellable = computed(() => this.tariffs().length > 0);

  /** An estimate only. The server reprices the cart on POST /api/orders. */
  protected readonly estimate = computed(() => {
    const prices = new Map(this.tariffs().map((t) => [t.kind, t.amountZar]));
    return this.flow
      .cart()
      .tickets.reduce((sum, t) => sum + (prices.get(t.tariffKind) ?? 0) * t.quantity, 0);
  });

  constructor() {
    this.api.routes().subscribe({
      next: (r) => this.routes.set(r),
      error: () => this.error.set(this.i18n.t('common.error')),
    });
    this.api.tariffs().subscribe({
      next: (t) => {
        this.tariffs.set(t);
        this.loaded.set(true);
      },
      error: () => this.error.set(this.i18n.t('common.error')),
    });
  }

  protected label(kind: TariffKind) {
    return kind === 'Student' ? 'reg.student' : 'reg.normal';
  }

  protected setQty(routeCategoryId: number, kind: TariffKind, event: Event) {
    const raw = Number((event.target as HTMLInputElement).value);
    this.flow.setTicket(routeCategoryId, kind, Math.min(20, Math.max(0, Math.trunc(raw) || 0)));
  }

  protected next() {
    this.router.navigate(['/registreer/produkte']);
  }
}
