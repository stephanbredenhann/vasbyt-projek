import { CurrencyPipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { Order } from '../core/api.models';
import { ApiService } from '../core/api.service';
import { I18nService } from '../i18n/i18n.service';
import { ImageSlot } from '../shared/image-slot';

/**
 * The standalone donation page. There is no donation endpoint: a donation is an order carrying a
 * Donation line and no tickets, paid through the same call the registration flow uses. One code
 * path, so one reconciliation view for the administrator.
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

        @if (done(); as o) {
          <div class="card card--ok">
            <p class="alert alert--ok">
              {{ i18n.t('donate.thanks') }}
              {{ o.totalZar | currency: 'ZAR' : 'symbol-narrow' : '1.2-2' }}
            </p>
            <p class="eyebrow">{{ i18n.t('skenk.reference') }}</p>
            <p class="reference">{{ o.reference }}</p>
          </div>
        } @else {
          <form #f="ngForm" class="card" (ngSubmit)="submit(f)">
            @if (error()) {
              <p class="alert alert--error">{{ error() }}</p>
            }

            <div class="presets">
              @for (p of presets; track p) {
                <button type="button" class="chip" [attr.aria-selected]="amount() === p"
                        (click)="amount.set(p)">
                  {{ p | currency: 'ZAR' : 'symbol-narrow' : '1.0-0' }}
                </button>
              }
            </div>

            <label class="field own">
              <span>{{ i18n.t('donate.amount') }}</span>
              <input type="number" name="amount" min="10" step="10" inputmode="numeric"
                     [(ngModel)]="amount" required />
              @if (amount() < 10) {
                <small class="field__error">{{ i18n.t('reg.donationMin') }}</small>
              }
            </label>

            <h2>{{ i18n.t('skenk.details') }}</h2>

            <div class="field-row">
              <label class="field">
                <span>{{ i18n.t('entrant.firstName') }}</span>
                <input type="text" name="firstName" [(ngModel)]="firstName" required
                       autocomplete="given-name" />
              </label>
              <label class="field">
                <span>{{ i18n.t('entrant.lastName') }}</span>
                <input type="text" name="lastName" [(ngModel)]="lastName" required
                       autocomplete="family-name" />
              </label>
            </div>

            <div class="field-row">
              <label class="field">
                <span>{{ i18n.t('entrant.email') }}</span>
                <input type="email" name="email" [(ngModel)]="email" required autocomplete="email" />
              </label>
              <label class="field">
                <span>
                  {{ i18n.t('entrant.phone') }}
                  <span class="muted">({{ i18n.t('common.optional') }})</span>
                </span>
                <input type="tel" name="phone" [(ngModel)]="phone" autocomplete="tel" />
              </label>
            </div>

            <button type="submit" class="btn btn--accent btn--block btn--lg"
                    [disabled]="busy() || f.invalid || amount() < 10">
              {{ busy() ? i18n.t('pay.processing') : i18n.t('donate.button') }}
            </button>
            @if (kwik() && demo()) {
              <button type="button" class="btn btn--block btn--lg demo-pay" (click)="submit(f, true)"
                      [disabled]="busy() || f.invalid || amount() < 10">
                {{ i18n.t('pay.demo') }}
              </button>
            }
          </form>
        }
      </div>

      <aside class="donate__photos">
        <vb-image src="/foto/helpmekaar-donasie.webp" ratio="4 / 5" [alt]="i18n.t('donate.photoHug')" [eager]="true" />
        <vb-image class="hands" src="/foto/helpmekaar-hande.webp" ratio="3 / 4" [alt]="i18n.t('donate.photoHands')" />
        <img class="helpmekaar-mark" src="/merk/orania-helpmekaar.png" alt="Orania Helpmekaar" width="320" loading="lazy" />
      </aside>
    </div>
  `,
  styles: `
    .demo-pay {
      margin-top: var(--space-3);
    }

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

    h2 {
      font-size: 1.25rem;
      margin-top: var(--space-6);
    }

    .reference {
      font-family: var(--font-display);
      font-size: clamp(1.5rem, 4vw, 2rem);
      letter-spacing: 0.02em;
      margin: 0;
    }

  `,
})
export class Donate {
  protected readonly i18n = inject(I18nService);
  private api = inject(ApiService);

  protected readonly presets = [100, 250, 500, 1000];
  protected readonly amount = signal(250);
  protected readonly firstName = signal('');
  protected readonly lastName = signal('');
  protected readonly email = signal('');
  protected readonly phone = signal('');
  protected readonly busy = signal(false);
  protected readonly done = signal<Order | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly kwik = signal(false);
  protected readonly demo = signal(false);

  constructor() {
    this.api.config().subscribe({
      next: (c) => {
        this.kwik.set(c.kwikPayments);
        this.demo.set(c.demoPayments);
      },
      error: () => {},
    });
  }

  /** Kwik when it is configured, otherwise the demo payment. */
  protected submit(form: NgForm, demo = !this.kwik()) {
    if (form.invalid || this.amount() < 10) return;
    this.busy.set(true);
    this.error.set(null);

    this.api
      .createOrder({
        firstName: this.firstName(),
        lastName: this.lastName(),
        email: this.email(),
        phone: this.phone() || undefined,
        donationZar: this.amount(),
      })
      .subscribe({
        next: (order) =>
          demo ? this.api.payOrder(order.token).subscribe({
            next: (paid) => {
              this.busy.set(false);
              this.done.set(paid);
            },
            error: (e) => this.fail(e),
          }) : this.api.startPayment(order.token).subscribe({
            next: ({ url }) => (window.location.href = url),
            error: (e) => this.fail(e),
          }),
        error: (e) => this.fail(e),
      });
  }

  private fail(e: { error?: { detail?: string } }) {
    this.busy.set(false);
    this.error.set(e.error?.detail ?? this.i18n.t('common.error'));
  }
}
