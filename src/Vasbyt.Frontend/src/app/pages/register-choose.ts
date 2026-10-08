import { CurrencyPipe, DecimalPipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { RouteCategory, Tariff, TariffKind } from '../core/api.models';
import { ApiService } from '../core/api.service';
import { OrderFlowService } from '../core/order-flow.service';
import { I18nService } from '../i18n/i18n.service';
import { DisciplineIcon } from '../shared/discipline-icon';
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
  imports: [CurrencyPipe, DecimalPipe, RouterLink, Steps, DisciplineIcon],
  template: `
    <div class="container section">
      <vb-steps current="choose" />
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
      <div class="grid grid--2 routes">
        @for (r of routes(); track r.id) {
          <div class="card card--event route" [attr.data-event]="r.code">
            <div class="route__head">
              <h2><vb-discipline-icon [discipline]="r.discipline" /> {{ r.name }}</h2>
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
                  <div class="cell">
                    <label class="cell__label" [for]="'qty-' + r.id + '-' + t.kind">{{ i18n.t(label(t.kind)) }}</label>
                    <span class="cell__price">
                      {{ t.amountZar | currency: 'ZAR' : 'symbol-narrow' : '1.0-0' }}
                    </span>
                    <span class="stepper" role="group" [attr.aria-label]="i18n.t('reg.qty') + ': ' + r.name + ', ' + i18n.t(label(t.kind))">
                      <button type="button" class="stepper__btn" [attr.aria-label]="i18n.t('reg.fewer')"
                              [disabled]="!flow.ticketQuantity(r.id, t.kind)" (click)="bump(r.id, t.kind, -1)">−</button>
                      <input
                        class="stepper__value"
                        type="text"
                        inputmode="numeric"
                        pattern="[0-9]*"
                        maxlength="2"
                        autocomplete="off"
                        [id]="'qty-' + r.id + '-' + t.kind"
                        [value]="flow.ticketQuantity(r.id, t.kind)"
                        (input)="setQty(r.id, t.kind, $event)"
                        (blur)="tidy(r.id, t.kind, $event)"
                        (focus)="select($event)"
                      />
                      <button type="button" class="stepper__btn" [attr.aria-label]="i18n.t('reg.more')"
                              [disabled]="count() >= 20" (click)="bump(r.id, t.kind, 1)">+</button>
                    </span>
                  </div>
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
      margin-bottom: var(--space-8);
    }

    .route {
      padding: var(--space-6);
      gap: var(--space-4);
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
      display: flex;
      align-items: center;
      gap: var(--space-2);
      margin: 0;
      font-size: 1.5rem;
      color: var(--ev);
    }

    .route__closed {
      margin: auto 0;
      font-size: 0.875rem;
    }

    /* Both tariffs on the one route card, one row each. */
    .cells {
      display: grid;
      gap: var(--space-3);
      margin-top: auto;
    }

    .cell {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      align-items: center;
      gap: var(--space-1) var(--space-4);
      background: var(--paper);
      border-radius: var(--r-md);
      padding: var(--space-3) var(--space-3) var(--space-3) var(--space-4);
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

    .cell .stepper {
      grid-column: 2;
      grid-row: 1 / span 2;
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
  private deepLink = inject(ActivatedRoute).snapshot.queryParamMap.get('roete');

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
      next: (r) => {
        this.routes.set(r);
        // A route card's register link preselects one normal ticket on that route.
        const want = r.find((x) => x.code === this.deepLink && x.isOpen);
        if (want && !this.flow.ticketCount()) this.flow.setTicket(want.id, 'Normal', 1);
      },
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

  protected bump(routeCategoryId: number, kind: TariffKind, by: number) {
    const next = this.flow.ticketQuantity(routeCategoryId, kind) + by;
    this.flow.setTicket(routeCategoryId, kind, Math.min(20, Math.max(0, next)));
  }

  /** Digits only, 0 to 20. An empty field while typing counts as 0 but is left empty. */
  protected setQty(routeCategoryId: number, kind: TariffKind, event: Event) {
    const field = event.target as HTMLInputElement;
    const digits = field.value.replace(/\D/g, '');
    const qty = Math.min(20, Number(digits) || 0);
    if (digits !== '' && field.value !== String(qty)) field.value = String(qty);
    else if (digits === '' && field.value !== '') field.value = '';
    this.flow.setTicket(routeCategoryId, kind, qty);
  }

  protected tidy(routeCategoryId: number, kind: TariffKind, event: Event) {
    (event.target as HTMLInputElement).value = String(this.flow.ticketQuantity(routeCategoryId, kind));
  }

  protected select(event: Event) {
    (event.target as HTMLInputElement).select();
  }

  protected next() {
    this.router.navigate(['/registreer/produkte']);
  }
}
