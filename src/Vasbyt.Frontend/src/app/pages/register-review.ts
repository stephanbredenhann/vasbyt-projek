import { CurrencyPipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Order, Product, RouteCategory, Tariff } from '../core/api.models';
import { ApiService } from '../core/api.service';
import { Buyer, OrderFlowService } from '../core/order-flow.service';
import { I18nService } from '../i18n/i18n.service';
import { Steps } from './steps';

/**
 * Step 4 of 7, and the point of spec 7: the order and its reference exist before the user leaves
 * for the payment portal, so an interrupted payment is resumed rather than rebuilt.
 *
 * The amounts on the left are the client's estimate. The panel that replaces them after
 * POST /api/orders shows the server's own lines and total, which is what actually gets paid.
 */
@Component({
  selector: 'vb-register-review',
  standalone: true,
  imports: [CurrencyPipe, FormsModule, RouterLink, Steps],
  template: `
    <div class="container section">
      <vb-steps [current]="4" />
      <h1>{{ i18n.t('reg.reviewTitle') }}</h1>

      @if (created(); as o) {
        <div class="card card--ok panel">
          <p class="eyebrow">{{ i18n.t('reg.orderSaved') }}</p>
          <p class="reference">{{ o.reference }}</p>
          <p class="muted">{{ i18n.t('reg.orderSavedBody') }}</p>

          <dl class="lines">
            @for (l of o.lines; track l.id) {
              <dt>{{ l.description }} <span class="muted">× {{ l.quantity }}</span></dt>
              <dd>{{ l.lineTotalZar | currency: 'ZAR' : 'symbol-narrow' : '1.2-2' }}</dd>
            }
            <dt class="is-total">{{ i18n.t('reg.total') }}</dt>
            <dd class="is-total">{{ o.totalZar | currency: 'ZAR' : 'symbol-narrow' : '1.2-2' }}</dd>
          </dl>

          <button type="button" class="btn btn--accent btn--lg" (click)="toPayment()">
            {{ i18n.t('reg.toPayment') }}
          </button>
        </div>
      } @else if (flow.isEmpty()) {
        <p class="alert">{{ i18n.t('reg.emptyCart') }}</p>
        <a class="btn btn--primary" routerLink="/registreer">{{ i18n.t('reg.startOver') }}</a>
      } @else {
        <div class="split">
          <form #f="ngForm" class="card" (ngSubmit)="submit(f)">
            <h2>{{ i18n.t('reg.buyer') }}</h2>
            <p class="muted">{{ i18n.t('reg.buyerIntro') }}</p>

            @if (error()) {
              <p class="alert alert--error">{{ error() }}</p>
            }

            <div class="field-row">
              <label class="field">
                <span>{{ i18n.t('entrant.firstName') }}</span>
                <input type="text" name="firstName" [(ngModel)]="buyer.firstName" required
                       autocomplete="given-name" />
              </label>
              <label class="field">
                <span>{{ i18n.t('entrant.lastName') }}</span>
                <input type="text" name="lastName" [(ngModel)]="buyer.lastName" required
                       autocomplete="family-name" />
              </label>
            </div>

            <div class="field-row">
              <label class="field">
                <span>{{ i18n.t('entrant.email') }}</span>
                <input type="email" name="email" [(ngModel)]="buyer.email" required
                       autocomplete="email" />
              </label>
              <label class="field">
                <span>{{ i18n.t('entrant.phone') }}</span>
                <input type="tel" name="phone" [(ngModel)]="buyer.phone" autocomplete="tel" />
              </label>
            </div>

            <button type="submit" class="btn btn--primary btn--lg btn--block"
                    [disabled]="busy() || f.invalid">
              {{ busy() ? i18n.t('reg.creating') : i18n.t('reg.createOrder') }}
            </button>
          </form>

          <div class="card cart">
            <h2>{{ i18n.t('pay.summary') }}</h2>
            <dl class="lines">
              @for (l of summary(); track l.label) {
                <dt>{{ l.label }} <span class="muted">× {{ l.quantity }}</span></dt>
                <dd>{{ l.total | currency: 'ZAR' : 'symbol-narrow' : '1.0-0' }}</dd>
              }
            </dl>
            <a class="btn btn--ghost" routerLink="/registreer">{{ i18n.t('reg.edit') }}</a>
          </div>
        </div>
      }
    </div>
  `,
  styles: `
    .split {
      display: grid;
      grid-template-columns: minmax(0, 1.3fr) minmax(0, 1fr);
      gap: var(--space-6);
      align-items: start;
    }

    @media (max-width: 720px) {
      .split {
        grid-template-columns: 1fr;
      }
    }

    .panel {
      max-width: 40rem;
    }

    .reference {
      font-family: var(--font-display);
      font-size: clamp(1.75rem, 5vw, 2.5rem);
      letter-spacing: 0.02em;
      margin: 0 0 var(--space-2);
    }

    .lines {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: var(--space-2) 0;
      margin: var(--space-6) 0;
      font-size: 0.9375rem;
    }

    .lines dt {
      padding-right: var(--space-4);
    }

    .lines dd {
      margin: 0;
      text-align: right;
      font-variant-numeric: tabular-nums;
    }

    .lines .is-total {
      padding-top: var(--space-3);
      border-top: 1px solid var(--rule);
      font-weight: 700;
      font-size: 1.0625rem;
    }

    .cart h2,
    .split form h2 {
      font-size: 1.375rem;
    }

    .hint {
      font-size: 0.8125rem;
    }
  `,
})
export class RegisterReview {
  protected readonly i18n = inject(I18nService);
  protected readonly flow = inject(OrderFlowService);
  private api = inject(ApiService);
  private router = inject(Router);

  protected buyer: Buyer = { ...this.flow.cart().buyer };
  protected readonly created = signal<Order | null>(null);
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);

  private readonly routes = signal<RouteCategory[]>([]);
  private readonly tariffs = signal<Tariff[]>([]);
  private readonly products = signal<Product[]>([]);

  /** The cart with names and estimated prices hung off it, purely so the user can read it back. */
  protected readonly summary = computed(() => {
    const cart = this.flow.cart();
    const routes = new Map(this.routes().map((r) => [r.id, r.name]));
    const prices = new Map(this.tariffs().map((t) => [t.kind, t.amountZar]));
    const variants = new Map(
      this.products().flatMap((p) =>
        p.variants.map((v) => [v.id, { label: `${p.name} - ${v.label}`, price: v.priceZar }] as const),
      ),
    );

    const rows = cart.tickets.map((t) => {
      const price = prices.get(t.tariffKind) ?? 0;
      const kind = this.i18n.t(t.tariffKind === 'Student' ? 'reg.student' : 'reg.normal');
      return {
        label: `${routes.get(t.routeCategoryId) ?? ''} - ${kind}`,
        quantity: t.quantity,
        total: price * t.quantity,
      };
    });

    for (const p of cart.products) {
      const v = variants.get(p.productVariantId);
      rows.push({
        label: v?.label ?? this.i18n.t('reg.products'),
        quantity: p.quantity,
        total: (v?.price ?? 0) * p.quantity,
      });
    }

    if (cart.donationZar > 0) {
      rows.push({ label: this.i18n.t('reg.donation'), quantity: 1, total: cart.donationZar });
    }
    return rows;
  });

  constructor() {
    this.api.routes().subscribe((r) => this.routes.set(r));
    this.api.tariffs().subscribe((t) => this.tariffs.set(t));
    this.api.products().subscribe({ next: (p) => this.products.set(p), error: () => {} });
  }

  protected submit(form: NgForm) {
    if (form.invalid) return;
    this.busy.set(true);
    this.error.set(null);
    this.flow.setBuyer(this.buyer);

    const cart = this.flow.cart();
    this.api
      .createOrder({
        firstName: this.buyer.firstName,
        lastName: this.buyer.lastName,
        email: this.buyer.email,
        phone: this.buyer.phone || undefined,
        tickets: cart.tickets,
        products: cart.products,
        donationZar: cart.donationZar > 0 ? cart.donationZar : undefined,
      })
      .subscribe({
        next: (order) => {
          this.busy.set(false);
          this.flow.token = order.token;
          // The order is the record now, so a stale cart would only build a second one by accident.
          this.flow.clear();
          this.created.set(order);
        },
        error: (e: { error?: { detail?: string } }) => {
          this.busy.set(false);
          this.error.set(e.error?.detail ?? this.i18n.t('common.error'));
        },
      });
  }

  protected toPayment() {
    this.router.navigate(['/registreer/betaal']);
  }
}
