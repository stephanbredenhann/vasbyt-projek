import { CurrencyPipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Order } from '../core/api.models';
import { ApiService } from '../core/api.service';
import { OrderFlowService } from '../core/order-flow.service';
import { I18nService } from '../i18n/i18n.service';
import { Steps } from './steps';

/**
 * Step 5 of 7. The order already exists, so a failed payment loses nothing: the reference below is
 * the handle the user comes back on. Payment is also what creates the participant forms, which is
 * why nothing downstream of here is reachable until the order comes back Paid.
 */
@Component({
  selector: 'vb-register-pay',
  standalone: true,
  imports: [CurrencyPipe, RouterLink, Steps],
  template: `
    <div class="container section">
      <vb-steps [current]="5" />
      <h1>{{ i18n.t('pay.title') }}</h1>

      @if (error()) {
        <p class="alert alert--error">{{ error() }}</p>
      }
      @if (unconfirmed()) {
        <p class="alert">{{ i18n.t('pay.unconfirmed') }}</p>
      }

      @if (order(); as o) {
        <div class="card summary">
          <p class="eyebrow">{{ i18n.t('pay.reference') }}</p>
          <p class="reference">{{ o.reference }}</p>

          <dl>
            @for (l of o.lines; track l.id) {
              <dt>{{ l.description }} <span class="muted">× {{ l.quantity }}</span></dt>
              <dd>{{ l.lineTotalZar | currency: 'ZAR' : 'symbol-narrow' : '1.2-2' }}</dd>
            }
            <dt class="is-total">{{ i18n.t('pay.amount') }}</dt>
            <dd class="is-total">{{ o.totalZar | currency: 'ZAR' : 'symbol-narrow' : '1.2-2' }}</dd>
          </dl>


          <div class="actions">
            @if (kwik()) {
              <button type="button" class="btn btn--accent btn--lg" [disabled]="busy()" (click)="pay(o)">
                {{ busy() ? i18n.t('pay.processing') : i18n.t('pay.button') }}
              </button>
              @if (unconfirmed()) {
                <button type="button" class="btn btn--lg" [disabled]="busy()" (click)="verify(o.token)">
                  {{ i18n.t('pay.checkAgain') }}
                </button>
              }
            }
            @if (demo()) {
              <button type="button" class="btn btn--lg" [disabled]="busy()" (click)="payDemo(o)">
                {{ i18n.t('pay.demo') }}
              </button>
            }
          </div>
        </div>
      } @else if (missing()) {
        <p class="alert">{{ i18n.t('pay.noOrder') }}</p>
        <a class="btn btn--primary" routerLink="/registreer">{{ i18n.t('reg.startOver') }}</a>
      } @else if (!error()) {
        <p class="muted">{{ i18n.t('common.loading') }}</p>
      }
    </div>
  `,
  styles: `
    .summary {
      max-width: 36rem;
    }

    .reference {
      font-family: var(--font-display);
      font-size: clamp(1.75rem, 5vw, 2.5rem);
      letter-spacing: 0.02em;
      margin: 0 0 var(--space-4);
    }

    dl {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: var(--space-2) 0;
      margin: 0 0 var(--space-6);
      font-size: 0.9375rem;
    }

    dt {
      padding-right: var(--space-4);
    }

    dd {
      margin: 0;
      text-align: right;
      font-variant-numeric: tabular-nums;
    }

    .actions {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-3);
    }

    .actions .btn {
      flex: 1 1 12rem;
    }

    .is-total {
      padding-top: var(--space-3);
      border-top: 1px solid var(--rule);
      font-weight: 700;
      font-size: 1.0625rem;
    }

  `,
})
export class RegisterPay {
  protected readonly i18n = inject(I18nService);
  private api = inject(ApiService);
  private router = inject(Router);
  private query = inject(ActivatedRoute).snapshot.queryParamMap;
  private flow = inject(OrderFlowService);

  protected readonly order = signal<Order | null>(null);
  protected readonly busy = signal(false);
  protected readonly missing = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly unconfirmed = signal(false);
  protected readonly kwik = signal(false);
  protected readonly demo = signal(false);

  constructor() {
    // Kwik redirects back with the token in the URL, which wins over this browser's saved one.
    const token = this.query.get('bestelling') ?? this.flow.token;
    if (!token) {
      this.missing.set(true);
      return;
    }
    this.flow.token = token;

    this.api.config().subscribe({
      next: (c) => {
        this.kwik.set(c.kwikPayments);
        this.demo.set(c.demoPayments);
      },
      error: () => {},
    });

    const kwik = this.query.get('kwik');
    if (kwik === 'gekanselleer') this.error.set(this.i18n.t('pay.failed'));
    const load = kwik === 'terug' ? this.api.verifyPayment(token) : this.api.order(token);
    load.subscribe({
      next: (o) => {
        // Already paid: a back-button landing, not a fresh order. Carry on where they left off.
        if (o.status === 'Paid') this.advance(o);
        else {
          this.order.set(o);
          this.unconfirmed.set(kwik === 'terug');
        }
      },
      error: () => this.missing.set(true),
    });
  }

  /** Off to Kwik's hosted checkout; it sends the buyer back here with ?kwik=terug. */
  protected pay(o: Order) {
    this.start();
    this.api.startPayment(o.token).subscribe({
      next: ({ url }) => (window.location.href = url),
      error: (e) => this.fail(e),
    });
  }

  protected verify(token: string) {
    this.start();
    this.api.verifyPayment(token).subscribe({
      next: (o) => (o.status === 'Paid' ? this.advance(o) : this.busy.set(false)),
      error: (e) => this.fail(e),
    });
  }

  protected payDemo(o: Order) {
    this.start();
    this.api.payOrder(o.token).subscribe({
      next: (paid) => this.advance(paid),
      error: (e) => this.fail(e),
    });
  }

  private start() {
    this.busy.set(true);
    this.error.set(null);
  }

  private fail(e: { error?: { detail?: string } }) {
    this.busy.set(false);
    this.error.set(e.error?.detail ?? this.i18n.t('pay.failed'));
  }

  /** Straight to the first form still waiting, or to the confirmation when there are no tickets. */
  private advance(o: Order) {
    const next = o.entrants.findIndex((e) => !e.isComplete);
    if (next < 0) this.router.navigate(['/registreer', o.token, 'klaar']);
    else this.router.navigate(['/registreer', o.token, 'deelnemer', next + 1]);
  }
}
