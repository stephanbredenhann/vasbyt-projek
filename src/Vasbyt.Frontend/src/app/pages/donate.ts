import { CurrencyPipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../core/api.service';
import { I18nService } from '../i18n/i18n.service';
import { ImageSlot } from '../shared/image-slot';

@Component({
  selector: 'vb-donate',
  standalone: true,
  imports: [FormsModule, CurrencyPipe, ImageSlot],
  template: `
    <div class="container section donate">
      <div>
        <h1>{{ i18n.t('donate.title') }}</h1>
        <p class="lead">{{ i18n.t('donate.body') }}</p>

        @if (done()) {
          <p class="alert alert--ok">
            {{ i18n.t('donate.thanks') }}
            {{ amount() | currency: 'ZAR' : 'symbol-narrow' : '1.2-2' }}
          </p>
        } @else {
          <form class="card" (ngSubmit)="submit()">
            @if (error()) {
              <p class="alert alert--error">{{ error() }}</p>
            }

            <div class="presets">
              @for (p of presets; track p) {
                <button type="button" class="btn btn--ghost" (click)="amount.set(p)">R{{ p }}</button>
              }
            </div>

            <label class="field">
              <span>{{ i18n.t('donate.amount') }}</span>
              <input type="number" name="amount" min="10" step="10" [(ngModel)]="amount" required />
            </label>

            <label class="field">
              <span>{{ i18n.t('donate.name') }}</span>
              <input type="text" name="name" [(ngModel)]="name" />
              <small class="field__hint">{{ i18n.t('donate.nameHint') }}</small>
            </label>

            <label class="field">
              <span>{{ i18n.t('donate.message') }}</span>
              <textarea name="message" [(ngModel)]="message"></textarea>
            </label>

            <button type="submit" class="btn btn--accent btn--block btn--lg" [disabled]="busy()">
              {{ busy() ? i18n.t('pay.processing') : i18n.t('donate.button') }}
            </button>
            <p class="muted demo-note">{{ i18n.t('pay.demoNote') }}</p>
          </form>
        }
      </div>

      <vb-image ratio="3 / 4" label="Helpmekaar" />
    </div>
  `,
  styles: `
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
    }

    .presets {
      display: flex;
      gap: var(--space-2);
      margin-bottom: var(--space-4);
      flex-wrap: wrap;
    }

    .demo-note {
      font-size: 0.8125rem;
      text-align: center;
      margin: var(--space-3) 0 0;
    }
  `,
})
export class Donate {
  protected readonly i18n = inject(I18nService);
  private api = inject(ApiService);

  protected readonly presets = [100, 250, 500, 1000];
  protected readonly amount = signal(250);
  protected readonly name = signal('');
  protected readonly message = signal('');
  protected readonly busy = signal(false);
  protected readonly done = signal(false);
  protected readonly error = signal<string | null>(null);

  protected submit() {
    this.busy.set(true);
    this.error.set(null);

    // ponytail: two demo calls in a row stands in for the processor round-trip.
    this.api
      .donate({
        amountZar: this.amount(),
        name: this.name() || undefined,
        message: this.message() || undefined,
      })
      .subscribe({
        next: ({ token }) =>
          this.api.payDonation(token).subscribe({
            next: () => {
              this.busy.set(false);
              this.done.set(true);
            },
            error: () => this.fail(),
          }),
        error: () => this.fail(),
      });
  }

  private fail() {
    this.busy.set(false);
    this.error.set(this.i18n.t('common.error'));
  }
}
