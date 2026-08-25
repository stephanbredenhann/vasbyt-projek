import { CurrencyPipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Order } from '../core/api.models';
import { ApiService } from '../core/api.service';
import { OrderFlowService } from '../core/order-flow.service';
import { I18nService } from '../i18n/i18n.service';
import { Steps } from './steps';

/**
 * Step 2 of 4. Nothing downstream of here is reachable until the order comes back Paid — the API
 * refuses to attach an entrant to an unpaid order, and paidOrderGuard turns that refusal into a
 * redirect back to this screen.
 */
@Component({
  selector: 'vb-register-pay',
  standalone: true,
  imports: [CurrencyPipe, Steps],
  template: `
    <div class="container section">
      <vb-steps [current]="2" />
      <h1>{{ i18n.t('pay.title') }}</h1>

      @if (error()) {
        <p class="alert alert--error">{{ error() }}</p>
      }

      @if (order(); as o) {
        <div class="card summary">
          <h2>{{ i18n.t('pay.summary') }}</h2>
          <dl>
            <dt>{{ i18n.t('pay.entrants') }}</dt>
            <dd>{{ o.entrantCount }}</dd>
            <dt>{{ i18n.t('reg.perEntrant') }}</dt>
            <dd>{{ o.entryFeeZar | currency: 'ZAR' : 'symbol-narrow' : '1.0-0' }}</dd>
            <dt>{{ i18n.t('pay.amount') }}</dt>
            <dd>
              <strong>{{ o.amountZar | currency: 'ZAR' : 'symbol-narrow' : '1.2-2' }}</strong>
            </dd>
          </dl>

          <p class="alert">{{ i18n.t('pay.warning') }}</p>

          <!-- ponytail: demo button. The real processor replaces this with a redirect out and a
               webhook back; the screen either side of it does not change. -->
          <button type="button" class="btn btn--accent btn--lg btn--block" [disabled]="busy()" (click)="pay(o)">
            {{ busy() ? i18n.t('pay.processing') : i18n.t('pay.button') }}
          </button>
          <p class="muted demo-note">{{ i18n.t('pay.demoNote') }}</p>
        </div>
      } @else if (!error()) {
        <p class="muted">{{ i18n.t('common.loading') }}</p>
      }
    </div>
  `,
  styles: `
    .summary {
      max-width: 34rem;
    }

    dl {
      display: grid;
      grid-template-columns: auto 1fr;
      gap: var(--space-2) var(--space-6);
      margin: 0 0 var(--space-6);
    }

    dt {
      color: var(--ink-muted);
      font-size: 0.875rem;
    }

    dd {
      margin: 0;
      text-align: right;
    }

    .demo-note {
      font-size: 0.8125rem;
      margin: var(--space-3) 0 0;
      text-align: center;
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
  protected readonly error = signal<string | null>(null);

  constructor() {
    const token = this.flow.token;
    if (!token) {
      this.router.navigate(['/registreer']);
      return;
    }

    this.api.order(token).subscribe({
      next: (o) => {
        // Already paid — a back-button landing, not a fresh order. Carry on where they left off.
        if (o.status === 'Paid') this.goToEntrants(o);
        else this.order.set(o);
      },
      error: () => this.error.set(this.i18n.t('common.error')),
    });
  }

  protected pay(o: Order) {
    this.busy.set(true);
    this.error.set(null);
    this.api.payOrder(o.token).subscribe({
      next: (paid) => this.goToEntrants(paid),
      error: () => {
        this.busy.set(false);
        this.error.set(this.i18n.t('common.error'));
      },
    });
  }

  private goToEntrants(o: Order) {
    const next = Math.min(o.entrantsFilled + 1, o.entrantCount);
    this.router.navigate(['/registreer', o.token, 'deelnemer', next]);
  }
}
