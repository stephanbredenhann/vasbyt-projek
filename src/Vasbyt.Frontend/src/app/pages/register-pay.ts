import { CurrencyPipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Order } from '../core/api.models';
import { ApiService } from '../core/api.service';
import { OrderFlowService } from '../core/order-flow.service';
import { I18nService } from '../i18n/i18n.service';
import { Steps } from './steps';

/**
 * The order already exists, so a failed payment loses nothing. The token in the URL is the only
 * order this page will ever pay: a stored pointer in the browser can never redirect it to another.
 * Payment is also what creates the participant forms.
 */
@Component({
  selector: 'vb-register-pay',
  standalone: true,
  imports: [CurrencyPipe, RouterLink, Steps],
  template: `
    <div class="container section">
      <vb-steps current="pay" [tickets]="tickets()" />
      <h1>{{ i18n.t('pay.title') }}</h1>

      @if (error()) {
        <p class="alert alert--error" role="alert">{{ error() }}</p>
      }
      @if (unconfirmed()) {
        <p class="alert" role="status">{{ i18n.t('pay.unconfirmed') }}</p>
      }

      @if (order(); as o) {
        @if (o.status === 'Cancelled') {
          <div class="card summary">
            <p class="alert">{{ i18n.t('pay.cancelled') }}</p>
            <a class="btn btn--primary" routerLink="/mandjie">{{ i18n.t('basket.title') }}</a>
          </div>
        } @else {
          <div class="card summary">
            <p class="eyebrow">{{ i18n.t('pay.reference') }}</p>
            <p class="reference">{{ o.reference }}</p>
            <p class="muted">{{ i18n.t('reg.orderSavedBody') }}</p>
            @if (basketChanged()) {
              <p class="alert" role="status">
                {{ i18n.t('pay.basketChanged') }} <a routerLink="/bestel">{{ i18n.t('pay.updateOrder') }}</a>
              </p>
            }

            <dl>
              @for (l of o.lines; track l.id) {
                <dt>{{ l.description }} <span class="muted">× {{ l.quantity }}</span></dt>
                <dd>{{ l.lineTotalZar | currency: 'ZAR' : 'symbol-narrow' : '1.2-2' }}</dd>
              }
              <dt class="is-total">{{ i18n.t('pay.amount') }}</dt>
              <dd class="is-total">{{ o.totalZar | currency: 'ZAR' : 'symbol-narrow' : '1.2-2' }}</dd>
            </dl>

            @if (tickets()) { <p class="note">{{ i18n.t('checkout.formsAfter') }}</p> }
            @if (hasProducts()) { <p class="note">{{ i18n.t('pay.stockNote') }}</p> }

            @if (kwik()) {
              <button type="button" class="btn btn--accent btn--lg btn--block" [disabled]="busy()"
                      (click)="pay(o)">
                {{ busy() ? i18n.t('pay.processing') : i18n.t('pay.button') }}
              </button>
              @if (unconfirmed()) {
                <button type="button" class="btn btn--lg btn--block again" [disabled]="busy()" (click)="verify(o.token)">
                  {{ i18n.t('pay.checkAgain') }}
                </button>
              }
            }
            @if (demoPayments()) {
              <button type="button" class="btn btn--lg btn--block" [class.btn--accent]="!kwik()" [class.again]="kwik()"
                      [disabled]="busy()" (click)="payDemo(o)">
                {{ busy() ? i18n.t('pay.processing') : kwik() ? i18n.t('pay.demo') : i18n.t('pay.button') }}
              </button>
            }
            @if (!kwik() && !demoPayments()) {
              <p class="alert">{{ i18n.t('pay.unavailable') }}</p>
            }
            @if (editable()) {
              <a class="btn btn--ghost edit" routerLink="/mandjie">{{ i18n.t('reg.edit') }}</a>
            }
          </div>
        }
      } @else if (missing()) {
        <p class="alert">{{ i18n.t('pay.noOrder') }}</p>
        <a class="btn btn--primary" routerLink="/mandjie">{{ i18n.t('basket.title') }}</a>
      } @else if (!error()) {
        <p class="muted">{{ i18n.t('common.loading') }}</p>
      }
    </div>
  `,
  styles: `
    .summary { max-width: 36rem; }

    .reference {
      font-family: var(--font-display);
      font-size: clamp(1.75rem, 5vw, 2.5rem);
      letter-spacing: 0.02em;
      margin: 0 0 var(--space-2);
    }

    dl {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: var(--space-2) 0;
      margin: var(--space-6) 0;
      font-size: 0.9375rem;
    }

    dt { padding-right: var(--space-4); }

    dd {
      margin: 0;
      text-align: right;
      font-variant-numeric: tabular-nums;
    }

    .is-total {
      padding-top: var(--space-3);
      border-top: 1px solid var(--rule);
      font-weight: 700;
      font-size: 1.0625rem;
    }

    .note { font-size: 0.9375rem; color: var(--ink-muted); }
    .edit, .again { margin-top: var(--space-4); }
  `,
})
export class RegisterPay {
  protected readonly i18n = inject(I18nService);
  private api = inject(ApiService);
  private router = inject(Router);
  private flow = inject(OrderFlowService);

  protected readonly order = signal<Order | null>(null);
  protected readonly busy = signal(false);
  protected readonly missing = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly demoPayments = signal(false);
  protected readonly kwik = signal(false);
  /** Back from Kwik but the payment is not confirmed yet. */
  protected readonly unconfirmed = signal(false);
  protected readonly tickets = computed(() => this.order()?.lines.some((l) => l.kind === 'Ticket') ?? this.flow.ticketCount() > 0);
  protected readonly hasProducts = computed(() => this.order()?.lines.some((l) => l.kind === 'Product') ?? false);
  /** Only this browser's own pending order can be edited from the basket. */
  protected readonly editable = computed(() => this.order()?.status === 'Pending' && this.flow.pending?.token === this.order()?.token);

  protected readonly basketChanged = computed(() => this.editable() && this.flow.cart().revision !== this.flow.pending?.submittedRevision);

  constructor() {
    this.api.config().subscribe({
      next: (c) => {
        this.demoPayments.set(c.demoPayments);
        this.kwik.set(c.kwikPayments);
      },
      error: () => {},
    });
    const route = inject(ActivatedRoute).snapshot;
    const token = route.paramMap.get('token');
    // The old tokenless URL resumes this browser's order under its own address.
    if (!token) {
      if (this.flow.token) this.router.navigate(['/bestel', this.flow.token, 'betaal'], { replaceUrl: true });
      else this.missing.set(true);
      return;
    }
    // Kwik sends the buyer back here with ?kwik=terug or ?kwik=gekanselleer.
    const back = route.queryParamMap.get('kwik');
    if (back === 'gekanselleer') this.error.set(this.i18n.t('pay.failed'));
    this.load(token, back === 'terug');
  }

  private load(token: string, verify = false) {
    (verify ? this.api.verifyPayment(token) : this.api.order(token)).subscribe({
      next: (o) => {
        // Already paid: a back-button landing, not a fresh order. Carry on where they left off.
        if (o.status === 'Paid') this.advance(o);
        else {
          this.order.set(o);
          this.unconfirmed.set(verify && o.status === 'Pending');
        }
      },
      error: () => this.missing.set(true),
    });
  }

  /** Kwik hosted checkout: the server checks the order is still as reviewed, then we leave the site. */
  protected pay(o: Order) {
    if (!this.start()) return;
    this.api.startPayment(o.token, { version: o.version, expectedTotalZar: o.totalZar }).subscribe({
      next: ({ url }) => (window.location.href = url),
      error: (e) => this.fail(e, o.token),
    });
  }

  protected verify(token: string) {
    if (!this.start()) return;
    this.api.verifyPayment(token).subscribe({
      next: (o) => (o.status === 'Paid' ? this.advance(o) : this.busy.set(false)),
      error: (e) => this.fail(e, token),
    });
  }

  protected payDemo(o: Order) {
    if (!this.start()) return;
    this.api.payOrder(o.token, { version: o.version, expectedTotalZar: o.totalZar }).subscribe({
      next: (paid) => this.advance(paid),
      error: (e) => this.fail(e, o.token),
    });
  }

  private start() {
    if (this.busy()) return false;
    this.busy.set(true);
    this.error.set(null);
    return true;
  }

  private fail(e: { status?: number; error?: { detail?: string } }, token: string) {
    this.busy.set(false);
    this.error.set(e.error?.detail ?? this.i18n.t('pay.failed'));
    // A conflict means the order changed underneath; show the current one before another try.
    if (e.status === 409) this.load(token);
  }

  /** Straight to the first form still waiting, or to the receipt when there are no tickets. */
  private advance(o: Order) {
    // Only the basket that became this order is emptied; a newer basket or another order's pointer stays.
    const pending = this.flow.pending;
    if (pending?.token === o.token) this.flow.clearIfRevision(pending.submittedRevision);
    this.flow.clearPending(o.token);
    const next = o.entrants.findIndex((e) => !e.isComplete);
    if (next < 0) this.router.navigate(['/bestel', o.token, 'klaar']);
    else this.router.navigate(['/registreer', o.token, 'deelnemer', next + 1]);
  }
}
