import { CurrencyPipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ApiService } from '../core/api.service';
import { OrderFlowService } from '../core/order-flow.service';
import { I18nService } from '../i18n/i18n.service';
import { Steps } from './steps';

/**
 * Step 1 of 4: how many people. Nothing else.
 *
 * Which event each person is doing is asked at step 3, once per person — the entry fee is flat
 * across all four, so the total is known from the head count alone.
 */
@Component({
  selector: 'vb-register-choose',
  standalone: true,
  imports: [FormsModule, CurrencyPipe, Steps],
  template: `
    <div class="container section">
      <vb-steps [current]="1" />
      <h1>{{ i18n.t('reg.howMany') }}</h1>

      @if (error()) {
        <p class="alert alert--error">{{ error() }}</p>
      }

      <div class="card counter">
        <div class="counter__control">
          <button type="button" class="btn btn--ghost" (click)="bump(-1)" [disabled]="count() <= 1"
                  aria-label="Een minder">−</button>
          <input type="number" min="1" max="20" [(ngModel)]="count" name="count"
                 [attr.aria-label]="i18n.t('reg.howMany')" />
          <button type="button" class="btn btn--ghost" (click)="bump(1)" [disabled]="count() >= 20"
                  aria-label="Een meer">+</button>
        </div>

        <p class="counter__sum">
          {{ fee() | currency: 'ZAR' : 'symbol-narrow' : '1.0-0' }}
          <span class="muted">{{ i18n.t('reg.perEntrant') }}</span>
          × {{ count() }}
        </p>

        <p class="counter__total">
          {{ i18n.t('reg.total') }}
          <strong>{{ total() | currency: 'ZAR' : 'symbol-narrow' : '1.0-0' }}</strong>
        </p>

        <p class="alert">{{ i18n.t('reg.howManyHint') }}</p>

        <button type="button" class="btn btn--primary btn--lg btn--block"
                [disabled]="busy() || count() < 1" (click)="next()">
          {{ busy() ? i18n.t('common.loading') : i18n.t('reg.continue') }}
        </button>
      </div>

      <p class="lead after">{{ i18n.t('reg.eventLater') }}</p>
    </div>
  `,
  styles: `
    .counter {
      max-width: 30rem;
    }

    .counter__control {
      display: flex;
      align-items: stretch;
      gap: var(--space-3);
      margin-bottom: var(--space-6);
    }

    .counter__control input {
      text-align: center;
      font-family: var(--font-display);
      font-size: 2rem;
      font-weight: 700;
    }

    .counter__control .btn {
      font-size: 1.5rem;
      line-height: 1;
      padding-inline: var(--space-6);
    }

    .counter__sum {
      margin-bottom: var(--space-2);
      color: var(--ink-muted);
    }

    .counter__total {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      padding-top: var(--space-3);
      border-top: var(--border);
      font-size: 1.125rem;
    }

    .counter__total strong {
      font-family: var(--font-display);
      font-size: 1.75rem;
    }

    .after {
      margin-top: var(--space-8);
    }
  `,
})
export class RegisterChoose {
  protected readonly i18n = inject(I18nService);
  private api = inject(ApiService);
  private router = inject(Router);
  private flow = inject(OrderFlowService);

  protected readonly count = signal(1);
  protected readonly fee = signal(0);
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly total = computed(() => this.fee() * this.count());

  constructor() {
    // The server is what actually prices the order; this is only so the total reads right here.
    this.api.config().subscribe({
      next: (c) => this.fee.set(c.entryFeeZar),
      error: () => this.error.set(this.i18n.t('common.error')),
    });
  }

  protected bump(by: number) {
    this.count.set(Math.min(20, Math.max(1, this.count() + by)));
  }

  protected next() {
    this.busy.set(true);
    this.error.set(null);
    this.api.createOrder(this.count()).subscribe({
      next: (order) => {
        this.flow.token = order.token;
        this.flow.sameAddressForAll = false;
        this.router.navigate(['/registreer/betaal']);
      },
      error: () => {
        this.busy.set(false);
        this.error.set(this.i18n.t('common.error'));
      },
    });
  }
}
