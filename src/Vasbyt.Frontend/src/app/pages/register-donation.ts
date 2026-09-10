import { CurrencyPipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { OrderFlowService } from '../core/order-flow.service';
import { I18nService } from '../i18n/i18n.service';
import { Steps } from './steps';

/**
 * Step 3 of 7. Spec 6.2: no donation, a suggested amount, or an own amount. The donation becomes
 * its own line on the order, which is why nothing here touches the ticket or product totals.
 */
@Component({
  selector: 'vb-register-donation',
  standalone: true,
  imports: [CurrencyPipe, Steps],
  template: `
    <div class="container section">
      <vb-steps [current]="3" />
      <h1>{{ i18n.t('reg.donationTitle') }}</h1>
      <p class="lead">{{ i18n.t('reg.donationIntro') }}</p>

      <div class="card panel">
        <div class="chips">
          <button type="button" class="chip" [attr.aria-selected]="amount() === 0"
                  (click)="pick(0)">
            {{ i18n.t('reg.donationNone') }}
          </button>
          @for (p of presets; track p) {
            <button type="button" class="chip" [attr.aria-selected]="amount() === p"
                    (click)="pick(p)">
              {{ p | currency: 'ZAR' : 'symbol-narrow' : '1.0-0' }}
            </button>
          }
        </div>

        <label class="field own">
          <span>{{ i18n.t('reg.donationOwn') }}</span>
          <input type="number" min="10" step="10" inputmode="numeric" [value]="amount() || ''"
                 (input)="own($event)" />
          @if (tooSmall()) {
            <small class="field__error">{{ i18n.t('reg.donationMin') }}</small>
          }
        </label>

        <p class="total">
          {{ i18n.t('reg.donation') }}
          <strong>{{ amount() | currency: 'ZAR' : 'symbol-narrow' : '1.0-0' }}</strong>
        </p>
      </div>

      <div class="actions">
        <button type="button" class="btn btn--ghost" (click)="back()">{{ i18n.t('reg.back') }}</button>
        <button type="button" class="btn btn--primary btn--lg" [disabled]="tooSmall()" (click)="next()">
          {{ i18n.t('reg.continue') }}
        </button>
      </div>
    </div>
  `,
  styles: `
    .panel {
      max-width: 34rem;
      margin-bottom: var(--space-8);
    }

    .chips {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-2);
      margin-bottom: var(--space-6);
    }

    .own {
      max-width: 14rem;
    }

    .total {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: var(--space-4);
      margin: var(--space-6) 0 0;
    }

    .total strong {
      font-family: var(--font-display);
      font-size: 1.75rem;
    }

    .actions {
      display: flex;
      gap: var(--space-4);
      flex-wrap: wrap;
    }
  `,
})
export class RegisterDonation {
  protected readonly i18n = inject(I18nService);
  private flow = inject(OrderFlowService);
  private router = inject(Router);

  protected readonly presets = [100, 250, 500, 1000];
  protected readonly amount = computed(() => this.flow.cart().donationZar);

  /** The server refuses anything between R1 and R10, so the button does too. */
  protected readonly tooSmall = signal(false);

  protected pick(value: number) {
    this.flow.setDonation(value);
    this.tooSmall.set(false);
  }

  protected own(event: Event) {
    const value = Math.max(0, Math.trunc(Number((event.target as HTMLInputElement).value)) || 0);
    this.flow.setDonation(value);
    this.tooSmall.set(value > 0 && value < 10);
  }

  protected back() {
    this.router.navigate(['/registreer/produkte']);
  }

  protected next() {
    this.router.navigate(['/registreer/kontroleer']);
  }
}
