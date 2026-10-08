import { CurrencyPipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { OrderFlowService } from '../core/order-flow.service';
import { I18nService } from '../i18n/i18n.service';
import { ImageSlot } from '../shared/image-slot';

/**
 * The standalone donation page. A donation is a line in the shared basket, paid through the same
 * checkout as entries and shop orders: one code path, one reconciliation view for the administrator.
 */
@Component({
  selector: 'vb-donate',
  standalone: true,
  imports: [FormsModule, CurrencyPipe, ImageSlot],
  template: `
    <div class="container section donate">
      <div>
        <h1>{{ i18n.t('donate.title') }}</h1>
        <p class="lead">{{ i18n.t('donate.body') }}</p>
        <p>{{ i18n.t('donate.support') }}</p>
        <p>{{ i18n.t('donate.community') }}</p>
        <p class="invitation">{{ i18n.t('donate.invitation') }}</p>

        <form class="card" (ngSubmit)="submit()">
          <div class="presets">
            @for (p of presets; track p) {
              <button type="button" class="chip" [attr.aria-pressed]="amount() === p" (click)="amount.set(p)">
                {{ p | currency: 'ZAR' : 'symbol-narrow' : '1.0-0' }}
              </button>
            }
          </div>

          <label class="field own">
            <span>{{ i18n.t('donate.amount') }}</span>
            <input type="number" name="amount" min="10" step="10" inputmode="numeric" [(ngModel)]="amount" required />
            @if (amount() < 10) {
              <small class="field__error">{{ i18n.t('reg.donationMin') }}</small>
            }
          </label>

          @if (!flow.isEmpty()) {
            <p class="muted">{{ i18n.t('donate.basketNote') }}</p>
          }

          <button type="submit" class="btn btn--accent btn--block btn--lg" [disabled]="amount() < 10">
            {{ i18n.t('donate.toBasket') }}
          </button>
        </form>
      </div>

      <aside class="donate__photos">
        <vb-image src="/foto/helpmekaar-donasie.webp" ratio="4 / 5" [alt]="i18n.t('donate.photoHug')" [eager]="true" />
        <vb-image class="hands" src="/foto/helpmekaar-hande.webp" ratio="3 / 4" [alt]="i18n.t('donate.photoHands')" />
        <img class="helpmekaar-mark" src="/merk/orania-helpmekaar.png" alt="Orania Helpmekaar" width="320" loading="lazy" />
      </aside>
    </div>
  `,
  styles: `
    .invitation { font-weight: 600; color: var(--indigo); margin-bottom: var(--space-8); }
    .donate__photos { position: sticky; top: 104px; display: grid; gap: var(--space-6); }
    .hands { width: 48%; justify-self: end; margin-top: -6rem; border: 8px solid var(--canvas); border-radius: var(--r-lg); }
    .helpmekaar-mark { max-width: 280px; margin-inline: auto; }
    .donate {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(0, 0.8fr);
      gap: var(--space-12);
      align-items: start;
    }

    @media (max-width: 800px) {
      .donate {
        grid-template-columns: 1fr;
      }
      .donate__photos { position: static; }
    }

    .presets {
      display: flex;
      gap: var(--space-2);
      margin-bottom: var(--space-4);
      flex-wrap: wrap;
    }

    .own {
      max-width: 14rem;
    }


  `,
})
export class Donate {
  protected readonly i18n = inject(I18nService);
  protected readonly flow = inject(OrderFlowService);
  private router = inject(Router);

  protected readonly presets = [100, 250, 500, 1000];
  protected readonly amount = signal(this.flow.cart().donationZar || 250);

  protected submit() {
    if (this.amount() < 10) return;
    this.flow.setDonation(this.amount());
    this.router.navigate(['/mandjie']);
  }
}
