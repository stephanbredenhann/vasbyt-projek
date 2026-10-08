import { CurrencyPipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { catchError } from 'rxjs';
import { CreateOrderRequest, Quote } from '../core/api.models';
import { ApiService } from '../core/api.service';
import { AuthService } from '../core/auth.service';
import { Buyer, OrderFlowService } from '../core/order-flow.service';
import { I18nService } from '../i18n/i18n.service';
import { Steps } from './steps';

/**
 * Checkout: buyer details beside the server's quote, then one saved order to pay. Guest is the
 * default; signing in or creating an account is a detour that returns here with the basket intact.
 *
 * The order is created with the basket's checkout key, so a double click or a lost response gets
 * the same order back. A basket edited after an order was saved updates that pending order instead.
 */
@Component({
  selector: 'vb-register-review',
  standalone: true,
  imports: [CurrencyPipe, FormsModule, RouterLink, Steps],
  template: `
    <div class="container section">
      <vb-steps current="details" [tickets]="flow.ticketCount() > 0" />
      <h1>{{ i18n.t('checkout.title') }}</h1>

      @if (flow.isEmpty()) {
        <p class="alert">{{ i18n.t('reg.emptyCart') }}</p>
        <a class="btn btn--primary" routerLink="/mandjie">{{ i18n.t('basket.title') }}</a>
      } @else {
        <div class="split">
          <form #f="ngForm" class="card" (ngSubmit)="submit(f)" novalidate>
            @if (auth.user(); as u) {
              <p class="signed-in">{{ i18n.t('checkout.signedInAs') }} <strong>{{ u.email }}</strong>. {{ i18n.t('checkout.signedInNote') }}</p>
            } @else {
              <div class="guest">
                <p>{{ i18n.t('checkout.guest') }}</p>
                <p class="muted">
                  <a routerLink="/teken-aan" [queryParams]="{ terug: '/bestel' }" (click)="keep()">{{ i18n.t('auth.submit') }}</a>
                  {{ i18n.t('checkout.or') }}
                  <a routerLink="/skep-rekening" [queryParams]="{ terug: '/bestel' }" (click)="keep()">{{ i18n.t('auth.create') }}</a>
                  {{ i18n.t('checkout.optionalAccount') }}
                </p>
              </div>
            }

            <h2>{{ i18n.t('reg.buyer') }}</h2>
            <p class="muted">{{ i18n.t('reg.buyerIntro') }}</p>

            @if (error()) {
              <p class="alert alert--error" role="alert">{{ error() }}</p>
            }

            <div class="field-row">
              <label class="field">
                <span>{{ i18n.t('entrant.firstName') }}</span>
                <input type="text" name="firstName" [(ngModel)]="buyer.firstName" #fn="ngModel" required autocomplete="given-name" />
                @if (fn.invalid && (fn.touched || f.submitted)) { <small class="field__error">{{ i18n.t('checkout.required') }}</small> }
              </label>
              <label class="field">
                <span>{{ i18n.t('entrant.lastName') }}</span>
                <input type="text" name="lastName" [(ngModel)]="buyer.lastName" #ln="ngModel" required autocomplete="family-name" />
                @if (ln.invalid && (ln.touched || f.submitted)) { <small class="field__error">{{ i18n.t('checkout.required') }}</small> }
              </label>
            </div>

            <div class="field-row">
              <label class="field">
                <span>{{ i18n.t('entrant.email') }}</span>
                <input type="email" name="email" [(ngModel)]="buyer.email" #em="ngModel" required email autocomplete="email" />
                @if (em.invalid && (em.touched || f.submitted)) { <small class="field__error">{{ i18n.t('checkout.emailInvalid') }}</small> }
              </label>
              <label class="field">
                <span>{{ i18n.t('entrant.phone') }} <span class="muted">({{ i18n.t('common.optional') }})</span></span>
                <input type="tel" name="phone" [(ngModel)]="buyer.phone" autocomplete="tel" />
              </label>
            </div>

            @if (flow.ticketCount()) {
              <p class="note">{{ i18n.t('checkout.formsAfter') }} ({{ flow.ticketCount() }})</p>
            }
            @if (flow.productCount()) {
              <p class="note">{{ i18n.t('shop.collectNote') }}</p>
            }

            <button type="submit" class="btn btn--accent btn--lg btn--block" [disabled]="busy() || !quote()">
              {{ busy() ? i18n.t('reg.creating') : i18n.t('reg.toPayment') }}
            </button>
          </form>

          <aside class="card cart">
            <h2>{{ i18n.t('pay.summary') }}</h2>
            @if (quoteError()) {
              <p class="alert alert--error" role="alert">{{ quoteError() }}</p>
            } @else if (quote(); as q) {
              <dl class="lines">
                @for (l of q.lines; track $index) {
                  <dt>{{ l.description }} <span class="muted">× {{ l.quantity }}</span></dt>
                  <dd>{{ l.lineTotalZar | currency: 'ZAR' : 'symbol-narrow' : '1.2-2' }}</dd>
                }
                <dt class="is-total">{{ i18n.t('reg.total') }}</dt>
                <dd class="is-total">{{ q.totalZar | currency: 'ZAR' : 'symbol-narrow' : '1.2-2' }}</dd>
              </dl>
            } @else {
              <p class="muted">{{ i18n.t('common.loading') }}</p>
            }
            <a class="btn btn--ghost" routerLink="/mandjie" (click)="keep()">{{ i18n.t('reg.edit') }}</a>
          </aside>
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
      .split { grid-template-columns: 1fr; }
    }

    .guest,
    .signed-in {
      padding: var(--space-4);
      margin-bottom: var(--space-6);
      border-radius: var(--r-md, 8px);
      background: var(--karoo-sand-light);
    }

    .guest p { margin: 0; }
    .guest p + p { margin-top: var(--space-2); font-size: 0.9375rem; }
    .signed-in { font-size: 0.9375rem; }

    .note { font-size: 0.9375rem; color: var(--ink-muted); }

    .lines {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: var(--space-2) 0;
      margin: var(--space-6) 0;
      font-size: 0.9375rem;
    }

    .lines dt { padding-right: var(--space-4); }

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
    .split form h2 { font-size: 1.375rem; }
  `,
})
export class RegisterReview {
  protected readonly i18n = inject(I18nService);
  protected readonly flow = inject(OrderFlowService);
  protected readonly auth = inject(AuthService);
  private api = inject(ApiService);
  private router = inject(Router);

  protected buyer: Buyer = { ...this.flow.cart().buyer };
  protected readonly quote = signal<Quote | null>(null);
  protected readonly quoteError = signal<string | null>(null);
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);

  constructor() {
    // Blank fields only: anything the buyer already typed wins over the account profile.
    const u = this.auth.user();
    if (u) {
      this.flow.prefillBuyer(u);
      this.buyer = { ...this.flow.cart().buyer };
    }
    const c = this.flow.cart();
    if (this.flow.isEmpty()) return;
    this.api.quoteOrder({ tickets: c.tickets, products: c.products, donationZar: c.donationZar }).subscribe({
      next: (q) => this.quote.set(q),
      error: (e: { error?: { detail?: string } }) => this.quoteError.set(e.error?.detail ?? this.i18n.t('basket.quoteFailed')),
    });
  }

  /** Saves the typed details before a detour to sign in or the basket, so nothing is retyped. */
  protected keep() {
    this.flow.setBuyer({ ...this.buyer, firstName: this.buyer.firstName.trim(), lastName: this.buyer.lastName.trim(), email: this.buyer.email.trim() });
  }

  protected submit(form: NgForm) {
    if (form.invalid) {
      this.error.set(this.i18n.t('auth.fixFields'));
      document.querySelector<HTMLElement>('form .ng-invalid:not(form)')?.focus();
      return;
    }
    if (this.busy()) return;
    this.busy.set(true);
    this.error.set(null);
    this.keep();

    const cart = this.flow.cart();
    const body: CreateOrderRequest = {
      firstName: cart.buyer.firstName,
      lastName: cart.buyer.lastName,
      email: cart.buyer.email,
      phone: cart.buyer.phone || undefined,
      tickets: cart.tickets,
      products: cart.products,
      donationZar: cart.donationZar > 0 ? cart.donationZar : undefined,
      lang: this.i18n.locale(),
    };
    const create = this.api.createOrder({ ...body, checkoutKey: this.flow.checkoutKey() });
    // A pending order from this browser is edited in place; if it was paid or changed meanwhile, start fresh.
    const pending = this.flow.pending;
    const save = pending ? this.api.updateOrder(pending.token, { ...body, version: pending.version }).pipe(catchError(() => create)) : create;

    save.subscribe({
      next: (order) => {
        this.flow.savePending(order, cart.revision);
        this.router.navigate(['/bestel', order.token, 'betaal']);
      },
      error: (e: { error?: { detail?: string } }) => {
        this.busy.set(false);
        this.error.set(e.error?.detail ?? this.i18n.t('common.error'));
      },
    });
  }
}
