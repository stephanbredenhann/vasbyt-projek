import { CurrencyPipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
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


          <!-- ponytail: demo button. The real processor replaces this with a redirect out and a
               webhook back; the screen either side of it does not change. -->
          <button type="button" class="btn btn--accent btn--lg btn--block" [disabled]="busy()"
                  (click)="pay(o)">
            {{ busy() ? i18n.t('pay.processing') : i18n.t('pay.button') }}
          </button>
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
  private flow = inject(OrderFlowService);

  protected readonly order = signal<Order | null>(null);
  protected readonly busy = signal(false);
  protected readonly missing = signal(false);
  protected readonly error = signal<string | null>(null);

  constructor() {
    const token = this.flow.token;
    if (!token) {
      this.missing.set(true);
      return;
    }

    this.api.order(token).subscribe({
      next: (o) => {
        // Already paid: a back-button landing, not a fresh order. Carry on where they left off.
        if (o.status === 'Paid') this.advance(o);
        else this.order.set(o);
      },
      error: () => this.missing.set(true),
    });
  }

  protected pay(o: Order) {
    this.busy.set(true);
    this.error.set(null);
    this.api.payOrder(o.token).subscribe({
      next: (paid) => this.advance(paid),
      error: (e: { error?: { detail?: string } }) => {
        this.busy.set(false);
        this.error.set(e.error?.detail ?? this.i18n.t('pay.failed'));
      },
    });
  }

  /** Straight to the first form still waiting, or to the confirmation when there are no tickets. */
  private advance(o: Order) {
    const next = o.entrants.findIndex((e) => !e.isComplete);
    if (next < 0) this.router.navigate(['/registreer', o.token, 'klaar']);
    else this.router.navigate(['/registreer', o.token, 'deelnemer', next + 1]);
  }
}
